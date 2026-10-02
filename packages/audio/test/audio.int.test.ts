import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ProvenanceSchema, VideoSchema, VoiceManifestSchema } from "@demovie/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run as audioMix } from "../../cli/src/commands/audio-mix.ts";
import { run as audioMusic } from "../../cli/src/commands/audio-music.ts";
import { run as audioSfx } from "../../cli/src/commands/audio-sfx.ts";
import { run as audioVoice } from "../../cli/src/commands/audio-voice.ts";
import { run as newVideo } from "../../cli/src/commands/new.ts";
import { createContext } from "../../cli/src/context.ts";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { createAudio, decodeWav, encodeWav, measureLoudness } from "../src/index.ts";

const FAKE_KEY = "test-key-not-a-real-secret";
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const json = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const STORYBOARD = `---
bpm: 120
---

| # | start | dur | kind | visual | on-screen text | VO line | captures / element ids | transition | notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.0 | 4.0 | title | Title | Meet Synthetica | Meet Synthetica. | | crossfade 0.5 | |
| 2 | 4.0 | 18.0 | product | Canvas | Shapes, measured. | | routes/demo@desktop | crossfade 0.5 | |
| 3 | 22.0 | 6.0 | text | Tagline | | Every shape, measured to the pixel. | | crossfade 0.5 | |
| 4 | 28.0 | 4.0 | logo | Logo | Try it free | | | | |
`;

/** OpenAI-style WAV: 0.15 s silence, 1.2 s of a voiced tone, 0.2 s silence (24 kHz mono). */
function speechWav(): Uint8Array<ArrayBuffer> {
  const a = createAudio(1.55, 24_000, 1);
  const ch = a.channels[0]!;
  for (let i = Math.round(0.15 * 24_000); i < Math.round(1.35 * 24_000); i++)
    ch[i] = 0.25 * Math.sin((2 * Math.PI * 180 * i) / 24_000) + 0.1 * Math.sin((2 * Math.PI * 360 * i) / 24_000);
  return new Uint8Array(encodeWav(a));
}

const realOpenAiKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (realOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = realOpenAiKey;
});

