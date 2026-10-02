import path from "node:path";
import { DemovieError, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(
  ctx: CommandContext,
  slug: string,
  options: { at?: string[]; every?: number; format?: string; sheet?: boolean; scale?: number },
): Promise<CommandResult> {
  if (!options.at?.length && !options.every) {
    throw new DemovieError(
      "E_USAGE",
      "stills needs --at <t,…> or --every <seconds>",
      `e.g. \`npx demovie stills ${slug} --every 1 --sheet\``,
    );
  }
  const project = await loadProject(ctx.cwd);
  const { everyTimes, renderStills, resolveVideo, selectFormats } = await import("@demovie/render");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const formats = options.format ? selectFormats(video.video, options.format) : [video.video.formats[0]!];
  const times = options.at?.length
    ? options.at.map((t) => {
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0 || n > video.video.duration)
          throw new DemovieError(
            "E_USAGE",
            `invalid time "${t}" (0–${video.video.duration}s)`,
            "pass seconds, e.g. --at 1.5,4,12",
          );
        return n;
      })
    : everyTimes(video.video.duration, options.every!, video.video.fps);
  ctx.logger.step(`stills ${video.slug} @ ${formats.join(", ")}: ${times.length} time(s)…`);
  const report = await renderStills(project, video, {
    formats,
    times,
    scale: options.scale ?? 0.5,
    sheet: Boolean(options.sheet),
  });
  const rel = (f: string) => path.relative(ctx.cwd, f);
  return {
    data: {
      ...report,
      stills: report.stills.map((s) => ({ ...s, file: rel(s.file) })),
      sheets: report.sheets.map((s) => ({ ...s, file: rel(s.file) })),
    },
    human: [
      `${report.stills.length} still(s) in ${(report.ms / 1000).toFixed(1)} s → ${rel(path.dirname(report.stills[0]?.file ?? video.outDir))}`,
      ...report.sheets.map((s) => `contact sheet (${s.format}): ${rel(s.file)}`),
      "Open the PNGs and look at them before moving on.",
    ],
  };
}
