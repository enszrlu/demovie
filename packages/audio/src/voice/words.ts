import type { WordTiming } from "@demovie/core";

export interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** Group character timings into words (runs of non-whitespace), keeping the characters exactly as spoken text. */
export function wordsFromAlignment(a: CharacterAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let text = "";
  let start = 0;
  let end = 0;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (text) words.push({ text, start: round3(start), end: round3(end) });
      text = "";
      return;
    }
    if (!text) start = a.character_start_times_seconds[i] ?? end;
    text += ch;
    end = a.character_end_times_seconds[i] ?? start;
  });
  if (text) words.push({ text, start: round3(start), end: round3(end) });
  return words;
}

/**
 * Providers without alignment (OpenAI TTS): spread the words over the spoken span in proportion to their length
 * (plus one for the following space). Callers mark the result `estimated: true`.
 */
export function estimateWords(text: string, speechStart: number, speechEnd: number): WordTiming[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => t.length + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, speechEnd - speechStart);
  let cursor = speechStart;
  return tokens.map((t, i) => {
    const d = (span * weights[i]!) / total;
    const w = { text: t, start: round3(cursor), end: round3(cursor + d * (t.length / weights[i]!)) };
    cursor += d;
    return w;
  });
}
