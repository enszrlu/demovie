import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  FORMATS,
  type FormatId,
  GlossarySchema,
  type Project,
  ProvenanceSchema,
  VoiceManifestSchema,
} from "@demovie/core";
import {
  type CompositionPage,
  captureBundle,
  measureLoudness,
  openComposition,
  type StaticServer,
  screenshot,
  seek,
  type VideoContext,
} from "@demovie/render";
import pixelmatch from "pixelmatch";
import type { Browser } from "playwright-core";
import { PNG } from "pngjs";
import type { AudioFacts, InspectData, Pixels, QaInputs, Sample } from "./types.ts";
import { buildVocabulary } from "./vocabulary.ts";

const AUDIO = /\.(wav|mp3|m4a|aac|ogg|flac|opus)$/i;

async function inspectAt(comp: CompositionPage, t: number): Promise<InspectData> {
  await seek(comp.page, t);
  return (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as InspectData;
}

async function pixelsOf(comp: CompositionPage, scale: number): Promise<Pixels> {
  const size = FORMATS[comp.format];
  const png = PNG.sync.read(await screenshot(comp.cdp, "png", 92, { width: size.width, height: size.height, scale }));
  return { width: png.width, height: png.height, scale, data: png.data };
}

function diffRatio(a: Pixels, b: Pixels): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  return pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0 }) / (a.width * a.height);
}

/** Sample times at `fps`, plus the last frame of the video. */
export function sampleTimes(duration: number, sampleFps: number, videoFps: number): number[] {
  const times: number[] = [];
  const last = Math.max(0, duration - 1 / videoFps);
  for (let i = 0; i / sampleFps < last - 1e-9; i++) times.push(Math.round((i / sampleFps) * 1000) / 1000);
  times.push(Math.round(last * 1000) / 1000);
  return times;
}

function filesUnder(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

export async function audioFacts(video: VideoContext): Promise<AudioFacts> {
  const files = filesUnder(video.audioDir).filter((f) => AUDIO.test(f));
  const provFile = path.join(video.audioDir, "provenance.json");
  const provenance = existsSync(provFile)
    ? ProvenanceSchema.parse(JSON.parse(readFileSync(provFile, "utf8"))).files
    : [];
  const mix = path.join(video.audioDir, "mix.wav");
  const voiceFile = path.join(video.audioDir, "voice.json");
  return {
    files,
    provenance,
    loudness: existsSync(mix) ? await measureLoudness(mix) : null,
    target: { lufs: video.video.audio.loudness.targetLufs, truePeak: video.video.audio.loudness.truePeak },
    voice: existsSync(voiceFile) ? VoiceManifestSchema.parse(JSON.parse(readFileSync(voiceFile, "utf8"))) : null,
  };
}

/** Glossary + brief + captured UI text the composition may draw words and numbers from. */
export async function vocabularyFor(
  project: Pick<Project, "paths">,
  video: VideoContext,
  captureIds: Iterable<string>,
) {
  const glossary = existsSync(project.paths.glossaryJson)
    ? GlossarySchema.parse(JSON.parse(readFileSync(project.paths.glossaryJson, "utf8")))
    : null;
  const briefFile = path.join(video.dir, "brief.md");
  const brief = existsSync(briefFile) ? readFileSync(briefFile, "utf8") : "";
  const bundle = await captureBundle(project.paths.capturesDir);
  const wanted = new Set(captureIds);
  const ui: string[] = [];
  for (const [id, c] of Object.entries(bundle.captures)) {
    if (wanted.size && !wanted.has(id)) continue;
    for (const e of (c.elements as { elements: { name: string; text?: string; value?: string }[] }).elements)
      ui.push(e.name, e.text ?? "", e.value ?? "");
  }
  return buildVocabulary(glossary, brief, ui);
}

export interface CollectOptions {
  browser: Browser;
  server: StaticServer;
  format: FormatId;
  sampleFps: number;
  pixelScale?: number;
}

/** Load the composition exactly as the renderer does and gather everything the rules need (SPEC §12). */
export async function collect(project: Project, video: VideoContext, o: CollectOptions): Promise<QaInputs> {
  const pixelScale = o.pixelScale ?? 0.5;
  const v = video.video;
  const comp = await openComposition(o.browser, o.server, { format: o.format, scale: 1 });
  const samples: Sample[] = [];
  let clicks: InspectData["clicks"] = [];
  let determinism: QaInputs["determinism"] = null;
  let loop: QaInputs["loop"] = null;
  const blocked: string[] = [];
  const failed: QaInputs["network"]["failed"] = [];
  try {
    for (const t of sampleTimes(v.duration, o.sampleFps, v.fps)) {
      const inspect = await inspectAt(comp, t);
      samples.push({ t, inspect, pixels: await pixelsOf(comp, pixelScale) });
    }
    // Clicks are judged exactly at their own time, under the screen transform of that moment.
    const declared = samples[0]?.inspect.clicks ?? [];
    clicks = [];
    for (const c of declared) {
      const at = await inspectAt(comp, c.at);
      clicks.push(at.clicks.find((x) => x.at === c.at && x.elementId === c.elementId) ?? c);
    }
    // DM-R01: five frames, rendered again on a fresh page in a different order.
    const times = [0.15, 0.35, 0.55, 0.75, 0.92].map((f) => Math.round(f * v.duration * v.fps) / v.fps);
    const first: Pixels[] = [];
    for (const t of times) {
      await seek(comp.page, t);
      first.push(await pixelsOf(comp, pixelScale));
    }
    const other = await openComposition(o.browser, o.server, { format: o.format, scale: 1 });
    try {
      await seek(other.page, v.duration - 1 / v.fps);
      const mismatches: { t: number; diffRatio: number }[] = [];
      for (let i = times.length - 1; i >= 0; i--) {
        await seek(other.page, times[i]!);
        const ratio = diffRatio(first[i]!, await pixelsOf(other, pixelScale));
        if (ratio > 0) mismatches.push({ t: times[i]!, diffRatio: ratio });
      }
      determinism = { times, mismatches };
      blocked.push(...other.blocked);
      failed.push(...other.failed);
    } finally {
      await other.close();
    }
    if (v.type === "hero-loop") {
      await seek(comp.page, 0);
      const a = await pixelsOf(comp, pixelScale);
      await seek(comp.page, v.duration);
      loop = { diffRatio: diffRatio(a, await pixelsOf(comp, pixelScale)) };
    }
  } finally {
    blocked.push(...comp.blocked);
    failed.push(...comp.failed);
    await comp.close();
  }
  const captureIds = new Set([
    ...v.captures,
    ...samples.flatMap((s) => s.inspect.screens.flatMap((sc) => sc.captures)),
  ]);
  return {
    format: o.format,
    video: v,
    sampleFps: o.sampleFps,
    samples,
    clicks,
    network: { blocked, failed },
    determinism,
    loop,
    vocabulary: await vocabularyFor(project, video, captureIds),
    audio: await audioFacts(video),
  };
}
