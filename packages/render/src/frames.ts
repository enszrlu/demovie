import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assetDir, type FormatId, type Project, sha256, toPosix } from "@demovie/core";
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

/** Capture ids found in files under `dir`: compositions reference captures by literal id. */
function referencedCaptures(dir: string, known: string[]): string[] {
  const text = filesUnder(dir)
    .filter((f) => /\.(js|mjs|ts|html|css|json)$/.test(f))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  return known.filter((id) => text.includes(id));
}

/** Capture ids under captures/ (folders holding a meta.json). */
function knownCaptures(capturesDir: string): string[] {
  return filesUnder(capturesDir)
    .filter((f) => path.basename(f) === "meta.json")
    .map((f) => toPosix(path.relative(capturesDir, path.dirname(f))));
}

/**
 * Render id = hash of everything a frame can show (SPEC §11.2): the composition, video.json, the brand folder (logos,
 * fonts), assets, the glossary, beats/voice manifests, the runtime, every capture's element map and the screenshots of
 * the captures the video declares or its composition names, plus format, scale, fps and frame type. Re-running with
 * the same id skips frames that exist.
 */
export async function renderId(
  project: Pick<Project, "paths">,
  video: VideoContext,
  o: { format: FormatId; scale: number; fps: number; type: "png" | "jpeg" },
): Promise<string> {
  const parts: string[] = [JSON.stringify(o)];
  const add = async (file: string) => {
    if (existsSync(file))
      parts.push(`${toPosix(path.relative(project.paths.dir, file))}:${sha256(await readFile(file))}`);
  };
  for (const f of filesUnder(video.compositionDir)) await add(f);
  // video.json without `status` (a final render marks it "rendered") and without soundtrack-only settings (SFX cues,
  // gains, loudness): neither changes a frame. The beats/voice manifests themselves are hashed below.
  const { status: _status, ...videoForFrames } = JSON.parse(await readFile(video.videoFile, "utf8")) as Record<
    string,
    unknown
  >;
  const audio = (videoForFrames.audio ?? {}) as { music?: { beats?: string | null } | null; voice?: unknown };
  videoForFrames.audio = { beats: audio.music?.beats ?? null, voice: audio.voice ?? null };
  parts.push(`video.json:${sha256(JSON.stringify(videoForFrames))}`);
  for (const f of filesUnder(project.paths.brandDir)) await add(f);
  for (const f of filesUnder(project.paths.assetsDir)) await add(f);
  await add(project.paths.glossaryJson);
  for (const f of ["beats.json", "voice.json"]) await add(path.join(video.audioDir, f));
  // Every capture's meta and element map reach the page (/__demovie/captures.json); screenshots only when used.
  const known = knownCaptures(project.paths.capturesDir);
  for (const id of known)
    for (const f of ["meta.json", "elements.json"]) await add(path.join(project.paths.capturesDir, id, f));
  const shown = new Set([...video.video.captures, ...referencedCaptures(video.compositionDir, known)]);
  for (const id of [...shown].sort())
    for (const f of ["screen.png", "full.png"]) await add(path.join(project.paths.capturesDir, id, f));
  for (const f of ["runtime.js", "clock.js", "runtime.css", `styles/${video.video.style}.css`])
    await add(path.join(assetDir("runtime"), f));
  return sha256(parts.join("\n")).slice(0, 16);
}

const OWNER_FILE = "video.txt";

/** Mark a frame set (`.cache/frames/<id>`) with the video it belongs to, for pruning. */
export async function markFrames(project: Pick<Project, "paths">, video: VideoContext, id: string): Promise<void> {
  const dir = path.join(project.paths.cacheDir, "frames", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, OWNER_FILE), `${toPosix(path.relative(project.paths.dir, video.dir))}\n`);
}

/** Delete this video's earlier frame sets, keeping `keep` (the ids just rendered). Returns how many were removed. */
export async function pruneFrames(
  project: Pick<Project, "paths">,
  video: VideoContext,
  keep: Set<string>,
): Promise<number> {
  const root = path.join(project.paths.cacheDir, "frames");
  if (!existsSync(root)) return 0;
  const owner = toPosix(path.relative(project.paths.dir, video.dir));
  let removed = 0;
  for (const id of readdirSync(root)) {
    if (keep.has(id)) continue;
    const marker = path.join(root, id, OWNER_FILE);
    if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== owner) continue;
    await rm(path.join(root, id), { recursive: true, force: true });
    removed++;
  }
  return removed;
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
          // write, then rename: a frame cut short (a kill, a full disk) is never reused as if it were complete
          const tmp = `${frameFile(i)}.tmp`;
          await writeFile(tmp, await capture(comp, o.type));
          await rename(tmp, frameFile(i));
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
