import { spawn } from "node:child_process";
import { loadProject } from "@demovie/core";
import getPort from "get-port";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(
  ctx: CommandContext,
  slug: string,
  options: { port?: number; open?: boolean },
): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { resolveVideo, startPreview } = await import("@demovie/render");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const port = await getPort({
    port: [options.port ?? 4400, ...Array.from({ length: 20 }, (_, i) => (options.port ?? 4400) + i + 1)],
    host: "127.0.0.1",
  });
  const preview = await startPreview(project, video, { port });
  if (ctx.json) process.stdout.write(`${JSON.stringify({ ok: true, url: preview.url })}\n`);
  else process.stdout.write(`preview: ${preview.url}  (hot reload on; Ctrl+C to stop)\n`);
  if (options.open !== false && ctx.interactive) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    // no opener (WSL, SSH, a container): the URL is printed above, so just skip it
    spawn(opener, [preview.url], { stdio: "ignore", detached: true, shell: process.platform === "win32" })
      .on("error", () => {})
      .unref();
  }
  await new Promise<void>((resolve) => {
    const stop = () => resolve();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await preview.close();
  // With --json the one document was printed when the server started (agents need the URL then).
  return { data: { url: preview.url, stopped: true }, human: [], emitted: ctx.json };
}
