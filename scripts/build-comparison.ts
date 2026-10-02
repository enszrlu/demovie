/**
 * Build the README comparison (SPEC §19): docs/media/grounded-vs-generic.mp4 and .gif — the "one-prompt" baseline
 * (examples/baseline-one-prompt, no captures) next to the grounded launch video made with demovie
 * (examples/harborly/.demovie/videos/launch). Render both first:
 *
 *   node packages/cli/dist/index.js --cwd examples/harborly render ../baseline-one-prompt --format 16:9
 *   node packages/cli/dist/index.js --cwd examples/harborly render launch --format 16:9
 *   pnpm comparison:build
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./lib/repo.ts";

const left = path.join(repoRoot, "examples/baseline-one-prompt/out/baseline-one-prompt-16x9.mp4");
const right = path.join(repoRoot, "examples/harborly/.demovie/videos/launch/out/launch-16x9.mp4");
for (const f of [left, right])
  if (!existsSync(f)) throw new Error(`${path.relative(repoRoot, f)} is missing: render it first (see the header)`);

const font = [
  "/System/Library/Fonts/SFNS.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  path.join(repoRoot, "packages/runtime/fonts/geist-variable.woff2"),
].find((f) => existsSync(f))!;
const tmp = mkdtempSync(path.join(os.tmpdir(), "demovie-comparison-"));
const label = (name: string, text: string) => {
  const file = path.join(tmp, `${name}.txt`);
  writeFileSync(file, text);
  return file;
};
const leftLabel = label("left", "One prompt, no captures");
const rightLabel = label("right", "demovie: real captures, checked by QA");

const outDir = path.join(repoRoot, "docs/media");
mkdirSync(outDir, { recursive: true });
const mp4 = path.join(outDir, "grounded-vs-generic.mp4");
const gif = path.join(outDir, "grounded-vs-generic.gif");
const duration = 35;
const W = 928;
const H = 522;
const text = (file: string, x: number, color: string) =>
  `drawtext=fontfile=${font}:textfile=${file}:fontsize=34:fontcolor=${color}:x=${x}+${W / 2}-text_w/2:y=32`;

execFileSync(
  "ffmpeg",
  [
    "-v",
    "error",
    "-y",
    "-i",
    left,
    "-i",
    right,
    "-filter_complex",
    [
      `[0:v]scale=${W}:${H},setsar=1,tpad=stop_mode=clone:stop_duration=${duration}[l]`,
      `[1:v]scale=${W}:${H},setsar=1[r]`,
      `color=c=0x0b0b0d:s=1920x640:r=30:d=${duration}[bg]`,
      "[bg][l]overlay=x=24:y=94[a]",
      "[a][r]overlay=x=968:y=94[b]",
      // both inputs are BT.709 and the graph only scales and overlays them: tag the frames the same way
      `[b]${text(leftLabel, 24, "0xa1a1aa")},${text(rightLabel, 968, "0xffffff")},setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`,
    ].join(";"),
    "-map",
    "[v]",
    "-map",
    "1:a",
    "-t",
    String(duration),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-crf",
    "20",
    "-preset",
    "slow",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    mp4,
  ],
  { stdio: "inherit" },
);

// GIF for the README: the product part of both (3–17 s), small enough to stay under 8 MB.
const palette = path.join(tmp, "palette.png");
const gifArgs = (width: number, fps: number) => [
  [
    "-v",
    "error",
    "-y",
    "-ss",
    "3",
    "-t",
    "14",
    "-i",
    mp4,
    "-vf",
    `fps=${fps},scale=${width}:-2:flags=lanczos,palettegen=stats_mode=diff`,
    palette,
  ],
  [
    "-v",
    "error",
    "-y",
    "-ss",
    "3",
    "-t",
    "14",
    "-i",
    mp4,
    "-i",
    palette,
    "-lavfi",
    `fps=${fps},scale=${width}:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    gif,
  ],
];
for (const [width, fps] of [
  [960, 10],
  [800, 10],
  [720, 8],
] as const) {
  for (const args of gifArgs(width, fps)) execFileSync("ffmpeg", args, { stdio: "inherit" });
  const mb = statSync(gif).size / 1024 / 1024;
  process.stdout.write(`${path.relative(repoRoot, gif)}: ${width}px, ${fps} fps, ${mb.toFixed(1)} MB\n`);
  if (mb <= 8) break;
}
process.stdout.write(`${path.relative(repoRoot, mp4)}: ${(statSync(mp4).size / 1024 / 1024).toFixed(1)} MB\n`);
