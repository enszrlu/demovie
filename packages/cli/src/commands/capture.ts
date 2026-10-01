import { loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export interface CaptureOptions {
  route?: string[];
  flow?: string[];
  viewport?: string[];
  dark?: boolean;
  fullPage?: boolean;
  changed?: boolean;
  since?: string;
}

export async function run(ctx: CommandContext, options: CaptureOptions): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { runCapture } = await import("@demovie/capture");
  const report = await runCapture(project, {
    routes: options.route,
    flows: options.flow,
    viewports: options.viewport,
    dark: options.dark,
    fullPage: options.fullPage,
    changed: options.changed,
    since: options.since,
    yes: ctx.yes,
  });
  const redactions = report.states.reduce<Record<string, number>>((acc, s) => {
    for (const [k, v] of Object.entries(s.redactions)) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const warnings = report.states.flatMap((s) => s.warnings.map((w) => `${s.id}: ${w}`));
  const human = [
    `captured ${report.states.length} state(s) in ${(report.durationMs / 1000).toFixed(1)}s${report.flows.length ? ` · flows: ${report.flows.map((f) => `${f.name}@${f.viewport} (${f.states.length} states)`).join(", ")}` : ""}`,
    ...(Object.keys(redactions).length
      ? [
          `redacted: ${Object.entries(redactions)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}`,
        ]
      : []),
    ...report.skipped.filter((s) => s.reason !== "fresh").map((s) => `skipped ${s.what}: ${s.reason}`),
    ...(report.skipped.some((s) => s.reason === "fresh")
      ? [`${report.skipped.filter((s) => s.reason === "fresh").length} fresh state(s) kept`]
      : []),
    ...warnings.map((w) => `warn: ${w}`),
    ...(report.glossaryAdded.length
      ? [`glossary: +${report.glossaryAdded.length} discovered label(s) in .demovie/glossary.md`]
      : []),
    "Next: open the captured screen.png files and look at them before storyboarding (.demovie/captures/)",
  ];
  return { data: { ...report, captures: report.states.map((s) => s.id) }, human };
}
