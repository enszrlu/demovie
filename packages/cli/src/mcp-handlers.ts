import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  CaptureMetaSchema,
  DemovieError,
  ElementMapSchema,
  findProjectRoot,
  isInside,
  loadProject,
  RoutesSchema,
  readJson,
} from "@demovie/core";
import type { ToolHandlers, ToolOutput } from "@demovie/mcp";
import { type CommandName, commandLoaders } from "./commands/index.ts";
import { type CommandContext, createContext } from "./context.ts";
import type { CommandResult } from "./output.ts";

/**
 * MCP inputs only name things inside the project: a slug is a plain name or a path inside the project folder (never
 * `../elsewhere`), and a capture id stays under captures/.
 */
function inside(root: string, cwd: string, value: string, what: string): string {
  if (/^[a-z0-9][a-z0-9-]*$/.test(value)) return value;
  if (isInside(root, path.resolve(cwd, value))) return value;
  throw new DemovieError(
    "E_USAGE",
    `${what} "${value}" is outside the project`,
    `pass a video slug (e.g. "launch") or a path inside ${root}`,
  );
}

/** A JSON-mode context; `yes` only when the caller confirmed (paid calls) or the tool never asks. */
function contextFor(cwd: string, yes: boolean): CommandContext {
  return { ...createContext({ cwd, json: true }), yes, confirmed: yes, interactive: false };
}

async function call(name: CommandName, ctx: CommandContext, ...args: unknown[]): Promise<Record<string, unknown>> {
  const mod = await commandLoaders[name]();
  const run = mod.run as (c: CommandContext, ...rest: unknown[]) => Promise<CommandResult>;
  const result = await run(ctx, ...args);
  return result.data as Record<string, unknown>;
}

function captureDirs(capturesDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    if (existsSync(path.join(dir, "meta.json"))) out.push(dir);
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
    }
  };
  walk(capturesDir);
  return out.sort();
}

