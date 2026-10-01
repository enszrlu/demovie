import path from "node:path";
import { DemovieError, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(
  ctx: CommandContext,
  slug: string,
  options: { format?: string; strict?: boolean; fps?: number },
): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { resolveVideo, selectFormats } = await import("@demovie/render");
  const { runQa } = await import("@demovie/qa");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const formats = selectFormats(video.video, options.format);
  if (options.fps !== undefined && !(options.fps >= 1 && options.fps <= video.video.fps)) {
    throw new DemovieError(
      "E_USAGE",
      `--fps ${options.fps} is outside 1–${video.video.fps}`,
      `pass --fps between 1 and the video's ${video.video.fps} fps (default 10)`,
    );
  }
  const qa = await runQa(project, video, {
    formats,
    strict: options.strict,
    sampleFps: options.fps,
    onFormat: (f) => ctx.logger.step(`QA ${video.slug} @ ${f}…`),
  });
  const human: string[] = [];
  for (const report of qa.reports) {
    human.push(
      `${report.format}: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s), ${report.summary.waived} waived`,
    );
    for (const rule of report.rules.filter((r) => r.status === "fail" || r.status === "waived")) {
      const tag = rule.status === "waived" ? "waived" : rule.severity === "error" ? "ERROR " : "warn  ";
      human.push(
        `  ${tag} ${rule.id} ${rule.title}: ${rule.message}${rule.occurrences.length > 1 ? ` (+${rule.occurrences.length - 1} more)` : ""}`,
      );
      if (rule.status === "fail") human.push(`         fix: ${rule.fix}`);
    }
  }
  human.push(
    qa.summary.errors === 0
      ? `QA passed with 0 errors (${qa.summary.warnings} warning(s)) → ${path.relative(ctx.cwd, path.join(video.dir, "qa.json"))}`
      : `QA failed: ${qa.summary.errors} error(s) → ${path.relative(ctx.cwd, path.join(video.dir, "qa.json"))}`,
  );
  return { data: qa, human, exitCode: qa.summary.errors > 0 ? 1 : 0 };
}