describe("audio commands (synth, voice with mocked HTTP, SFX, mix + loudness)", () => {
  it("builds music, voiceover and a mix normalized to the loudness target", async () => {
    const p = syntheticProject("int-audio", "");
    const savedCi = process.env.CI;
    process.env.CI = "";
    const ask = createContext({ cwd: p.root, json: true });
    process.env.CI = savedCi;
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    await newVideo(ctx, "launch", { type: "launch", style: "clean", duration: 32 });
    const dir = path.join(p.root, ".demovie/videos/launch");
    writeFileSync(path.join(dir, "storyboard.md"), STORYBOARD);

    // music: synth + beats.json + provenance, wired into video.json, byte-identical on a re-run
    await expect(audioMusic(ctx, "launch", { bpm: 200 })).rejects.toMatchObject({ code: "E_USAGE" });
    const music = await audioMusic(ctx, "launch", {});
    expect(music.data).toMatchObject({ provider: "synth", mood: "uplifting", bpm: 120, endHit: 28 });
    const musicFile = path.join(dir, "audio/music.wav");
    const wav = decodeWav(readFileSync(musicFile));
    expect([wav.sampleRate, wav.channels.length, wav.channels[0]!.length]).toEqual([48_000, 2, 32 * 48_000]);
    const beats = json(path.join(dir, "audio/beats.json"));
    expect(beats.bars).toContain(28);
    expect(VideoSchema.parse(json(path.join(dir, "video.json"))).audio.music).toEqual({
      src: "audio/music.wav",
      gain: -14,
      beats: "audio/beats.json",
    });
    const before = [sha(musicFile), readFileSync(path.join(dir, "audio/provenance.json"), "utf8")];
    await audioMusic(ctx, "launch", {});
    expect([sha(musicFile), readFileSync(path.join(dir, "audio/provenance.json"), "utf8")]).toEqual(before);

    // voice: needs the user's key, a confirmed cost, then synthesizes through the provider
    await expect(audioVoice(ctx, "launch", { provider: "openai" })).rejects.toMatchObject({
      code: "E_CONFIG",
      fix: expect.stringContaining("OPENAI_API_KEY"),
    });
    process.env.OPENAI_API_KEY = FAKE_KEY;
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(`${url} ${JSON.parse(String(init.body)).input}`);
      return new Response(speechWav(), { headers: { "content-type": "audio/wav" } });
    });
    if (!ask.yes)
      await expect(audioVoice(ask, "launch", { provider: "openai" })).rejects.toMatchObject({
        code: "E_USAGE",
        fix: expect.stringContaining("--yes"),
      });
    expect(calls).toEqual([]);
    const voice = await audioVoice(ctx, "launch", { provider: "openai" });
    expect(calls).toEqual([
      "https://api.openai.com/v1/audio/speech Meet Synthetica.",
      "https://api.openai.com/v1/audio/speech Every shape, measured to the pixel.",
    ]);
    expect(voice.data).toMatchObject({ provider: "openai", voice: "alloy", model: "gpt-4o-mini-tts", cached: 0 });
    const manifest = VoiceManifestSchema.parse(json(path.join(dir, "audio/voice.json")));
    expect(manifest.lines.map((l) => [l.id, l.start, l.estimated])).toEqual([
      ["vo-01", 0, true],
      ["vo-03", 22, true],
    ]);
    expect(readFileSync(path.join(dir, "audio/captions.srt"), "utf8")).toContain("Every shape, measured to the pixel.");
    expect(VideoSchema.parse(json(path.join(dir, "video.json"))).audio.voice).toEqual({ manifest: "audio/voice.json" });
    expect((await audioVoice(ctx, "launch", { provider: "openai" })).data).toMatchObject({ cached: 2 });
    expect(calls).toHaveLength(2);

    // SFX cues: unknown names are rejected with the list of valid ones
    const videoFile = path.join(dir, "video.json");
    const raw = json(videoFile);
    raw.audio.sfx = [{ name: "boing", at: 1 }];
    writeFileSync(videoFile, JSON.stringify(raw));
    await expect(audioMix(ctx, "launch")).rejects.toMatchObject({
      code: "E_CONFIG",
      fix: expect.stringContaining("whoosh-short"),
    });
    raw.audio.sfx = [
      { name: "whoosh-short", at: 3.8, gain: -10 },
      { name: "click", at: 9, gain: -8 },
      { name: "impact", at: 28, gain: -6 },
    ];
    writeFileSync(videoFile, JSON.stringify(raw));
    expect((await audioSfx(ctx, { list: true })).data).toMatchObject({
      sfx: expect.arrayContaining([expect.objectContaining({ name: "impact", license: "CC0-1.0" })]),
    });

    // mix: two-pass loudnorm to −16 LUFS / −1.5 dBTP, verified independently with ebur128
    const mix = await audioMix(ctx, "launch");
    const mixFile = path.join(dir, "audio/mix.wav");
    const out = decodeWav(readFileSync(mixFile));
    expect([out.sampleRate, out.channels.length]).toEqual([48_000, 2]);
    expect(out.channels[0]!.length / 48_000).toBeCloseTo(32, 1);
    const loudness = await measureLoudness(mixFile);
    expect(Math.abs(loudness.integrated - -16)).toBeLessThanOrEqual(1);
    expect(loudness.truePeak).toBeLessThanOrEqual(-1.0);
    expect(mix.data).toMatchObject({ inputs: { voice: 2, sfx: 3 } });
    const prov = ProvenanceSchema.parse(json(path.join(dir, "audio/provenance.json")));
    expect(prov.files.map((f) => [f.file, f.generator]).sort()).toEqual([
      ["mix.wav", "demovie-mix"],
      ["music.wav", "demovie-synth"],
      ["vo-01.wav", "openai"],
      ["vo-03.wav", "openai"],
    ]);
    expect(readFileSync(path.join(dir, "audio/provenance.json"), "utf8")).not.toContain(FAKE_KEY);
  });
});
