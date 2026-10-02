import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "@demovie/core";
import { audioDuration, decodeWav, type PcmAudio } from "../wav.ts";
import { providerError } from "./http.ts";
import type { CostEstimate, VoiceLine, VoiceOptions, VoiceProvider, VoiceResult } from "./types.ts";
import { estimateWords } from "./words.ts";

export const OPENAI_API = "https://api.openai.com";

/** Pricing checked 2026-10: tts-1 $15 / 1M chars, tts-1-hd $30 / 1M chars, gpt-4o-mini-tts ≈ $0.015 per minute. */
export function openAiCost(characters: number, model: string): CostEstimate {
  const round = (x: number) => Math.round(x * 10_000) / 10_000;
  if (model === "tts-1") return { characters, usd: round((characters / 1_000_000) * 15) };
  if (model === "tts-1-hd") return { characters, usd: round((characters / 1_000_000) * 30) };
  // ~15 characters per spoken second → 900 per minute (DECISIONS)
  if (model === "gpt-4o-mini-tts") return { characters, usd: round((characters / 900) * 0.015) };
  return { characters, usd: null };
}

/** First and last sample above −40 dBFS: the spoken part of a TTS clip. */
export function speechSpan(audio: PcmAudio): [number, number] {
  const threshold = 0.01;
  const n = audio.channels[0]?.length ?? 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (const ch of audio.channels) peak = Math.max(peak, Math.abs(ch[i]!));
    if (peak > threshold) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return [0, audioDuration(audio)];
  return [first / audio.sampleRate, last / audio.sampleRate];
}

/** OpenAI text-to-speech (SPEC §13.3): no alignment, so word timings are estimated and marked `estimated`. */
export const openAi: VoiceProvider = {
  id: "openai",
  label: "OpenAI",
  envKey: "OPENAI_API_KEY",
  defaultVoice: "alloy",
  defaultModel: "gpt-4o-mini-tts",
  extension: "wav",

  estimateCost(lines, o) {
    return openAiCost(
      lines.reduce((n, l) => n + l.text.length, 0),
      o.model,
    );
  },

  async synthesize(lines: VoiceLine[], o: VoiceOptions): Promise<VoiceResult[]> {
    const doFetch = o.fetch ?? fetch;
    await ensureDir(o.outDir);
    const out: VoiceResult[] = [];
    for (const line of lines) {
      const res = await doFetch(`${OPENAI_API}/v1/audio/speech`, {
        method: "POST",
        headers: { authorization: `Bearer ${o.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: o.model, input: line.text, voice: o.voice, response_format: "wav" }),
      });
      if (!res.ok) throw await providerError("OpenAI", "OPENAI_API_KEY", res, "speech");
      const bytes = new Uint8Array(await res.arrayBuffer());
      const file = path.join(o.outDir, `${line.id}.wav`);
      await writeFile(file, bytes);
      const audio = decodeWav(bytes);
      const [from, to] = speechSpan(audio);
      out.push({
        lineId: line.id,
        file,
        duration: audioDuration(audio),
        words: estimateWords(line.text, from, to),
        estimated: true,
      });
    }
    return out;
  },
};
