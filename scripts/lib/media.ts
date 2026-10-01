/** ffprobe helpers shared by verify and verify:dogfood. */
import { execFileSync } from "node:child_process";

export interface MediaSummary {
  file: string;
  codec: string;
  profile: string;
  pixFmt: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  audio: string | null;
  sizeMb: number;
  colors: string;
}

export function summarize(file: string): MediaSummary {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], {
    encoding: "utf8",
  });
  const data = JSON.parse(out) as { streams: Record<string, any>[]; format: { duration?: string; size?: string } };
  const v = data.streams.find((s) => s.codec_type === "video") ?? {};
  const a = data.streams.find((s) => s.codec_type === "audio");
  const [num, den] = String(v.r_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  return {
    file,
    codec: v.codec_name,
    profile: v.profile,
    pixFmt: v.pix_fmt,
    width: Number(v.width),
    height: Number(v.height),
    fps: den ? num! / den : 0,
    duration: Number(v.duration ?? data.format.duration),
    audio: a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch` : null,
    sizeMb: Number(data.format.size ?? 0) / 1024 / 1024,
    colors: `${v.color_primaries}/${v.color_transfer}/${v.color_space}`,
  };
}

/** SPEC §18 check 8: codec h264, pix_fmt yuv420p, size, fps, duration ± 1 frame, audio stream present. */
export function assertVideo(
  s: MediaSummary,
  expected: { width: number; height: number; fps: number; duration: number },
): string[] {
  const problems: string[] = [];
  if (s.codec !== "h264") problems.push(`codec ${s.codec} (want h264)`);
  if (s.pixFmt !== "yuv420p") problems.push(`pix_fmt ${s.pixFmt} (want yuv420p)`);
  if (s.width !== expected.width || s.height !== expected.height)
    problems.push(`size ${s.width}x${s.height} (want ${expected.width}x${expected.height})`);
  if (Math.abs(s.fps - expected.fps) > 0.01) problems.push(`fps ${s.fps} (want ${expected.fps})`);
  if (Math.abs(s.duration - expected.duration) > 1 / expected.fps + 1e-6)
    problems.push(`duration ${s.duration}s (want ${expected.duration}s ± 1 frame)`);
  if (!s.audio) problems.push("no audio stream");
  return problems;
}

export function describeMedia(s: MediaSummary): string {
  return `${s.file.split("/").pop()}: ${s.codec} ${s.profile} ${s.pixFmt} ${s.width}x${s.height} ${s.fps}fps ${s.duration.toFixed(3)}s · audio ${s.audio ?? "none"} · ${s.colors} · ${s.sizeMb.toFixed(1)} MB`;
}
