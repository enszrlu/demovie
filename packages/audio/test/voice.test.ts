import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DemovieError, ProvenanceSchema, parseStoryboard, VoiceManifestSchema } from "@demovie/core";
import { describe, expect, it } from "vitest";
import {
  buildVoiceover,
  createAudio,
  elevenLabs,
  encodeWav,
  linesFromStoryboard,
  openAi,
  parseScript,
  speechSpan,
} from "../src/index.ts";

const FAKE_KEY = "test-key-not-a-real-secret";
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "demovie-voice-"));

interface Call {
  url: string;
  init: RequestInit;
}

/** A fetch stand-in that records requests and answers like the provider would. */
function mockFetch(respond: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fetch: fn, calls };
}

function alignmentFor(text: string, charSeconds = 0.05, lead = 0.1) {
  const characters = [...text];
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => lead + i * charSeconds),
    character_end_times_seconds: characters.map((_, i) => lead + (i + 1) * charSeconds),
  };
}

const elevenResponse = (call: Call) => {
  const { text } = JSON.parse(String(call.init.body)) as { text: string };
  return Response.json({
    audio_base64: Buffer.from(`fake-mp3:${text}`).toString("base64"),
    alignment: alignmentFor(text),
    normalized_alignment: null,
  });
};

/** 0.2 s silence, 1 s of tone, 0.3 s silence, as 24 kHz mono WAV (what OpenAI returns for response_format=wav). */
function speechWav(): Uint8Array<ArrayBuffer> {
  const a = createAudio(1.5, 24_000, 1);
  for (let i = Math.round(0.2 * 24_000); i < Math.round(1.2 * 24_000); i++) a.channels[0]![i] = 0.3 * Math.sin(i / 5);
  return new Uint8Array(encodeWav(a));
}

describe("ElevenLabs provider (mocked HTTP)", () => {
  it("calls text-to-speech with timestamps and converts the character alignment into words", async () => {
    const { fetch, calls } = mockFetch(elevenResponse);
    const out = tmp();
    const [r] = await elevenLabs.synthesize([{ id: "vo-01", text: "Plan, ship and measure.", start: 0 }], {
      voice: "voice123",
      model: "eleven_multilingual_v2",
      apiKey: FAKE_KEY,
      fetch,
      outDir: out,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice123/with-timestamps?output_format=mp3_44100_128",
    );
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe(FAKE_KEY);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      text: "Plan, ship and measure.",
      model_id: "eleven_multilingual_v2",
    });
    expect(readFileSync(r!.file, "utf8")).toBe("fake-mp3:Plan, ship and measure.");
    expect(r!.words.map((w) => w.text)).toEqual(["Plan,", "ship", "and", "measure."]);
    expect(r!.words[0]).toEqual({ text: "Plan,", start: 0.1, end: 0.35 });
    expect(r!.estimated).toBeUndefined();
    expect(r!.duration).toBeCloseTo(0.1 + 23 * 0.05, 3);
  });

  it("estimates cost per model", () => {
    const lines = [{ text: "x".repeat(1000) }];
    expect(elevenLabs.estimateCost(lines, { model: "eleven_multilingual_v2" })).toEqual({
      characters: 1000,
      usd: 0.08,
    });
    expect(elevenLabs.estimateCost(lines, { model: "eleven_flash_v2_5" }).usd).toBe(0.04);
    expect(elevenLabs.estimateCost(lines, { model: "some_future_model" }).usd).toBeNull();
  });

  it("maps auth failures to a fix hint and never echoes the key", async () => {
    const { fetch } = mockFetch(
      () => new Response(`{"detail":"invalid api key ${FAKE_KEY.slice(0, 4)}"}`, { status: 401 }),
    );
    const error = await elevenLabs
      .synthesize([{ id: "a", text: "Hi.", start: 0 }], {
        voice: "v",
        model: "m",
        apiKey: FAKE_KEY,
        fetch,
        outDir: tmp(),
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DemovieError);
    expect(error).toMatchObject({ code: "E_PROVIDER", fix: expect.stringContaining("ELEVENLABS_API_KEY") });
    expect((error as Error).message).toContain("HTTP 401");
    expect((error as Error).message).not.toContain(FAKE_KEY);
  });
});

