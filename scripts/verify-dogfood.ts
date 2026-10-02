/**
 * `pnpm verify:dogfood` (SPEC §18): the M8 dogfood outputs exist, `demovie qa` re-runs on them with 0 errors, and
 * ffprobe summaries are printed for the Harborly launch video (16:9, 9:16) and the changelog clip.
 * Outputs and captures are gitignored, so this checks a working copy where M8 was produced (`pnpm build` first).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { assertVideo, describeMedia, loudness, summarize } from "./lib/media.ts";
import { repoRoot } from "./lib/repo.ts";

const CLI = path.join(repoRoot, "packages/cli/dist/index.js");
const HARBORLY = path.join(repoRoot, "examples/harborly");
const SIZES: Record<string, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};
const VIDEOS = [
  { slug: "launch", formats: ["16:9", "9:16"], range: [30, 40] as const },
  { slug: "changelog", formats: ["16:9", "1:1"], range: [12, 18] as const },
];

const problems: string[] = [];
let checks = 0;
const ok = (line: string) => {
  checks++;
  process.stdout.write(`✓ ${line}\n`);
};
const bad = (line: string) => {
  problems.push(line);
  process.stdout.write(`✗ ${line}\n`);
};

if (!existsSync(CLI)) {
  process.stdout.write("✗ packages/cli/dist/index.js is missing: run `pnpm build` first\n");
  process.exit(1);
}

for (const v of VIDEOS) {
  const dir = path.join(HARBORLY, ".demovie/videos", v.slug);
  const videoFile = path.join(dir, "video.json");
  if (!existsSync(videoFile)) {
    bad(`${v.slug}: ${path.relative(repoRoot, videoFile)} is missing`);
    continue;
  }
  const video = JSON.parse(readFileSync(videoFile, "utf8")) as {
    duration: number;
    fps: number;
    formats: string[];
    audio?: { loudness?: { targetLufs?: number } };
  };
  if (video.duration < v.range[0] || video.duration > v.range[1])
    bad(`${v.slug}: duration ${video.duration} s is outside ${v.range[0]}–${v.range[1]} s`);
  for (const format of v.formats) {
    const file = path.join(dir, "out", `${v.slug}-${format.replace(":", "x")}.mp4`);
    if (!existsSync(file)) {
      bad(`${v.slug} ${format}: ${path.relative(repoRoot, file)} is missing (render it)`);
      continue;
    }
    const summary = summarize(file);
    const [width, height] = SIZES[format]!;
    const issues = assertVideo(summary, { width, height, fps: video.fps, duration: video.duration });
    const l = loudness(file);
    const target = video.audio?.loudness?.targetLufs ?? -16;
    if (!(Math.abs(l.integrated - target) <= 1)) issues.push(`loudness ${l.integrated} LUFS (want ${target} ± 1 LU)`);
    if (issues.length) bad(`${v.slug} ${format}: ${issues.join("; ")}`);
    else ok(`${describeMedia(summary)} · ${l.integrated} LUFS, ${l.truePeak} dBTP`);
  }
  const qa = spawnSync(process.execPath, [CLI, "--cwd", HARBORLY, "--json", "qa", v.slug, "--format", "all"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    const report = JSON.parse(qa.stdout) as { summary: { errors: number; warnings: number; waived: number } };
    const s = report.summary;
    if (s.errors === 0) ok(`${v.slug}: demovie qa → 0 errors, ${s.warnings} warning(s), ${s.waived} waived`);
    else bad(`${v.slug}: demovie qa → ${s.errors} error(s)`);
  } catch {
    bad(`${v.slug}: demovie qa failed (exit ${qa.status}): ${qa.stderr.trim().split("\n").pop()}`);
  }
}

const mp4 = path.join(repoRoot, "docs/media/grounded-vs-generic.mp4");
const gif = path.join(repoRoot, "docs/media/grounded-vs-generic.gif");
if (!existsSync(mp4)) bad("docs/media/grounded-vs-generic.mp4 is missing");
else ok(describeMedia(summarize(mp4)));
if (!existsSync(gif)) bad("docs/media/grounded-vs-generic.gif is missing");
else {
  const mb = statSync(gif).size / 1024 / 1024;
  if (mb > 8) bad(`grounded-vs-generic.gif is ${mb.toFixed(1)} MB (max 8 MB)`);
  else ok(`grounded-vs-generic.gif: ${mb.toFixed(1)} MB (≤ 8 MB)`);
}

if (problems.length) {
  process.stdout.write(`VERIFY DOGFOOD FAILED (${problems.length} problem(s))\n`);
  process.exit(1);
}
process.stdout.write(`VERIFY DOGFOOD OK (${checks} checks)\n`);
