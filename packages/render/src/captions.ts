import type { VoiceManifest } from "@demovie/core";

function stamp(seconds: number, sep: "." | ","): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(rest).padStart(3, "0")}`;
}

/** Split a VO line into caption cues of at most `maxWords`, timed by the word timings when present. */
export function cuesFor(
  line: VoiceManifest["lines"][number],
  maxWords = 7,
): { start: number; end: number; text: string }[] {
  const words = line.words.length ? line.words : null;
  if (!words) return [{ start: line.start, end: line.start + line.duration, text: line.text }];
  const cues: { start: number; end: number; text: string }[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const group = words.slice(i, i + maxWords);
    const next = words[i + maxWords];
    cues.push({
      start: line.start + group[0]!.start,
      end:
        line.start +
        (next
          ? Math.min(next.start, group[group.length - 1]!.end + 0.25)
          : Math.max(group[group.length - 1]!.end, line.duration)),
      text: group.map((w) => w.text).join(" "),
    });
  }
  return cues;
}

/** WebVTT and SRT sidecars from the voice manifest. */
export function captionsFromManifest(manifest: VoiceManifest): { vtt: string; srt: string } {
  const cues = manifest.lines.flatMap((l) => cuesFor(l));
  const vtt = [
    "WEBVTT",
    "",
    ...cues.flatMap((c, i) => [String(i + 1), `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}`, c.text, ""]),
  ].join("\n");
  const srt = cues
    .flatMap((c, i) => [String(i + 1), `${stamp(c.start, ",")} --> ${stamp(c.end, ",")}`, c.text, ""])
    .join("\n");
  return { vtt, srt };
}
