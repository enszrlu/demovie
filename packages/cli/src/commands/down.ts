import { loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(ctx: CommandContext): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { stopApp } = await import("@demovie/capture");
  const result = await stopApp(project);
  return {
    data: result,
    human: result.pid
      ? `stopped the app (pid ${result.pid})`
      : "nothing to stop: `demovie up` didn't start an app here",
  };
}
