import { readFile } from "node:fs/promises";
import { logger, STYLE_IDS, toDemovieError, VIDEO_TYPES } from "@demovie/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const slug = z.string().describe("video slug (.demovie/videos/<slug>) or a path to a folder with video.json");
const format = z.string().describe('"16:9", "9:16", "1:1", "4:5" or "all"');

/** Every tool of SPEC §14.3: name → description + zod input shape. All return JSON; `stills` also returns images. */
export const TOOLS = {
  status: {
    description: "Project state: config, app, auth, capture freshness, videos and their status, and the next step.",
    input: {},
  },
  init_check: {
    description: "Check what setup is missing (never prompts): config, brand, glossary, routes, auth env, app, tools.",
    input: {},
  },
  extract: {
    description: "Re-run the brand, glossary and route extractors (static, plus runtime when the app is reachable).",
    input: { what: z.enum(["brand", "glossary", "routes", "all"]).optional().describe("default: all") },
  },
  list_routes: {
    description: "The route map (.demovie/routes.json): paths, source files, protected flags, params.",
    input: {},
  },
  list_captures: {
    description: "Captured states with their route/flow, viewport, capture time and whether they are stale.",
    input: {},
  },
  capture: {
    description: "Capture app states (screenshots + element maps). Long-running; sends progress notifications.",
    input: {
      routes: z.array(z.string()).optional().describe("route globs, e.g. /app/projects"),
      flows: z.array(z.string()).optional().describe("flow names from .demovie/flows"),
      viewports: z.array(z.string()).optional().describe("viewport names, e.g. desktop, mobile"),
      changedSince: z.string().optional().describe("git ref: only recapture routes affected by changes since it"),
      allowRemote: z
        .boolean()
        .optional()
        .describe("capture an app URL that isn't local (staging, production): only after the user approved it"),
    },
  },
  get_elements: {
    description: "Element ids (for cursor/focus/highlight/callout targets) of one capture, optionally filtered.",
    input: {
      captureId: z.string().describe('e.g. "routes/app-projects@desktop" or "flows/create-project@desktop/created"'),
      query: z.string().optional().describe("case-insensitive filter on id, role, name and text"),
    },
  },
  new_video: {
    description: "Scaffold a video folder (brief, storyboard, video.json, composition) from a type preset and style.",
    input: {
      slug: z.string().describe("lowercase letters, digits and dashes"),
      type: z.enum(VIDEO_TYPES),
      duration: z.number().positive().optional(),
      formats: z.array(z.string()).optional(),
      style: z.enum(STYLE_IDS).optional(),
      about: z.string().optional(),
    },
  },
  stills: {
    description: "Render still frames (and a contact sheet) and return them as images so you can look at them.",
    input: {
      slug,
      at: z.array(z.number().nonnegative()).optional().describe("times in seconds"),
      every: z.number().positive().optional().describe("one still every N seconds"),
      format: format.optional(),
      sheet: z.boolean().optional().describe("also build a contact sheet (default true)"),
      scale: z.number().positive().optional().describe("default 0.5"),
    },
  },
  qa: {
    description: "Run every QA rule; returns qa.json content with occurrences and fix hints. Sends progress.",
    input: { slug, format: format.optional(), strict: z.boolean().optional() },
  },
  audio_music: {
    description: "Music plus beats.json (synth by default: free, deterministic). ElevenLabs needs confirm: true.",
    input: {
      slug,
      bpm: z.number().min(80).max(140).optional(),
      mood: z.enum(["uplifting", "tech", "calm", "energetic", "minimal"]).optional(),
      provider: z.enum(["synth", "elevenlabs", "file"]).optional(),
      seed: z.string().optional(),
      key: z.string().optional(),
      confirm: z.boolean().optional().describe("required for paid providers, after the user approved the cost"),
    },
  },
  audio_voice: {
    description:
      "Synthesize VO lines with the user's provider key. Paid: call with confirm: false to get the estimate, ask the user, then call with confirm: true.",
    input: {
      slug,
      confirm: z.boolean(),
      provider: z.enum(["elevenlabs", "openai"]).optional(),
      voice: z.string().optional(),
      model: z.string().optional(),
    },
  },
  audio_mix: {
    description: "Mix music + VO + SFX, duck the music under VO and normalize loudness into audio/mix.wav.",
    input: { slug },
  },
  render: {
    description: "Render MP4s (and posters/captions). Long-running; sends progress notifications.",
    input: {
      slug,
      formats: z.array(z.string()).optional().describe("default: all formats in video.json"),
      quality: z.enum(["draft", "final"]).optional(),
    },
  },
  changes: {
    description: "Summarize code changes since a git ref and the routes they affect (changelog videos).",
    input: { since: z.string().optional().describe("git ref, default: the last tag") },
  },
} as const;

export type ToolName = keyof typeof TOOLS;
type Shape<N extends ToolName> = (typeof TOOLS)[N]["input"];
export type ToolArgs<N extends ToolName> = z.infer<z.ZodObject<Shape<N> extends z.ZodRawShape ? Shape<N> : never>>;

export interface ToolOutput {
  data: unknown;
  /** PNG files to return as MCP image content. */
  images?: string[];
}

export interface ToolContext {
  progress: (message: string) => void;
}

/** Implementations are injected by the CLI (DECISIONS), so this package doesn't depend on CLI code. */
export type ToolHandlers = { [N in ToolName]: (args: ToolArgs<N>, ctx: ToolContext) => Promise<ToolOutput> };

const MAX_IMAGES = 8;

export function createMcpServer(handlers: ToolHandlers, o: { version: string }): McpServer {
  const server = new McpServer({ name: "demovie", version: o.version });
  for (const name of Object.keys(TOOLS) as ToolName[]) {
    const def = TOOLS[name];
    server.registerTool(
      name,
      { description: def.description, inputSchema: def.input as z.ZodRawShape },
      async (args: Record<string, unknown>, extra): Promise<CallToolResult> => {
        const token = extra._meta?.progressToken;
        let n = 0;
        const progress = (message: string) => {
          if (token === undefined) return;
          n++;
          extra
            .sendNotification({
              method: "notifications/progress",
              params: { progressToken: token, progress: n, message },
            })
            .catch(() => {});
        };
        // forward the commands' progress lines (steps, warnings, frame counts) as MCP progress
        const stop = logger.listen((e) => {
          if (e.kind !== "debug" || /\bframes\b/.test(e.text)) progress(e.text);
        });
        try {
          const handler = handlers[name] as (a: unknown, c: ToolContext) => Promise<ToolOutput>;
          const out = await handler(args, { progress });
          const content: CallToolResult["content"] = [
            { type: "text", text: JSON.stringify(logger.maskDeep({ ok: true, ...(out.data as object) }), null, 2) },
          ];
          for (const file of (out.images ?? []).slice(0, MAX_IMAGES))
            content.push({ type: "image", data: (await readFile(file)).toString("base64"), mimeType: "image/png" });
          return { content };
        } catch (error) {
          const err = toDemovieError(error);
          return {
            isError: true,
            content: [
              { type: "text", text: JSON.stringify(logger.maskDeep({ ok: false, error: err.toJSON() }), null, 2) },
            ],
          };
        } finally {
          stop();
        }
      },
    );
  }
  return server;
}

/** `demovie mcp`: serve on stdio until the client disconnects. stdout carries only the protocol. */
export async function serveStdio(handlers: ToolHandlers, o: { version: string }): Promise<void> {
  const server = createMcpServer(handlers, o);
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
    process.stdin.once("end", () => resolve());
  });
  await server.connect(transport);
  await closed;
}
