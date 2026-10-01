import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assetDir, type FormatId, type Project, sha256 } from "@demovie/core";
import type { Browser } from "playwright-core";
import type { StaticServer } from "./server.ts";
import { type CompositionPage, capture, openComposition, seek } from "./session.ts";
import type { VideoContext } from "./video-dir.ts";

export function defaultWorkers(): number {
  return Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)));
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

/**
 * Render id = hash of the composition, the captures it uses, video.json, brand, beats/voice manifests, the runtime,
 * format, scale, fps and frame type (SPEC §11.2). Re-running with the same id skips frames that exist.
 */
export async function renderId(
  project: Pick<Project, "paths">,
  video: VideoContext,
  o: { format: FormatId; scale: number; fps: number; type: "png" | "jpeg" },
): Promise<string> {
  const parts: string[] = [JSON.stringify(o)];
  const add = async (file: string) => {
    if (existsSync(file)) parts.push(`${path.basename(file)}:${sha256(await readFile(file))}`);
  };
  for (const f of filesUnder(video.compositionDir)) await add(f);
  // video.json without `status`: a final render marks it "rendered", which must not invalidate the frames.
  const { status: _status, ...videoWithoutStatus } = JSON.parse(await readFile(video.videoFile, "utf8")) as Record<
    string,
    unknown
  >;
  parts.push(`video.json:${sha256(JSON.stringify(videoWithoutStatus))}`);
  await add(project.paths.brandJson);
  await add(project.paths.glossaryJson);
  for (const f of ["beats.json", "voice.json"]) await add(path.join(video.audioDir, f));
  for (const id of video.video.captures) {
    for (const f of ["meta.json", "elements.json", "screen.png", "full.png"])
      await add(path.join(project.paths.capturesDir, id, f));
  }
  for (const f of ["runtime.js", "clock.js", "runtime.css", `styles/${video.video.style}.css`])
    await add(path.join(assetDir("runtime"), f));
  return sha256(parts.join("\n")).slice(0, 16);
}

export interface FramesResult {
  dir: string;
  count: number;
  ext: "png" | "jpg";
  rendered: number;
  reused: number;
  console: CompositionPage["console"];
  blocked: string[];
  failed: CompositionPage["failed"];
}

export interface FramesOptions {
  browser: Browser;
  server: StaticServer;
  format: FormatId;
  scale: number;
  fps: number;
  duration: number;
  type: "png" | "jpeg";
  dir: string;
  workers: number;
  onProgress?: (done: number, total: number) => void;
}

/** Step frames with N pages over contiguous ranges; frame i is `seek(i / fps)` + a CDP screenshot. */
export async function renderFrames(o: FramesOptions): Promise<FramesResult> {
  await mkdir(o.dir, { recursive: true });
  const count = Math.round(o.duration * o.fps);
  const ext = o.type === "png" ? "png" : "jpg";
  const frameFile = (i: number) => path.join(o.dir, `${String(i).padStart(6, "0")}.${ext}`);
  const todo = Array.from({ length: count }, (_, i) => i).filter((i) => !existsSync(frameFile(i)));
  const result: FramesResult = {
    dir: o.dir,
    count,
    ext,
    rendered: todo.length,
    reused: count - todo.length,
    console: [],
    blocked: [],
    failed: [],
  };
  if (todo.length === 0) return result;
  const workers = Math.max(1, Math.min(o.workers, todo.length));
  const chunk = Math.ceil(todo.length / workers);
  let done = count - todo.length;
  await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      const range = todo.slice(w * chunk, (w + 1) * chunk);
      if (range.length === 0) return;
      const comp = await openComposition(o.browser, o.server, { format: o.format, scale: o.scale });
      try {
        for (const i of range) {
          await seek(comp.page, i / o.fps);
          await writeFile(frameFile(i), await capture(comp, o.type));
          done++;
          o.onProgress?.(done, count);
        }
      } finally {
        result.console.push(...comp.console);
        result.blocked.push(...comp.blocked);
        result.failed.push(...comp.failed);
        await comp.close();
      }
    }),
  );
  return result;
}
