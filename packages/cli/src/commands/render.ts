import path from "node:path";
import { loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export interface RenderCliOptions {
  format?: string;
  quality?: "draft" | "final";
  scale?: number;
  fps?: number;
  gif?: boolean;
  webm?: boolean;
  workers?: number;
}

export async function run(ctx: CommandContext, slug: string, options: RenderCliOptions): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { render, resolveVideo, selectFormats } = await import("@demovie/render");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const formats = selectFormats(video.video, options.format);
  let last = 0;
  const report = await render(project, video, {
    formats,
    quality: options.quality ?? "final",
    scale: options.scale,
    fps: options.fps,
    gif: options.gif,
    webm: options.webm,
    workers: options.workers,
    onProgress: (format, done, total) => {
      const pct = Math.floor((done / total) * 10);
      if (pct !== last || done === total) {
        last = pct;
        ctx.logger.debug(`${format}: ${done}/${total} frames`);
      }
    },
  });
  const rel = (f: string) => path.relative(ctx.cwd, f);
  const human = [
    ...report.outputs.map(
      (o) =>
        `${rel(o.file)} · ${o.width}×${o.height} · ${o.fps} fps · ${o.duration.toFixed(2)} s · ${(o.size / 1024 / 1024).toFixed(1)} MB · ${o.encoder} · ${(o.ms / 1000).toFixed(1)} s`,
    ),
    ...(report.gif ? [`${rel(report.gif)}`] : []),
    ...report.webm.map(rel),
    ...report.captions.map(rel),
    ...report.warnings.map((w) => `warn: ${w}`),
    `audio: ${report.audio ? rel(report.audio) : "silent track (no audio/mix.wav)"} · total ${(report.ms / 1000).toFixed(1)} s`,
  ];
  return {
    data: { ...report, outputs: report.outputs.map((o) => ({ ...o, file: rel(o.file), poster: rel(o.poster) })) },
    human,
  };
}
