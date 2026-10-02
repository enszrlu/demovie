#!/usr/bin/env node
/**
 * Stands in for the user's agent in tests (SPEC §15.2): instead of calling an LLM, it copies a reference composition
 * into `.demovie/videos/<slug>/`, then runs QA and a draft render — what a real agent does once it has animated.
 */
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const prompt = process.argv.slice(2).join(" ");
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const source = path.join(repo, "examples/compositions", process.env.MOCK_COMPOSITION || "clean-launch");
const slug = process.env.MOCK_SLUG || "action-e2e";
const dest = path.join(process.cwd(), ".demovie", "videos", slug);
rmSync(dest, { recursive: true, force: true });
cpSync(source, dest, { recursive: true, filter: (src) => !/[/\\](out|goldens)([/\\]|$)|qa\.json$/.test(src) });
const video = JSON.parse(readFileSync(path.join(dest, "video.json"), "utf8"));
Object.assign(video, { slug, title: `${video.title} (mock agent)`, status: "animating" });
writeFileSync(path.join(dest, "video.json"), `${JSON.stringify(video, null, 2)}\n`);
writeFileSync(path.join(dest, "prompt.txt"), `${prompt}\n`);
const [bin, ...pre] = (process.env.DEMOVIE_BIN || "npx demovie").split(" ").filter(Boolean);
for (const step of [
  ["qa", slug, "--format", "16:9"],
  ["render", slug, "--quality", "draft", "--format", "16:9"],
]) {
  const r = spawnSync(bin, [...pre, ...step], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
