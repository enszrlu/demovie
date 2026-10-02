import type { Video } from "./types.ts";

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
  words: { text: string; start: number; end: number }[];
}

/**
 * Split voice lines into cues of ≤ 7 words / ≤ 42 characters, breaking after sentence punctuation; word times become
 * absolute. Mirrors `captionCues` in packages/audio/src/captions.ts (sidecar VTT/SRT).
 */
export function captionCues(lines: NonNullable<Video["voice"]>["lines"]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (const line of [...lines].sort((a, b) => a.start - b.start)) {
    const lineEnd = line.start + line.duration;
    if (line.words.length === 0) {
      cues.push({ start: line.start, end: lineEnd, text: line.text.trim(), words: [] });
      continue;
    }
    let chunk: typeof line.words = [];
    const flush = () => {
      if (!chunk.length) return;
      cues.push({
        start: line.start + chunk[0]!.start,
        end: Math.min(lineEnd, line.start + chunk[chunk.length - 1]!.end),
        text: chunk.map((w) => w.text).join(" "),
        words: chunk.map((w) => ({ text: w.text, start: line.start + w.start, end: line.start + w.end })),
      });
      chunk = [];
    };
    for (const w of line.words) {
      const chars = chunk.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
      if (chunk.length >= 7 || (chunk.length > 0 && chars > 42)) flush();
      chunk.push(w);
      if (/[.!?;:]$/.test(w.text) && chunk.length >= 2) flush();
    }
    flush();
  }
  cues.forEach((c, i) => {
    const next = cues[i + 1];
    const limit = next ? next.start : c.end + 0.6;
    c.end = Math.max(c.end, Math.min(limit, c.end + 0.6));
  });
  return cues;
}
