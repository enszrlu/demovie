import { existsSync } from "node:fs";
import path from "node:path";
import { DemovieError, which } from "@demovie/core";
import { execa } from "execa";

const FFMPEG_FIX =
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

export type H264Encoder = "libx264" | "h264_videotoolbox" | "libopenh264";
let encoderCache: H264Encoder | null = null;

/** libx264, else h264_videotoolbox (macOS), else libopenh264 (SPEC §11.3). */
export async function pickEncoder(): Promise<H264Encoder> {
  if (encoderCache) return encoderCache;
  const { stdout } = await execa(ffmpegBin(), ["-hide_banner", "-encoders"], { reject: false });
  const found = (["libx264", "h264_videotoolbox", "libopenh264"] as const).find((e) =>
    new RegExp(`\\b${e}\\b`).test(stdout),
  );
  if (!found)
    throw new DemovieError(
      "E_PREREQ_FFMPEG",
      "your ffmpeg has no H.264 encoder (libx264, h264_videotoolbox or libopenh264)",
      `install an ffmpeg build with libx264 (${FFMPEG_FIX})`,
    );
  encoderCache = found;
  return found;
}

async function ffmpeg(args: string[]): Promise<void> {
  const result = await execa(ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    reject: false,
    all: true,
  });
  if (result.exitCode !== 0) {
    throw new DemovieError(
      "E_RENDER",
      `ffmpeg failed (exit ${result.exitCode}): ${String(result.all ?? "")
        .trim()
        .split("\n")
        .slice(-6)
        .join("\n")}`,
      "run `npx demovie doctor` to check your ffmpeg build",
    );
  }
}

export interface EncodeOptions {
  framesDir: string;
  ext: "png" | "jpg";
  fps: number;
  duration: number;
  audio: string | null;
  out: string;
  quality: "draft" | "final";
}

/** H.264 yuv420p High profile, explicit RGB→YUV BT.709 with BT.709 tags, AAC 192k 48 kHz (or silence), faststart. */
export async function encodeMp4(o: EncodeOptions): Promise<{ encoder: H264Encoder }> {
  const encoder = await pickEncoder();
  const input = ["-framerate", String(o.fps), "-i", path.join(o.framesDir, `%06d.${o.ext}`)];
  const audioIn =
    o.audio && existsSync(o.audio)
      ? ["-i", o.audio]
      : ["-f", "lavfi", "-t", o.duration.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"];
  // Even dimensions for 4:2:0, then an explicit full-range RGB → limited-range BT.709 conversion.
  // setparams tags the frames themselves; ffmpeg 7 takes the stream's color tags from frame properties.
  const vf =
    "scale=trunc(iw/2)*2:trunc(ih/2)*2:in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv";
  const video =
    encoder === "libx264"
      ? [
          "-c:v",
          "libx264",
          "-profile:v",
          "high",
          "-preset",
          o.quality === "final" ? "slow" : "veryfast",
          "-crf",
          o.quality === "final" ? "18" : "28",
        ]
      : encoder === "h264_videotoolbox"
        ? ["-c:v", "h264_videotoolbox", "-profile:v", "high", "-b:v", o.quality === "final" ? "16M" : "4M"]
        : ["-c:v", "libopenh264", "-b:v", o.quality === "final" ? "16M" : "4M"];
  await ffmpeg([
    ...input,
    ...audioIn,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-vf",
    vf,
    ...video,
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-t",
    o.duration.toFixed(3),
    "-movflags",
    "+faststart",
    o.out,
  ]);
  return { encoder };
}

/** preview.gif: 720 px wide, 12 fps, palettegen (SPEC §11.3). */
export async function encodeGif(mp4: string, out: string, width = 720, fps = 12): Promise<void> {
  await ffmpeg([
    "-i",
    mp4,
    "-vf",
    `fps=${fps},scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=200[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop",
    "0",
    out,
  ]);
}

/** Optional VP9 WebM. */
export async function encodeWebm(mp4: string, out: string): Promise<void> {
  await ffmpeg([
    "-i",
    mp4,
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "32",
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-c:a",
    "libopus",
    "-b:a",
    "128k",
    out,
  ]);
}

export interface ProbeResult {
  codec: string | null;
  profile: string | null;
  pixFmt: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  colorPrimaries: string | null;
  colorTransfer: string | null;
  colorSpace: string | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
  size: number;
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout, exitCode } = await execa(
    ffprobeBin(),
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
    { reject: false },
  );
  if (exitCode !== 0) throw new DemovieError("E_RENDER", `ffprobe could not read ${file}`, "re-render the video");
  const data = JSON.parse(stdout) as {
    streams: Record<string, any>[];
    format: { duration?: string; size?: string };
  };
  const v = data.streams.find((s) => s.codec_type === "video") ?? {};
  const a = data.streams.find((s) => s.codec_type === "audio");
  const [num, den] = String(v.r_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  return {
    codec: v.codec_name ?? null,
    profile: v.profile ?? null,
    pixFmt: v.pix_fmt ?? null,
    width: Number(v.width ?? 0),
    height: Number(v.height ?? 0),
    fps: den ? num! / den : 0,
    duration: Number(v.duration ?? data.format.duration ?? 0),
    colorPrimaries: v.color_primaries ?? null,
    colorTransfer: v.color_transfer ?? null,
    colorSpace: v.color_space ?? null,
    audio: a ? { codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: Number(a.channels) } : null,
    size: Number(data.format.size ?? 0),
  };
}

/** Integrated loudness (LUFS) and true peak (dBTP) via ffmpeg's EBU R128 scanner. */
export async function measureLoudness(file: string): Promise<{ integrated: number; truePeak: number; range: number }> {
  const result = await execa(
    ffmpegBin(),
    ["-hide_banner", "-nostats", "-i", file, "-filter_complex", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
    {
      reject: false,
      all: true,
    },
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
