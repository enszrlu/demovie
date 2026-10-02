import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "@demovie/core";
import { probeDuration } from "../ffmpeg.ts";
import { providerError } from "./http.ts";
import type { CostEstimate, VoiceLine, VoiceOptions, VoiceProvider, VoiceResult } from "./types.ts";
import { type CharacterAlignment, wordsFromAlignment } from "./words.ts";

export const ELEVENLABS_API = "https://api.elevenlabs.io";

/** USD per 1,000 characters (ElevenLabs API pricing, checked 2026-10; plans differ). */
const PRICE_PER_1K_CHARS: Record<string, number> = {
  eleven_multilingual_v2: 0.08,
  eleven_flash_v2_5: 0.04,
  eleven_turbo_v2_5: 0.04,
};

export function elevenLabsCost(characters: number, model: string): CostEstimate {
  const rate = PRICE_PER_1K_CHARS[model];
  return { characters, usd: rate === undefined ? null : Math.round((characters / 1000) * rate * 10_000) / 10_000 };
}

/** ElevenLabs text-to-speech with timestamps (SPEC §13.3): character alignment → word timings. */
export const elevenLabs: VoiceProvider = {
  id: "elevenlabs",
  label: "ElevenLabs",
  envKey: "ELEVENLABS_API_KEY",
  // The example voice of the API reference (DECISIONS); pass --voice to use your own.
  defaultVoice: "21m00Tcm4TlvDq8ikWAM",
  defaultModel: "eleven_multilingual_v2",
  extension: "mp3",

  estimateCost(lines, o) {
    return elevenLabsCost(
      lines.reduce((n, l) => n + l.text.length, 0),
      o.model,
    );
  },

  async synthesize(lines: VoiceLine[], o: VoiceOptions): Promise<VoiceResult[]> {
    const doFetch = o.fetch ?? fetch;
    await ensureDir(o.outDir);
    const out: VoiceResult[] = [];
    for (const line of lines) {
      const url = `${ELEVENLABS_API}/v1/text-to-speech/${encodeURIComponent(o.voice)}/with-timestamps?output_format=mp3_44100_128`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "xi-api-key": o.apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ text: line.text, model_id: o.model }),
      });
      if (!res.ok) throw await providerError("ElevenLabs", "ELEVENLABS_API_KEY", res, "text-to-speech");
      const json = (await res.json()) as {
        audio_base64: string;
        alignment?: CharacterAlignment | null;
        normalized_alignment?: CharacterAlignment | null;
      };
      const file = path.join(o.outDir, `${line.id}.mp3`);
      await writeFile(file, Buffer.from(json.audio_base64, "base64"));
      const alignment = json.alignment ?? json.normalized_alignment ?? null;
      const words = alignment ? wordsFromAlignment(alignment) : [];
      const spokenEnd = alignment?.character_end_times_seconds.at(-1) ?? 0;
      const duration = (await probeDuration(file).catch(() => null)) ?? spokenEnd;
      out.push({ lineId: line.id, file, duration: Math.max(duration, spokenEnd), words });
    }
    return out;
  },
};
