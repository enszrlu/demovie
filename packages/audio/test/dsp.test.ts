import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ProvenanceSchema, parseStoryboard } from "@demovie/core";
import { describe, expect, it } from "vitest";
import {
  audioDuration,
  beatGrid,
  createAudio,
  decodeWav,
  defaultSections,
  encodeWav,
  generateSfx,
  limit,
  listSfx,
  MOODS,
  type PcmAudio,
  parseKey,
  peakDb,
  SFX_INFO,
  SFX_NAMES,
  sectionsFromStoryboard,
  synthMusic,
} from "../src/index.ts";

const rmsDb = (a: PcmAudio, t0: number, t1: number) => {
  let sum = 0;
  let n = 0;
  for (const ch of a.channels)
    for (let i = Math.round(t0 * a.sampleRate); i < Math.min(ch.length, Math.round(t1 * a.sampleRate)); i++) {
      sum += ch[i]! ** 2;
      n++;
    }
  return 10 * Math.log10(sum / Math.max(1, n) + 1e-12);
};
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

describe("WAV encode/decode", () => {
  it("round-trips 16-bit PCM and 32-bit float, including overs in float", () => {
    const a = createAudio(0.01, 48_000, 2);
    a.channels[0]!.forEach((_, i) => {
      a.channels[0]![i] = Math.sin(i / 3) * 0.5;
      a.channels[1]![i] = i === 3 ? 1.5 : -0.25;
    });
    const pcm = decodeWav(encodeWav(a));
    expect(pcm.sampleRate).toBe(48_000);
    expect(pcm.channels.length).toBe(2);
    expect(pcm.channels[0]![5]).toBeCloseTo(a.channels[0]![5]!, 3);
    expect(pcm.channels[1]![3]).toBeCloseTo(1, 3); // clamped
    const float = decodeWav(encodeWav(a, "float32"));
    expect(float.channels[1]![3]).toBeCloseTo(1.5, 5);
  });

  it("reads streamed WAVs whose data size is unset", () => {
    const wav = encodeWav(createAudio(0.02, 24_000, 1));
    wav.writeUInt32LE(0xffffffff, 40);
    expect(audioDuration(decodeWav(wav))).toBeCloseTo(0.02, 3);
  });
});

describe("limiter", () => {
  it("keeps every sample under the ceiling and recovers after a peak", () => {
    const a = createAudio(1);
    for (const ch of a.channels)
      for (let i = 0; i < ch.length; i++) ch[i] = Math.sin(i / 7) * (i >= 4800 && i < 5000 ? 1.8 : 0.3);
    limit(a, -3);
    expect(peakDb(a)).toBeLessThanOrEqual(-3 + 1e-4);
    // 0.3 amplitude sine ≈ −13.5 dB RMS: untouched well after the release
    expect(rmsDb(a, 0.7, 0.9)).toBeGreaterThan(-13.7);
  });
});

