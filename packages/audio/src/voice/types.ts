import type { WordTiming } from "@demovie/core";

export interface VoiceLine {
  id: string;
  /** The user's wording, exactly. */
  text: string;
  /** Seconds from the start of the video; null = place after the previous line once durations are known. */
  start: number | null;
}

export interface VoiceOptions {
  voice: string;
  model: string;
  apiKey: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Folder for the synthesized files. */
  outDir: string;
}

export interface VoiceResult {
  lineId: string;
  /** Absolute path of the synthesized audio file. */
  file: string;
  duration: number;
  /** Word timings relative to the start of the line. */
  words: WordTiming[];
  estimated?: boolean;
}

export interface CostEstimate {
  characters: number;
  /** null when the model's price isn't known. */
  usd: number | null;
}

export interface VoiceProvider {
  id: "elevenlabs" | "openai";
  label: string;
  envKey: "ELEVENLABS_API_KEY" | "OPENAI_API_KEY";
  defaultVoice: string;
  defaultModel: string;
  extension: "mp3" | "wav";
  estimateCost(lines: Pick<VoiceLine, "text">[], o: { model: string }): CostEstimate;
  synthesize(lines: VoiceLine[], o: VoiceOptions): Promise<VoiceResult[]>;
}
