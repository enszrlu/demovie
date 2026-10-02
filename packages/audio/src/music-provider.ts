import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "@demovie/core";
import type { Mood, Section } from "./music.ts";
import { ELEVENLABS_API } from "./voice/elevenlabs.ts";
import { providerError } from "./voice/http.ts";

/** ElevenLabs Music pricing checked 2026-10 (≈ $0.15 per generated minute; plans differ). */
export function elevenLabsMusicCost(seconds: number): { seconds: number; usd: number } {
  return { seconds, usd: Math.round((seconds / 60) * 0.15 * 10_000) / 10_000 };
}

const MOOD_WORDS: Record<Mood, string> = {
  uplifting: "uplifting, warm and optimistic electronic pop",
  tech: "modern, focused tech house with a clean pulse",
  calm: "calm, airy ambient with soft keys",
  energetic: "energetic, driving electronic with bright synths",
  minimal: "minimal, understated electronic with a steady pulse",
};

/** The prompt sent to ElevenLabs Music, derived from mood, tempo, key, length and the storyboard sections. */
export function musicPrompt(o: {
  mood: Mood;
  bpm: number;
  key: string | null;
  duration: number;
  sections: Section[];
  endHit: number | null;
}): string {
  const parts = [
    `Instrumental background bed for a product launch video: ${MOOD_WORDS[o.mood]}, ${o.bpm} BPM`,
    o.key ? `in ${o.key}` : "",
    `${Math.round(o.duration)} seconds long.`,
    `Structure: ${o.sections.map((s) => `${s.name} ${s.start.toFixed(1)}–${s.end.toFixed(1)} s`).join(", ")}.`,
    o.endHit !== null ? `A clean ending hit at ${o.endHit.toFixed(1)} s, then let the final chord ring out.` : "",
    "No vocals, no risers louder than the groove, non-fatiguing mix that sits under a voiceover.",
  ];
  return parts.filter(Boolean).join(" ");
}

/** ElevenLabs Music `POST /v1/music` (the user's key). Writes an MP3 and returns its path. */
export async function generateElevenLabsMusic(o: {
  prompt: string;
  duration: number;
  apiKey: string;
  outFile: string;
  fetch?: typeof fetch;
}): Promise<string> {
  const doFetch = o.fetch ?? fetch;
  const res = await doFetch(`${ELEVENLABS_API}/v1/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": o.apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      prompt: o.prompt,
      music_length_ms: Math.min(600_000, Math.max(3000, Math.round(o.duration * 1000))),
      force_instrumental: true,
    }),
  });
  if (!res.ok) throw await providerError("ElevenLabs", "ELEVENLABS_API_KEY", res, "music");
  await ensureDir(path.dirname(o.outFile));
  await writeFile(o.outFile, new Uint8Array(await res.arrayBuffer()));
  return o.outFile;
}