describe("OpenAI provider (mocked HTTP)", () => {
  it("requests WAV speech and estimates word timings over the spoken span", async () => {
    const { fetch, calls } = mockFetch(() => new Response(speechWav(), { headers: { "content-type": "audio/wav" } }));
    const [r] = await openAi.synthesize([{ id: "vo-01", text: "Ship every launch", start: 0 }], {
      voice: "alloy",
      model: "gpt-4o-mini-tts",
      apiKey: FAKE_KEY,
      fetch,
      outDir: tmp(),
    });
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/audio/speech");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      model: "gpt-4o-mini-tts",
      input: "Ship every launch",
      voice: "alloy",
      response_format: "wav",
    });
    expect(r!.estimated).toBe(true);
    expect(r!.duration).toBeCloseTo(1.5, 3);
    expect(r!.words.map((w) => w.text)).toEqual(["Ship", "every", "launch"]);
    expect(r!.words[0]!.start).toBeCloseTo(0.2, 2);
    expect(r!.words[2]!.end).toBeLessThanOrEqual(1.2);
    expect(r!.words[1]!.start).toBeGreaterThan(r!.words[0]!.end - 1e-6);
  });

  it("estimates cost per model", () => {
    expect(openAi.estimateCost([{ text: "x".repeat(1_000_000) }], { model: "tts-1" }).usd).toBe(15);
    expect(openAi.estimateCost([{ text: "x".repeat(1_000_000) }], { model: "tts-1-hd" }).usd).toBe(30);
    expect(openAi.estimateCost([{ text: "x".repeat(900) }], { model: "gpt-4o-mini-tts" }).usd).toBe(0.015);
  });

  it("finds the spoken span of a clip", () => {
    const [from, to] = speechSpan(
      (() => {
        const a = createAudio(1, 1000, 1);
        a.channels[0]![300] = 0.5;
        a.channels[0]![700] = -0.5;
        return a;
      })(),
    );
    expect([from, to]).toEqual([0.3, 0.7]);
  });
});

describe("voiceover pipeline", () => {
  const storyboard = parseStoryboard(`---
bpm: 112
---

| # | start | dur | kind | visual | on-screen text | VO line | captures / element ids | transition | notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.0 | 3.0 | title | Logo | Meet Harborly | Meet Harborly, your launch plan. | | | |
| 2 | 3.0 | 5.0 | product | Board | | | | | |
| 3 | 8.0 | 4.0 | logo | End | | Start free today! | | | |
`);

  it("reads VO lines from the storyboard verbatim and scripts with optional start times", () => {
    expect(linesFromStoryboard(storyboard)).toEqual([
      { id: "vo-01", text: "Meet Harborly, your launch plan.", start: 0 },
      { id: "vo-03", text: "Start free today!", start: 8 },
    ]);
    expect(parseScript("# intro\n[1.5] First line.\n\n4 | Second line.\nThird line.")).toEqual([
      { id: "vo-01", text: "First line.", start: 1.5 },
      { id: "vo-02", text: "Second line.", start: 4 },
      { id: "vo-03", text: "Third line.", start: null },
    ]);
  });

  it("writes voice.json, captions and provenance, and serves repeats from the cache", async () => {
    const root = tmp();
    const videoDir = path.join(root, "videos", "launch");
    const cacheDir = path.join(root, ".cache", "voice");
    const { fetch, calls } = mockFetch(elevenResponse);
    const lines = linesFromStoryboard(storyboard);
    const opts = {
      provider: elevenLabs,
      voice: "v1",
      model: "eleven_multilingual_v2",
      apiKey: FAKE_KEY,
      lines,
      videoDir,
      cacheDir,
      fetch,
    };
    const first = await buildVoiceover(opts);
    expect(first.cached).toBe(0);
    expect(calls).toHaveLength(2);
    const manifest = VoiceManifestSchema.parse(
      JSON.parse(readFileSync(path.join(videoDir, "audio/voice.json"), "utf8")),
    );
    expect(manifest).toMatchObject({ provider: "elevenlabs", voice: "v1", model: "eleven_multilingual_v2" });
    expect(manifest.lines.map((l) => [l.id, l.text, l.start, l.file])).toEqual([
      ["vo-01", "Meet Harborly, your launch plan.", 0, "audio/vo-01.mp3"],
      ["vo-03", "Start free today!", 8, "audio/vo-03.mp3"],
    ]);
    expect(existsSync(path.join(videoDir, "audio/vo-01.mp3"))).toBe(true);
    expect(readFileSync(path.join(videoDir, "audio/captions.vtt"), "utf8")).toMatch(/^WEBVTT\n\n1\n00:00:00\.100 --> /);
    expect(readFileSync(path.join(videoDir, "audio/captions.srt"), "utf8")).toContain("Start free today!");
    const prov = ProvenanceSchema.parse(JSON.parse(readFileSync(path.join(videoDir, "audio/provenance.json"), "utf8")));
    expect(prov.files.map((f) => [f.file, f.kind, f.generator])).toEqual([
      ["vo-01.mp3", "voice", "elevenlabs"],
      ["vo-03.mp3", "voice", "elevenlabs"],
    ]);
    expect(JSON.stringify(prov)).not.toContain(FAKE_KEY);

    const again = await buildVoiceover(opts);
    expect(again.cached).toBe(2);
    expect(calls).toHaveLength(2);

    // a script line without a start goes after the previous line
    const third = await buildVoiceover({ ...opts, lines: [...lines, { id: "vo-04", text: "Bye.", start: null }] });
    expect(calls).toHaveLength(3);
    const last = third.manifest.lines.at(-1)!;
    const prev = third.manifest.lines.at(-2)!;
    expect(last.start).toBeCloseTo(prev.start + prev.duration + 0.4, 3);
  });
});
