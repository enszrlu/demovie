/**
 * README gallery (SPEC §19): one 16:9 still per reference composition and per Harborly dogfood video, at its poster
 * time, copied to docs/media/examples/<name>.png. Needs Harborly's captures (`demovie capture`) and a built CLI.
 *
 *   pnpm gallery:build
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/repo.ts";

const CLI = path.join(repoRoot, "packages/cli/dist/index.js");
const HARBORLY = path.join(repoRoot, "examples/harborly");
const entries: { name: string; slug: string; dir: string; at?: number }[] = [
  ...["clean", "bold", "soft", "editorial", "terminal"].map((style) => ({
    name: `${style}-launch`,
    slug: `../compositions/${style}-launch`,
    dir: path.join(repoRoot, "examples/compositions", `${style}-launch`),
  })),
  { name: "harborly-launch", slug: "launch", dir: path.join(HARBORLY, ".demovie/videos/launch") },
  // the changelog's poster repeats the launch video's board frame; show its dashboard shot instead
  { name: "harborly-changelog", slug: "changelog", dir: path.join(HARBORLY, ".demovie/videos/changelog"), at: 9.5 },
];

const outDir = path.join(repoRoot, "docs/media/examples");
mkdirSync(outDir, { recursive: true });
for (const e of entries) {
  const video = JSON.parse(readFileSync(path.join(e.dir, "video.json"), "utf8")) as {
    poster?: number | null;
    duration: number;
  };
  const at = e.at ?? video.poster ?? Math.round(video.duration * 3) / 10;
  const stills = spawnSync(
    process.execPath,
    [CLI, "--cwd", HARBORLY, "stills", e.slug, "--at", String(at), "--format", "16:9"],
    { stdio: "inherit" },
  );
  if (stills.status !== 0) throw new Error(`demovie stills ${e.slug} failed (exit ${stills.status})`);
  // stills are named t<seconds, 3 integer digits>.<2 decimals>.png, at the default scale (960×540 for 16:9)
  const still = path.join(e.dir, "out/stills/16x9", `t${at.toFixed(2).padStart(6, "0")}.png`);
  copyFileSync(still, path.join(outDir, `${e.name}.png`));
  process.stdout.write(`docs/media/examples/${e.name}.png ← ${e.slug} at ${at} s\n`);
}
