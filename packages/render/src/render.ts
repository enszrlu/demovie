import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type FormatId, formatSlug, logger, type Project, VideoSchema, writeJson } from "@demovie/core";
import { encodeGif, encodeMp4, encodeWebm, type H264Encoder, probe } from "./encode.ts";
import { defaultWorkers, renderFrames, renderId } from "./frames.ts";
import { startServer } from "./server.ts";
import { capture, launchRenderer, openComposition, seek } from "./session.ts";
import type { VideoContext } from "./video-dir.ts";

export interface RenderOptions {
  formats: FormatId[];
  quality: "draft" | "final";
  scale?: number | undefined;
  fps?: number | undefined;
  gif?: boolean | undefined;
  webm?: boolean | undefined;
  workers?: number | undefined;
  onProgress?: ((format: FormatId, done: number, total: number) => void) | undefined;
}

export interface RenderedFormat {
  format: FormatId;
  file: string;
  poster: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  size: number;
  encoder: H264Encoder;
  frames: number;
  renderedFrames: number;
  reusedFrames: number;
  ms: number;
}

export interface RenderReport {
  slug: string;
  quality: "draft" | "final";
  scale: number;
  fps: number;
  outputs: RenderedFormat[];
  gif: string | null;
  webm: string[];
  captions: string[];
  audio: string | null;
  warnings: string[];
  ms: number;
}

export function outputName(slug: string, format: FormatId, quality: "draft" | "final"): string {
  return `${slug}-${formatSlug(format)}${quality === "draft" ? ".draft" : ""}.mp4`;
}

/** Render MP4s for each format (SPEC §11.2–11.3). */
export async function render(project: Project, video: VideoContext, options: RenderOptions): Promise<RenderReport> {
  const started = Date.now();
  const v = video.video;
  const draft = options.quality === "draft";
  const scale = options.scale ?? (draft ? 0.5 : 1);
  const fps = options.fps ?? (draft ? 15 : v.fps);
  const type = draft ? "jpeg" : "png";
  const mix = path.join(video.audioDir, "mix.wav");
  const audio = existsSync(mix) ? mix : null;
  await mkdir(video.outDir, { recursive: true });
  const report: RenderReport = {
    slug: video.slug,
    quality: options.quality,
    scale,
    fps,
    outputs: [],
    gif: null,
    webm: [],
    captions: [],
    audio,
    warnings: [],
    ms: 0,
  };
  const server = await startServer({ project, video });
  const browser = await launchRenderer();
  try {
    for (const format of options.formats) {
      const t0 = Date.now();
      const id = await renderId(project, video, { format, scale, fps, type });
      const dir = path.join(project.paths.cacheDir, "frames", id, formatSlug(format));
      const frames = await renderFrames({
        browser,
        server,
        format,
        scale,
        fps,
        duration: v.duration,
        type,
        dir,
        workers: options.workers ?? defaultWorkers(),
        onProgress: (done, total) => options.onProgress?.(format, done, total),
      });
      for (const url of frames.blocked) report.warnings.push(`${format}: blocked external request ${url}`);
      for (const f of frames.failed) report.warnings.push(`${format}: ${f.status ?? "failed"} ${f.url}`);
      const file = path.join(video.outDir, outputName(video.slug, format, options.quality));
      const { encoder } = await encodeMp4({
        framesDir: frames.dir,
        ext: frames.ext,
        fps,
        duration: v.duration,
        audio,
        out: file,
        quality: options.quality,
      });
      // Poster: a full-quality frame at video.json.poster, or 40% of the duration.
      const posterAt = v.poster ?? Math.round(v.duration * 0.4 * fps) / fps;
      const comp = await openComposition(browser, server, { format, scale: draft ? scale : Math.max(scale, 1) });
      await seek(comp.page, posterAt);
      const poster = path.join(video.outDir, `poster-${formatSlug(format)}${draft ? ".draft" : ""}.png`);
      await writeFile(poster, await capture(comp, "png"));
      await comp.close();
      const info = await probe(file);
      report.outputs.push({
        format,
        file,
        poster,
        width: info.width,
        height: info.height,
        fps: info.fps,
        duration: info.duration,
        size: info.size,
        encoder,
        frames: frames.count,
        renderedFrames: frames.rendered,
        reusedFrames: frames.reused,
        ms: Date.now() - t0,
      });
      logger.step(
        `${format}: ${path.basename(file)} (${frames.count} frames, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${encoder})`,
      );
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const first = report.outputs[0];
  if (options.gif && first) {
    const gif = path.join(video.outDir, "preview.gif");
    await encodeGif(first.file, gif);
    report.gif = gif;
  }
  if (options.webm) {
    for (const o of report.outputs) {
      const webm = o.file.replace(/\.mp4$/, ".webm");
      await encodeWebm(o.file, webm);
      report.webm.push(webm);
    }
  }
  report.captions = await writeCaptionSidecars(video);
  if (!draft) {
    const raw = JSON.parse(await readFile(video.videoFile, "utf8"));
    if (raw.status !== "rendered") {
      raw.status = "rendered";
      VideoSchema.parse(raw);
      await writeJson(video.videoFile, raw);
    }
  }
  report.ms = Date.now() - started;
  return report;
}

/** captions.vtt and .srt from audio/voice.json when there is voice (SPEC §11.5). */
export async function writeCaptionSidecars(video: VideoContext): Promise<string[]> {
  const manifest = path.join(video.audioDir, "voice.json");
  if (!existsSync(manifest)) return [];
  const { captionsFromManifest } = await import("./captions.ts");
  const data = JSON.parse(await readFile(manifest, "utf8"));
  const { vtt, srt } = captionsFromManifest(data);
  const vttFile = path.join(video.outDir, "captions.vtt");
  const srtFile = path.join(video.outDir, "captions.srt");
  await writeFile(vttFile, vtt);
  await writeFile(srtFile, srt);
  return [vttFile, srtFile];
}
