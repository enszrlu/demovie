import { existsSync, readdirSync } from "node:fs";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  type Storyboard,
  sha256,
  type VoiceManifest,
  VoiceManifestSchema,
  writeFileAtomic,
  writeJson,
} from "@demovie/core";
import { captionCues, toSrt, toVtt } from "../captions.ts";
import { recordProvenance } from "../provenance.ts";
import { elevenLabs } from "./elevenlabs.ts";
import { openAi } from "./openai.ts";
import type { VoiceLine, VoiceOptions, VoiceProvider, VoiceResult } from "./types.ts";

export * from "./elevenlabs.ts";
export * from "./openai.ts";
export * from "./types.ts";
export * from "./words.ts";

export const VOICE_PROVIDERS: Record<VoiceProvider["id"], VoiceProvider> = { elevenlabs: elevenLabs, openai: openAi };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** VO lines from the storyboard's "VO line" column, verbatim, starting with their shot (SPEC §13.3). */
export function linesFromStoryboard(storyboard: Storyboard): VoiceLine[] {
  return storyboard.rows
    .filter((r) => r.vo.trim() !== "")
    .map((r) => ({ id: `vo-${pad2(r.index)}`, text: r.vo.trim(), start: r.start }));
}

/**
 * A user-provided script: one line per VO line, optionally prefixed with a start time (`[12.5] text` or
 * `12.5 | text`). Lines without a time are placed after the previous one. Blank lines and `#` comments are skipped.
 */
export function parseScript(text: string): VoiceLine[] {
  const lines: VoiceLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const timed = line.match(/^\[(\d+(?:\.\d+)?)s?\]\s*(.+)$/) ?? line.match(/^(\d+(?:\.\d+)?)s?\s*\|\s*(.+)$/);
    lines.push({
      id: `vo-${pad2(lines.length + 1)}`,
      text: timed ? timed[2]!.trim() : line,
      start: timed ? Number(timed[1]) : null,
    });
  }
  return lines;
}

export function voiceCacheKey(provider: string, model: string, voice: string, text: string): string {
  return sha256(JSON.stringify([provider, model, voice, text])).slice(0, 32);
}

/** Synthesize through the cache in `.demovie/.cache/voice/` keyed by hash(provider, model, voice, text). */
export async function synthesizeCached(
  provider: VoiceProvider,
  lines: VoiceLine[],
  o: Omit<VoiceOptions, "outDir"> & { cacheDir: string },
): Promise<{ results: Map<string, VoiceResult>; cached: number }> {
  await ensureDir(o.cacheDir);
  const results = new Map<string, VoiceResult>();
  const todo: VoiceLine[] = [];
  const keyOf = new Map<string, string>();
  for (const line of lines) {
    const key = voiceCacheKey(provider.id, o.model, o.voice, line.text);
    keyOf.set(line.id, key);
    const meta = path.join(o.cacheDir, `${key}.json`);
    const file = path.join(o.cacheDir, `${key}.${provider.extension}`);
    if (existsSync(meta) && existsSync(file)) {
      const m = JSON.parse(await readFile(meta, "utf8")) as Omit<VoiceResult, "lineId" | "file">;
      results.set(line.id, { ...m, lineId: line.id, file });
    } else if (!todo.some((t) => keyOf.get(t.id) === key)) {
      todo.push({ ...line, id: key });
    }
  }
  const cached = lines.length - todo.length;
  if (todo.length) {
    const fresh = await provider.synthesize(todo, { ...o, outDir: o.cacheDir });
    for (const r of fresh) {
      const { lineId: _key, file: _file, ...meta } = r;
      await writeFile(path.join(o.cacheDir, `${r.lineId}.json`), `${JSON.stringify(meta, null, 2)}\n`);
    }
    for (const line of lines) {
      if (results.has(line.id)) continue;
      const r = fresh.find((x) => x.lineId === keyOf.get(line.id));
      if (r) results.set(line.id, { ...r, lineId: line.id });
    }
  }
  return { results, cached };
}

export interface VoiceoverOptions {
  provider: VoiceProvider;
  voice: string;
  model: string;
  apiKey: string;
  lines: VoiceLine[];
  /** The video folder; audio files go to `<videoDir>/audio`. */
  videoDir: string;
  cacheDir: string;
  fetch?: typeof fetch;
}

export interface VoiceoverResult {
  manifest: VoiceManifest;
  cached: number;
  files: string[];
  captions: { vtt: string; srt: string };
}

/**
 * Synthesize VO lines and write `audio/<id>.<ext>`, `audio/voice.json`, `audio/captions.vtt|srt` and provenance.
 * Lines without a start go 0.4 s after the previous line ends.
 */
export async function buildVoiceover(o: VoiceoverOptions): Promise<VoiceoverResult> {
  const audioDir = path.join(o.videoDir, "audio");
  await ensureDir(audioDir);
  const { results, cached } = await synthesizeCached(o.provider, o.lines, {
    voice: o.voice,
    model: o.model,
    apiKey: o.apiKey,
    cacheDir: o.cacheDir,
    ...(o.fetch ? { fetch: o.fetch } : {}),
  });
  const ext = o.provider.extension;
  const manifestLines: VoiceManifest["lines"] = [];
  const files: string[] = [];
  let previousEnd: number | null = null;
  for (const line of o.lines) {
    const r = results.get(line.id);
    if (!r) throw new Error(`no audio for VO line ${line.id}`);
    const start: number = line.start ?? (previousEnd === null ? 0.5 : previousEnd + 0.4);
    const name = `${line.id}.${ext}`;
    await copyFile(r.file, path.join(audioDir, name));
    files.push(path.join(audioDir, name));
    manifestLines.push({
      id: line.id,
      text: line.text,
      start: Math.round(start * 1000) / 1000,
      duration: Math.round(r.duration * 1000) / 1000,
      file: `audio/${name}`,
      words: r.words,
      ...(r.estimated ? { estimated: true } : {}),
    });
    previousEnd = start + r.duration;
  }
  // drop VO files from earlier runs that are no longer in the script
  const keep = new Set(manifestLines.map((l) => path.basename(l.file)));
  const stale = readdirSync(audioDir).filter((f) => /^vo-.*\.(mp3|wav)$/.test(f) && !keep.has(f));
  for (const f of stale) await rm(path.join(audioDir, f), { force: true });

  const manifest = VoiceManifestSchema.parse({
    provider: o.provider.id,
    voice: o.voice,
    model: o.model,
    lines: manifestLines,
  });
  await writeJson(path.join(audioDir, "voice.json"), manifest);
  const cues = captionCues(manifest.lines);
  const vtt = path.join(audioDir, "captions.vtt");
  const srt = path.join(audioDir, "captions.srt");
  await writeFileAtomic(vtt, toVtt(cues));
  await writeFileAtomic(srt, toSrt(cues));
  const entries = [];
  for (const line of manifestLines) {
    entries.push({
      file: path.basename(line.file),
      kind: "voice" as const,
      generator: o.provider.id,
      license: `${o.provider.label} output under your account's terms`,
      details: {
        voice: o.voice,
        model: o.model,
        text: line.text,
        sha256: sha256(await readFile(path.join(audioDir, path.basename(line.file)))),
      },
    });
  }
  await recordProvenance(audioDir, entries, stale);
  return { manifest, cached, files, captions: { vtt, srt } };
}