describe("music synth", () => {
  const storyboard = parseStoryboard(
    readFileSync(path.join(import.meta.dirname, "../../../examples/compositions/clean-launch/storyboard.md"), "utf8"),
  );

  it("parses keys", () => {
    expect(parseKey("F#m")).toMatchObject({ root: 6, mode: "minor", name: "F# minor" });
    expect(parseKey("Eb major")).toMatchObject({ root: 3, mode: "major" });
    expect(parseKey("H")).toBeNull();
  });

  it("follows the storyboard: intro = first shot, outro = the final logo shot with the ending hit", () => {
    const sections = sectionsFromStoryboard(storyboard.rows, 35, 112);
    expect(sections.map((s) => s.name)).toEqual(["intro", "build", "main", "outro"]);
    expect(sections[0]).toMatchObject({ start: 0, end: 3.4 });
    expect(sections[3]).toMatchObject({ start: 30.4, end: 35 });
    expect(defaultSections(12, 120).map((s) => s.name)).toEqual(["intro", "build", "main", "outro"]);
  });

  it("is 48 kHz stereo, exactly as long as the video, peaks at −1 dBFS and is deterministic per seed", () => {
    const sections = sectionsFromStoryboard(storyboard.rows, 35, 112);
    const a = synthMusic({ bpm: 112, mood: "uplifting", duration: 35, seed: "s1", sections });
    expect(a.audio.sampleRate).toBe(48_000);
    expect(a.audio.channels.length).toBe(2);
    expect(a.audio.channels[0]!.length).toBe(35 * 48_000);
    expect(peakDb(a.audio)).toBeCloseTo(-1, 2);
    const b = synthMusic({ bpm: 112, mood: "uplifting", duration: 35, seed: "s1", sections });
    expect(sha(encodeWav(b.audio))).toBe(sha(encodeWav(a.audio)));
    const c = synthMusic({ bpm: 112, mood: "uplifting", duration: 35, seed: "s2", sections });
    expect(sha(encodeWav(c.audio))).not.toBe(sha(encodeWav(a.audio)));
  });

  it("writes a beat grid whose bar line lands on the ending hit", () => {
    const sections = sectionsFromStoryboard(storyboard.rows, 35, 112);
    const { beats, endHit } = synthMusic({ bpm: 112, mood: "tech", duration: 35, seed: "x", sections });
    expect(endHit).toBe(30.4);
    expect(beats.bpm).toBe(112);
    expect(beats.offset).toBeCloseTo(30.4 % (240 / 112), 3);
    expect(beats.bars.some((b) => Math.abs(b - 30.4) < 0.002)).toBe(true);
    expect(beats.beats[1]! - beats.beats[0]!).toBeCloseTo(60 / 112, 3);
    expect(beats.bars[1]! - beats.bars[0]!).toBeCloseTo(240 / 112, 3);
    expect(beats.beats.at(-1)!).toBeLessThan(35);
    expect(beats.sections.map((s) => s.name)).toEqual(["intro", "build", "main", "outro"]);
    expect(beatGrid(120, 0, 2, []).beats).toEqual([0, 0.5, 1, 1.5]);
  });

  it("arranges every mood: quiet intro without drums, full main section, ringing outro", () => {
    for (const mood of MOODS) {
      const r = synthMusic({ bpm: 110, mood, duration: 24, seed: mood, stems: true });
      const [intro, , main, outro] = r.sections;
      expect(rmsDb(r.stems!.drums, intro!.start, intro!.end), mood).toBeLessThan(-100);
      expect(rmsDb(r.audio, main!.start, main!.end) - rmsDb(r.audio, intro!.start, intro!.end), mood).toBeGreaterThan(
        3,
      );
      expect(rmsDb(r.audio, outro!.start, outro!.end), mood).toBeGreaterThan(-40);
      expect(peakDb(r.audio), mood).toBeLessThanOrEqual(-0.99);
    }
  });
});

describe("SFX", () => {
  it("generates the 12 bundled effects deterministically at their catalog peak", () => {
    expect(SFX_NAMES).toHaveLength(12);
    for (const name of SFX_NAMES) {
      const a = generateSfx(name);
      expect(a.sampleRate, name).toBe(48_000);
      expect(a.channels.length, name).toBe(2);
      expect(peakDb(a), name).toBeCloseTo(SFX_INFO[name].peakDb, 1);
      expect(sha(encodeWav(generateSfx(name))), name).toBe(sha(encodeWav(a)));
    }
  });

  it("ships exactly what scripts/generate-sfx.ts produces, each with CC0 provenance", () => {
    const dir = path.join(import.meta.dirname, "../sfx");
    const provenance = ProvenanceSchema.parse(JSON.parse(readFileSync(path.join(dir, "provenance.json"), "utf8")));
    for (const name of SFX_NAMES) {
      const bundled = readFileSync(path.join(dir, `${name}.wav`));
      expect(sha(bundled), `${name}.wav is stale: run pnpm sfx:generate`).toBe(sha(encodeWav(generateSfx(name))));
      expect(provenance.files.find((f) => f.file === `${name}.wav`)).toMatchObject({
        kind: "sfx",
        generator: "demovie-sfx",
        license: "CC0-1.0",
        details: { sha256: sha(bundled) },
      });
    }
    const list = listSfx();
    expect(list.map((s) => s.name)).toEqual([...SFX_NAMES]);
    expect(list.find((s) => s.name === "riser-2s")?.duration).toBe(2);
  });
});