/** MCP tool implementations backed by the CLI commands (SPEC §14.3). */
export function mcpHandlers(cwd: string): ToolHandlers {
  const data = (d: unknown): ToolOutput => ({ data: d });
  const slug = (value: string) => inside(findProjectRoot(cwd) ?? cwd, cwd, value, "slug");
  return {
    status: async () => data(await call("status", contextFor(cwd, true))),

    init_check: async () => {
      if (!findProjectRoot(cwd))
        return data({
          initialized: false,
          missing: [
            { id: "config", message: "no .demovie/config.json", fix: "run `npx demovie init` (or `init --yes`)" },
          ],
          next: "npx demovie init",
        });
      const doctor = (await call("doctor", contextFor(cwd, true), { fix: false })) as {
        checks: { id: string; status: string; message: string; fix?: string }[];
      };
      const missing = doctor.checks.filter((c) => c.status === "fail");
      const warnings = doctor.checks.filter((c) => c.status === "warn");
      return data({
        initialized: true,
        ready: missing.length === 0,
        missing,
        warnings,
        next: missing[0]?.fix ?? warnings[0]?.fix ?? "npx demovie status",
      });
    },

    extract: async (a) => data(await call("extract", contextFor(cwd, true), a.what ?? "all")),

    list_routes: async () => {
      const project = await loadProject(cwd);
      if (!existsSync(project.paths.routes))
        throw new DemovieError("E_NOT_FOUND", "no .demovie/routes.json yet", "run `npx demovie extract routes`");
      return data(await readJson(project.paths.routes, RoutesSchema));
    },

    list_captures: async () => {
      const project = await loadProject(cwd);
      const { captureFreshness } = await import("@demovie/capture");
      const fresh = await captureFreshness(project);
      const stale = new Set(fresh.stale.map((s) => s.id));
      const captures = [];
      for (const dir of captureDirs(project.paths.capturesDir)) {
        const meta = await readJson(path.join(dir, "meta.json"), CaptureMetaSchema);
        captures.push({
          id: meta.id,
          kind: meta.kind,
          path: meta.path,
          route: meta.route,
          flow: meta.flow,
          step: meta.step,
          title: meta.title,
          viewport: meta.viewport.name,
          colorScheme: meta.colorScheme,
          capturedAt: meta.capturedAt,
          stale: stale.has(meta.id),
          screen: path.relative(cwd, path.join(dir, "screen.png")),
        });
      }
      return data({ total: captures.length, stale: stale.size, captures });
    },

    // The non-local app URL guard (SPEC §9.1) needs the user's approval: allowRemote, never an implicit yes.
    capture: async (a) =>
      data(
        await call("capture", contextFor(cwd, a.allowRemote === true), {
          route: a.routes,
          flow: a.flows,
          viewport: a.viewports,
          changed: Boolean(a.changedSince),
          since: a.changedSince,
        }),
      ),

    get_elements: async (a) => {
      const project = await loadProject(cwd);
      const file = path.join(project.paths.capturesDir, a.captureId, "elements.json");
      if (!isInside(project.paths.capturesDir, file))
        throw new DemovieError(
          "E_USAGE",
          `capture id "${a.captureId}" is outside captures/`,
          "call list_captures for valid ids",
        );
      if (!existsSync(file))
        throw new DemovieError(
          "E_NOT_FOUND",
          `no capture "${a.captureId}"`,
          "call list_captures for valid ids, or capture the state first",
        );
      const map = await readJson(file, ElementMapSchema);
      const q = a.query?.toLowerCase();
      const matches = map.elements.filter(
        (e) => !q || [e.id, e.role, e.name, e.text ?? ""].some((s) => s.toLowerCase().includes(q)),
      );
      return data({
        captureId: map.captureId,
        viewport: map.viewport,
        total: matches.length,
        elements: matches.slice(0, 200).map((e) => ({
          id: e.id,
          role: e.role,
          name: e.name,
          ...(e.text ? { text: e.text } : {}),
          bbox: e.bbox,
          visible: e.visible,
          interactive: e.interactive,
          ...(e.landmark ? { landmark: e.landmark } : {}),
        })),
      });
    },

    new_video: async (a) =>
      data(
        await call("new", contextFor(cwd, true), slug(a.slug), {
          type: a.type,
          duration: a.duration,
          format: a.formats,
          style: a.style,
          about: a.about,
        }),
      ),

    stills: async (a) => {
      const sheet = a.sheet ?? true;
      const result = (await call("stills", contextFor(cwd, true), slug(a.slug), {
        at: a.at?.map(String),
        every: a.every ?? (a.at?.length ? undefined : 1),
        format: a.format,
        sheet,
        scale: a.scale,
      })) as { stills: { file: string }[]; sheets: { file: string }[] };
      const files = sheet && result.sheets.length ? result.sheets : result.stills;
      return { data: result, images: files.map((f) => path.resolve(cwd, f.file)) };
    },

    qa: async (a) =>
      data(await call("qa", contextFor(cwd, true), slug(a.slug), { format: a.format, strict: a.strict })),

    audio_music: async (a) =>
      data(
        await call("audio-music", contextFor(cwd, a.confirm === true), slug(a.slug), {
          bpm: a.bpm,
          mood: a.mood,
          provider: a.provider,
          seed: a.seed,
          key: a.key,
        }),
      ),

    audio_voice: async (a) => {
      try {
        return data(
          await call("audio-voice", contextFor(cwd, a.confirm), slug(a.slug), {
            provider: a.provider,
            voice: a.voice,
            model: a.model,
          }),
        );
      } catch (error) {
        if (
          !a.confirm &&
          error instanceof DemovieError &&
          error.code === "E_USAGE" &&
          /confirmation/.test(error.message)
        )
          throw new DemovieError(
            "E_USAGE",
            error.message,
            "show this estimate to the user; if they approve, call audio_voice again with confirm: true",
          );
        throw error;
      }
    },

    audio_mix: async (a) => data(await call("audio-mix", contextFor(cwd, true), slug(a.slug))),

    render: async (a) =>
      data(
        await call("render", contextFor(cwd, true), slug(a.slug), {
          format: a.formats?.length ? a.formats.join(",") : "all",
          quality: a.quality ?? "final",
        }),
      ),

    changes: async (a) => data(await call("changes", contextFor(cwd, true), { since: a.since })),
  };
}
