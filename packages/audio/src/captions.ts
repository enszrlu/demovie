import type { VoiceManifest } from "@demovie/core";

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

const MAX_WORDS = 7;
const MAX_CHARS = 42;
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Split voice lines into readable cues: ≤ 7 words and ≤ 42 characters, breaking after sentence punctuation. Lines
 * without word timings become one cue. Keep in sync with `captionCues` in packages/runtime/src/helpers.ts.
 */
export function captionCues(lines: VoiceManifest["lines"]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (const line of [...lines].sort((a, b) => a.start - b.start)) {
    const lineEnd = line.start + line.duration;
    if (line.words.length === 0) {
      cues.push({ start: round3(line.start), end: round3(lineEnd), text: line.text.trim() });
      continue;
    }
    let chunk: typeof line.words = [];
    const flush = () => {
      if (!chunk.length) return;
      cues.push({
        start: round3(line.start + chunk[0]!.start),
        end: round3(Math.min(lineEnd, line.start + chunk[chunk.length - 1]!.end)),
        text: chunk.map((w) => w.text).join(" "),
      });
      chunk = [];
    };
    for (const w of line.words) {
      const chars = chunk.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
      if (chunk.length >= MAX_WORDS || (chunk.length > 0 && chars > MAX_CHARS)) flush();
      chunk.push(w);
      if (/[.!?;:]$/.test(w.text) && chunk.length >= 2) flush();
    }
    flush();
  }
  // hold each cue until the next one (max 0.6 s extra) so captions don't flicker between words
  cues.forEach((c, i) => {
    const next = cues[i + 1];
    const limit = next ? next.start : c.end + 0.6;
    c.end = round3(Math.max(c.end, Math.min(limit, c.end + 0.6)));
  });
  return cues;
}

const stamp = (t: number, sep: "." | ","): string => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
};

export function toVtt(cues: CaptionCue[]): string {
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.text}\n`).join("\n")}`;
}

export function toSrt(cues: CaptionCue[]): string {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.text}\n`).join("\n");
}
