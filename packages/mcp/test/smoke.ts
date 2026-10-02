/**
 * MCP smoke test (SPEC §18): an SDK client starts `demovie mcp` on stdio, lists the tools and calls `status` and
 * `stills`. Shared by packages/mcp/test/mcp.int.test.ts (source) and `pnpm verify` check 9 (built CLI).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const EXPECTED_TOOLS = [
  "audio_mix",
  "audio_music",
  "audio_voice",
  "capture",
  "changes",
  "extract",
  "get_elements",
  "init_check",
  "list_captures",
  "list_routes",
  "new_video",
  "qa",
  "render",
  "status",
  "stills",
];

export interface SmokeResult {
  tools: string[];
  status: Record<string, unknown>;
  stills: Record<string, unknown>;
  image: { mimeType: string; bytes: number } | null;
  progress: number;
  stderr: string;
}

export async function runMcpSmoke(o: {
  command: string;
  args: string[];
  cwd: string;
  stillsSlug: string;
  format?: string;
}): Promise<SmokeResult> {
  const transport = new StdioClientTransport({ command: o.command, args: o.args, cwd: o.cwd, stderr: "pipe" });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: "demovie-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    const text = (r: Record<string, unknown>) =>
      JSON.parse(((r.content ?? []) as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}");
    const status = text(await client.callTool({ name: "status", arguments: {} }));
    let progress = 0;
    const result = await client.callTool(
      { name: "stills", arguments: { slug: o.stillsSlug, at: [1], ...(o.format ? { format: o.format } : {}) } },
      undefined,
      {
        timeout: 180_000,
        onprogress: () => {
          progress++;
        },
      },
    );
    const image = ((result.content ?? []) as { type: string; data?: string; mimeType?: string }[]).find(
      (c) => c.type === "image",
    );
    return {
      tools,
      status,
      stills: text(result),
      image: image ? { mimeType: image.mimeType ?? "", bytes: Buffer.from(image.data ?? "", "base64").length } : null,
      progress,
      stderr,
    };
  } finally {
    await client.close();
  }
}
