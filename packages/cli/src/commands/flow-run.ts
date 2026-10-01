import { loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(ctx: CommandContext, name: string): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { runCapture } = await import("@demovie/capture");
  const report = await runCapture(project, { flows: [name], flowsOnly: true, yes: ctx.yes });
  const flow = report.flows[0];
  return {
    data: report,
    human: [
      `flow ${name}: ${flow?.states.length ?? 0} states, ${flow?.steps ?? 0} steps in ${(report.durationMs / 1000).toFixed(1)}s`,
      ...report.states.map((s) => `  ${s.id}`),
    ],
  };
}
