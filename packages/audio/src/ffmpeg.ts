import { DemovieError, which } from "@demovie/core";
import { execa } from "execa";
import type { PcmAudio } from "./wav.ts";

export const FFMPEG_FIX =
  process.platform === "darwin"
    ? "brew install ffmpeg"
    : process.platform === "win32"
      ? "winget install ffmpeg"
      : "sudo apt-get install -y ffmpeg";

export function ffmpegBin(): string {
  const bin = which("ffmpeg");
  if (!bin)
    throw new DemovieError("E_PREREQ_FFMPEG", "ffmpeg not found on PATH (demovie uses your system ffmpeg)", FFMPEG_FIX);
  return bin;
}

export function ffprobeBin(): string {
  const bin = which("ffprobe");
  if (!bin) throw new DemovieError("E_PREREQ_FFMPEG", "ffprobe not found on PATH", FFMPEG_FIX);
  return bin;
}

/** Decode any audio file to planar float PCM (default 48 kHz stereo) through ffmpeg. */
export async function decodeAudio(file: string, sampleRate = 48_000, channelCount = 2): Promise<PcmAudio> {
  const result = await execa(
    ffmpegBin(),
    [
      "-v",
      "error",
      "-i",
      file,
      "-vn",
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "-ac",
      `${channelCount}`,
      "-ar",
      `${sampleRate}`,
      "-",
    ],
    { encoding: "buffer", reject: false, stripFinalNewline: false },
  );
  if (result.exitCode !== 0) {
    throw new DemovieError(
      "E_AUDIO",
      `could not decode ${file}: ${Buffer.from(result.stderr as Uint8Array)
        .toString()
        .trim()
        .split("\n")
        .pop()}`,
      "check that the file is a valid audio file (wav, mp3, m4a, ogg, flac)",
    );
  }
  const bytes = result.stdout as Uint8Array;
  const interleaved = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const frames = Math.floor(interleaved.length / channelCount);
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channelCount; c++) channels[c]![i] = interleaved[i * channelCount + c]!;
  return { sampleRate, channels };
}

/** Container duration in seconds (ffprobe), or null when it can't be read. */
export async function probeDuration(file: string): Promise<number | null> {
  const result = await execa(
    ffprobeBin(),
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { reject: false },
  );
  const d = Number.parseFloat(String(result.stdout).trim());
  return Number.isFinite(d) ? d : null;
}

export interface Loudness {
  integrated: number;
  truePeak: number;
  range: number;
}

/** EBU R128 integrated loudness (LUFS), true peak (dBTP) and loudness range (LU) via ffmpeg `ebur128`. */
export async function measureLoudness(file: string): Promise<Loudness> {
  const result = await execa(
    ffmpegBin(),
    ["-hide_banner", "-nostats", "-i", file, "-filter_complex", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
    { reject: false, all: true },
  );
  const text = String(result.all ?? "");
  const summary = text.slice(text.lastIndexOf("Summary:"));
  const num = (re: RegExp) => {
    const m = summary.match(re);
    return m ? Number(m[1]) : Number.NaN;
  };
  const integrated = num(/I:\s+(-?[\d.]+|-inf)\s+LUFS/);
  const truePeak = num(/True peak:[\s\S]*?Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  const range = num(/LRA:\s+(-?[\d.]+)\s+LU/);
  if (!Number.isFinite(integrated))
    throw new DemovieError(
      "E_AUDIO",
      `could not measure loudness of ${file}`,
      "check that the file is a valid audio file",
    );
  return {
    integrated,
    truePeak: Number.isFinite(truePeak) ? truePeak : -120,
    range: Number.isFinite(range) ? range : 0,
  };
}

export interface LoudnormMeasurement {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  target_offset: number;
  normalization_type?: string;
  output_i?: number;
  output_tp?: number;
}

function parseLoudnormJson(stderr: string): LoudnormMeasurement {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new DemovieError("E_AUDIO", "loudnorm printed no measurement", "update ffmpeg (≥ 4.0)");
  const raw = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
  const n = (k: string) => Number.parseFloat(raw[k] ?? "NaN");
  return {
    input_i: n("input_i"),
    input_tp: n("input_tp"),
    input_lra: n("input_lra"),
    input_thresh: n("input_thresh"),
    target_offset: n("target_offset"),
    ...(raw.normalization_type ? { normalization_type: raw.normalization_type } : {}),
    ...(raw.output_i ? { output_i: n("output_i"), output_tp: n("output_tp") } : {}),
  };
}

export interface LoudnessTarget {
  lufs: number;
  truePeak: number;
}

const lraFor = (m: LoudnormMeasurement) => Math.min(50, Math.max(7, Math.ceil((m.input_lra || 0) + 1)));

/** loudnorm pass 1: measure. */
export async function loudnormMeasure(file: string, target: LoudnessTarget): Promise<LoudnormMeasurement> {
  const result = await execa(
    ffmpegBin(),
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-af",
      `loudnorm=I=${target.lufs}:TP=${target.truePeak}:LRA=11:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    { reject: false },
  );
  return parseLoudnormJson(String(result.stderr));
}

/**
 * loudnorm pass 2: apply linearly with the pass-1 measurement (the target LRA is raised to the source's so linear
 * mode isn't refused), resample to 48 kHz stereo 16-bit with bit-exact headers (deterministic output).
 */
export async function loudnormApply(
  input: string,
  output: string,
  target: LoudnessTarget,
  m: LoudnormMeasurement,
): Promise<LoudnormMeasurement> {
  const filter =
    `loudnorm=I=${target.lufs}:TP=${target.truePeak}:LRA=${lraFor(m)}` +
    `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
  const result = await execa(
    ffmpegBin(),
    [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      input,
      "-af",
      filter,
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      "-map_metadata",
      "-1",
      "-fflags",
      "+bitexact",
      "-flags:a",
      "+bitexact",
      output,
    ],
    { reject: false },
  );
  if (result.exitCode !== 0)
    throw new DemovieError(
      "E_AUDIO",
      `loudnorm failed: ${String(result.stderr).trim().split("\n").pop()}`,
      "update ffmpeg",
    );
  return parseLoudnormJson(String(result.stderr));
}
