import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DemovieError, sha256 } from "@demovie/core";
import { limit, mixInto } from "./dsp.ts";
import {
  decodeAudio,
  type Loudness,
  type LoudnessTarget,
  type LoudnormMeasurement,
  loudnormApply,
  loudnormMeasure,
  measureLoudness,
} from "./ffmpeg.ts";
import { createAudio, dbToGain, decodeWav, encodeWav, frameCount, type PcmAudio, SAMPLE_RATE } from "./wav.ts";

export interface MixInput {
  duration: number;
  music: { file: string; gain: number } | null;
  voice: { file: string; start: number; duration: number }[];
  sfx: { name: string; file: string; at: number; gain: number }[];
  target: LoudnessTarget;
  /** Music ducking under VO (SPEC §11.4: −8 dB, 150 ms attack, 400 ms release). */
  duck?: { db: number; attack: number; release: number };
  /** Music fade-out at the end, seconds (SPEC §11.4: 1.0). */
  fadeOut?: number;
}

export interface MixResult {
  file: string;
  loudness: Loudness;
  /** Pass-1 measurement of the pre-mix and the pass-2 report. */
  measured: LoudnormMeasurement;
  normalization: string;
  /** Whether the pre-mix needed peak limiting so loudnorm could stay linear. */
  limited: boolean;
  inputsHash: string;
}

const DUCK = { db: -8, attack: 0.15, release: 0.4 };

async function load(file: string): Promise<PcmAudio> {
  if (/\.wav$/i.test(file)) {
    try {
      const wav = decodeWav(readFileSync(file));
      if (wav.sampleRate === SAMPLE_RATE && wav.channels.length <= 2) return wav;
    } catch {
      // fall through to ffmpeg
    }
  }
  return decodeAudio(file, SAMPLE_RATE, 2);
}

/** Per-sample music gain: −8 dB under each VO line with a 150 ms attack (ending at the line start), 400 ms release. */
export function duckEnvelope(
  frames: number,
  sampleRate: number,
  lines: { start: number; duration: number }[],
  duck = DUCK,
): Float32Array {
  const db = new Float32Array(frames);
  for (const line of lines) {
    const s = line.start;
    const e = line.start + line.duration;
    const from = Math.max(0, Math.floor((s - duck.attack) * sampleRate));
    const to = Math.min(frames, Math.ceil((e + duck.release) * sampleRate));
    for (let i = from; i < to; i++) {
      const t = i / sampleRate;
      let d: number;
      if (t < s) d = duck.db * ((t - (s - duck.attack)) / duck.attack);
      else if (t <= e) d = duck.db;
      else d = duck.db * (1 - (t - e) / duck.release);
      if (d < db[i]!) db[i] = d;
    }
  }
  const gain = new Float32Array(frames);
  for (let i = 0; i < frames; i++) gain[i] = dbToGain(db[i]!);
  return gain;
}

/** Hash of everything that shapes mix.wav; recorded in provenance so `render` can tell a stale mix. */
export function mixInputsHash(input: MixInput): string {
  const fileHash = (f: string) => (existsSync(f) ? sha256(readFileSync(f)).slice(0, 16) : "missing");
  return sha256(
    JSON.stringify({
      v: 1,
      duration: input.duration,
      music: input.music ? { hash: fileHash(input.music.file), gain: input.music.gain } : null,
      voice: input.voice.map((l) => ({ hash: fileHash(l.file), start: l.start, duration: l.duration })),
      sfx: input.sfx.map((s) => ({ name: s.name, hash: fileHash(s.file), at: s.at, gain: s.gain })),
      target: input.target,
      duck: input.duck ?? DUCK,
      fadeOut: input.fadeOut ?? 1,
    }),
  ).slice(0, 16);
}

/** Build the pre-mix in memory: music (gain, ducking, fade-out) + VO at its starts + SFX at their cues. */
export async function premix(input: MixInput): Promise<PcmAudio> {
  const out = createAudio(input.duration, SAMPLE_RATE, 2);
  const frames = frameCount(out);
  if (input.music) {
    const music = await load(input.music.file);
    const duck = duckEnvelope(frames, SAMPLE_RATE, input.voice, input.duck ?? DUCK);
    const fade = input.fadeOut ?? 1;
    const fadeFrom = Math.max(0, input.duration - fade);
    const base = dbToGain(input.music.gain);
    for (let c = 0; c < 2; c++) {
      const src = music.channels[Math.min(c, music.channels.length - 1)]!;
      const dst = out.channels[c]!;
      const n = Math.min(frames, src.length);
      for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const f = t > fadeFrom && fade > 0 ? Math.cos((Math.PI / 2) * Math.min(1, (t - fadeFrom) / fade)) : 1;
        dst[i]! += src[i]! * base * duck[i]! * f;
      }
    }
  }
  for (const line of input.voice) mixInto(out, await load(line.file), line.start, 1);
  const cache = new Map<string, PcmAudio>();
  for (const cue of input.sfx) {
    let audio = cache.get(cue.file);
    if (!audio) {
      audio = await load(cue.file);
      cache.set(cue.file, audio);
    }
    mixInto(out, audio, cue.at, dbToGain(cue.gain));
  }
  return out;
}

/**
 * `audio mix` (SPEC §11.4): pre-mix, then two-pass loudnorm to the target. When the gain loudnorm needs would push
 * true peaks over the target, the pre-mix is peak-limited first so the second pass stays linear (no pumping).
 */
export async function mixAudio(input: MixInput, outFile: string, tmpDir: string): Promise<MixResult> {
  if (!input.music && input.voice.length === 0 && input.sfx.length === 0)
    throw new DemovieError(
      "E_USAGE",
      "nothing to mix: video.json has no music, voice or SFX",
      "run `npx demovie audio music <slug>` and/or add SFX cues to video.json audio.sfx",
    );
  await mkdir(tmpDir, { recursive: true });
  const pre = await premix(input);
  const tmp = path.join(tmpDir, `premix-${process.pid}.wav`);
  try {
    await writeFile(tmp, encodeWav(pre, "float32"));
    let m = await loudnormMeasure(tmp, input.target);
    if (!Number.isFinite(m.input_i) || m.input_i < -70)
      throw new DemovieError(
        "E_AUDIO",
        "the mix is silent (integrated loudness below −70 LUFS)",
        "raise the music/SFX gains in video.json, or check the audio files",
      );
    let limited = false;
    const gain = input.target.lufs - m.input_i;
    if (m.input_tp + gain > input.target.truePeak - 0.5) {
      // sample-peak ceiling 1 dB under the true-peak target, measured after the loudness gain
      limit(pre, input.target.truePeak - 1 - gain, 3, 150);
      await writeFile(tmp, encodeWav(pre, "float32"));
      m = await loudnormMeasure(tmp, input.target);
      limited = true;
    }
    await mkdir(path.dirname(outFile), { recursive: true });
    const report = await loudnormApply(tmp, outFile, input.target, m);
    const loudness = await measureLoudness(outFile);
    return {
      file: outFile,
      loudness,
      measured: m,
      normalization: report.normalization_type ?? "unknown",
      limited,
      inputsHash: mixInputsHash(input),
    };
  } finally {
    await rm(tmp, { force: true });
  }
}

export async function fileSha256(file: string): Promise<string> {
  return sha256(await readFile(file));
}
