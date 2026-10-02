#!/usr/bin/env node
/**
 * The steps of the demovie GitHub Action (SPEC §15.2). Plain Node (no dependencies, no build) so the composite
 * action can run it straight from its checkout.
 *
 *   demovie-action.mjs install-agent   install the pinned agent CLI (AGENT, AGENT_VERSION)
 *   demovie-action.mjs run             doctor → capture --changed → changes → make --yes → summary + outputs
 *   demovie-action.mjs report          PR comment / job summary / release assets from the summary
 *
 * `--dry-run` (or DEMOVIE_ACTION_DRY_RUN=1) prints the commands instead of running them. Outside GitHub Actions,
 * `report` never calls GitHub: it writes the comment to .demovie/.cache/action-comment.md and prints the gh commands.
 * DEMOVIE_BIN overrides the demovie command (default `npx demovie`); DEMOVIE_ACTION_AGENT_CMD swaps the agent for a
 * custom command (tests use a mock that copies a reference composition into place).
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const AGENT_PACKAGES = { claude: "@anthropic-ai/claude-code", codex: "@openai/codex" };
const env = process.env;
const args = process.argv.slice(2);
const command = args[0];
const dryRun = args.includes("--dry-run") || env.DEMOVIE_ACTION_DRY_RUN === "1";
const inGitHub = env.GITHUB_ACTIONS === "true";
const cwd = process.cwd();
const cacheDir = path.join(cwd, ".demovie", ".cache");
const summaryFile = path.join(cacheDir, "action-summary.json");
const planned = [];

const quote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replaceAll("'", "'\\''")}'`);

function fail(message) {
  console.error(inGitHub ? `::error::${message}` : `error: ${message}`);
  process.exit(1);
}

function run(cmd, cmdArgs, o = {}) {
  const printable = [cmd, ...cmdArgs].map(quote).join(" ");
  if (dryRun || o.plan) {
    planned.push(printable);
    console.log(`[dry-run] ${printable}`);
    return { status: 0, stdout: o.dryStdout ?? "" };
  }
  console.log(`$ ${printable}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    env: { ...env, ...o.env },
    encoding: "utf8",
    stdio: o.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) fail(`${printable}: ${r.error.message}`);
  if (r.status !== 0 && !o.allowFail) fail(`${printable} exited with ${r.status}`);
  return r;
}

function demovie(demovieArgs, o = {}) {
  const [bin, ...pre] = (env.DEMOVIE_BIN || "npx demovie").split(" ").filter(Boolean);
  return run(bin, [...pre, ...demovieArgs], o);
}

function git(gitArgs) {
  const r = spawnSync("git", gitArgs, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function setOutput(name, value) {
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
  else console.log(`output ${name}=${value}`);
}

function eventPayload() {
  try {
    return env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) : {};
  } catch {
    return {};
  }
}

/** The input, else the previous tag (on a release HEAD is the new tag), else the last 20 commits. */
export function defaultSince() {
  if (env.DEMOVIE_ACTION_SINCE) return env.DEMOVIE_ACTION_SINCE;
  const tag = git(["describe", "--tags", "--abbrev=0", env.GITHUB_EVENT_NAME === "release" ? "HEAD^" : "HEAD"]);
  if (tag) return tag;
  return Number(git(["rev-list", "--count", "HEAD"]) ?? 0) > 20 ? "HEAD~20" : null;
}

/** Vercel deployment protection: the bypass secret is sent as headers on every app request. */
function appEnv() {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret || env.DEMOVIE_APP_HEADERS) return {};
  return {
    DEMOVIE_APP_HEADERS: JSON.stringify({ "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" }),
  };
}

function installAgent() {
  const agent = env.AGENT || "claude";
  const pkg = AGENT_PACKAGES[agent];
  if (!pkg) fail(`agent must be claude or codex (got "${agent}")`);
  run("npm", ["install", "--global", `${pkg}@${env.AGENT_VERSION || "latest"}`]);
}

function videoDirs(since) {
  const root = path.join(cwd, ".demovie", "videos");
  if (!existsSync(root)) return [];
  const out = [];
  for (const slug of readdirSync(root)) {
    const outDir = path.join(root, slug, "out");
    if (!existsSync(outDir)) continue;
    const all = readdirSync(outDir).filter((f) => f.endsWith(".mp4"));
    const finals = all.filter((f) => !f.includes(".draft."));
    const mp4s = (finals.length ? finals : all).map((f) => path.join(outDir, f));
    if (mp4s.some((f) => statSync(f).mtimeMs >= since)) out.push({ dir: path.join(root, slug), mp4s });
  }
  return out;
}

function describeVideo({ dir, mp4s }) {
  const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
  const qaFile = path.join(dir, "qa.json");
  const qa = existsSync(qaFile) ? JSON.parse(readFileSync(qaFile, "utf8")) : null;
  const outDir = path.join(dir, "out");
  return {
    slug: video.slug,
    title: video.title,
    type: video.type,
    duration: video.duration,
    outDir: path.relative(cwd, outDir),
    mp4s: mp4s.map((f) => path.relative(cwd, f)),
    posters: readdirSync(outDir)
      .filter((f) => /^poster-.*\.png$/.test(f))
      .map((f) => path.relative(cwd, path.join(outDir, f))),
    qa: qa?.summary ?? null,
  };
}

function runSteps() {
  const started = Date.now();
  const since = defaultSince();
  const type = env.DEMOVIE_ACTION_TYPE || "changelog";
  const extra = { env: appEnv() };
  demovie(["doctor"], extra);
  demovie(["capture", "--changed", ...(since ? ["--since", since] : [])], extra);
  let story = "";
  if (type === "changelog") {
    const r = demovie(["--json", "changes", ...(since ? ["--since", since] : [])], {
      ...extra,
      capture: true,
      dryStdout: "{}",
    });
    try {
      story = JSON.parse(r.stdout).suggestions?.story ?? "";
    } catch {
      story = "";
    }
  }
  const agent = env.DEMOVIE_ACTION_AGENT_CMD
    ? ["--agent", "custom", "--agent-cmd", env.DEMOVIE_ACTION_AGENT_CMD]
    : ["--agent", env.DEMOVIE_ACTION_AGENT || "claude"];
  demovie(
    [
      "make",
      ...agent,
      "--type",
      type,
      ...(env.DEMOVIE_ACTION_FORMATS ? ["--format", env.DEMOVIE_ACTION_FORMATS] : []),
      ...(story ? ["--about", story] : []),
      "--yes",
    ],
    extra,
  );
  mkdirSync(cacheDir, { recursive: true });
  if (dryRun) {
    writeFileSync(summaryFile, `${JSON.stringify({ dryRun: true, since, story, planned, videos: [] }, null, 2)}\n`);
    setOutput("summary", summaryFile);
    return;
  }
  const videos = videoDirs(started - 1000).map(describeVideo);
  if (!videos.length) fail("the agent finished without rendering a video (no new MP4 in .demovie/videos/*/out)");
  const summary = {
    since,
    story,
    run: env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : null,
    videos,
  };
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  setOutput("videos", JSON.stringify(videos.flatMap((v) => v.mp4s)));
  setOutput("out-dir", videos[0].outDir);
  setOutput("summary", summaryFile);
}

export function commentMarkdown(summary, assetBase = null) {
  const lines = ["### demovie video", ""];
  if (summary.story) lines.push(`Changes since \`${summary.since ?? "the start"}\`: ${summary.story}`, "");
  for (const v of summary.videos) {
    lines.push(`**${v.title}** · ${v.type} · ${v.duration} s`);
    if (assetBase && v.posters[0]) lines.push("", `![poster](${assetBase}/${path.basename(v.posters[0])})`);
    lines.push("", "| File | |", "|---|---|");
    for (const f of v.mp4s)
      lines.push(
        `| \`${path.basename(f)}\` | ${assetBase ? `[download](${assetBase}/${path.basename(f)})` : "in the workflow artifact"} |`,
      );
    if (v.qa) lines.push("", `QA: ${v.qa.errors} error(s), ${v.qa.warnings} warning(s), ${v.qa.waived} waived.`);
    lines.push("");
  }
  if (summary.run) lines.push(`Artifacts: [workflow run](${summary.run})`, "");
  lines.push("<sub>Made with demovie from real captures of this app.</sub>", "");
  return lines.join("\n");
}

function prNumber(event) {
  if (event.pull_request?.number) return event.pull_request.number;
  if (event.issue?.pull_request && event.issue.number) return event.issue.number;
  const sha = event.deployment?.sha;
  if (!sha || !inGitHub) return null;
  const r = spawnSync("gh", ["pr", "list", "--state", "open", "--search", sha, "--json", "number"], {
    cwd,
    encoding: "utf8",
  });
  try {
    return JSON.parse(r.stdout)[0]?.number ?? null;
  } catch {
    return null;
  }
}

function report() {
  if (!existsSync(summaryFile)) fail(`no ${path.relative(cwd, summaryFile)}: run \`demovie-action.mjs run\` first`);
  const summary = JSON.parse(readFileSync(summaryFile, "utf8"));
  const event = eventPayload();
  const tag = env.GITHUB_EVENT_NAME === "release" ? event.release?.tag_name : null;
  const assetBase =
    tag && env.DEMOVIE_ACTION_UPLOAD_RELEASE !== "false"
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/releases/download/${tag}`
      : null;
  const md = commentMarkdown(summary, assetBase);
  mkdirSync(cacheDir, { recursive: true });
  const commentFile = path.join(cacheDir, "action-comment.md");
  writeFileSync(commentFile, md);
  console.log(`comment → ${path.relative(cwd, commentFile)}`);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md);
  const plan = !inGitHub; // never talk to GitHub from a developer machine
  if (env.DEMOVIE_ACTION_COMMENT !== "false") {
    const pr = prNumber(event);
    if (pr) run("gh", ["pr", "comment", String(pr), "--body-file", commentFile], { allowFail: true, plan });
  }
  if (tag && env.DEMOVIE_ACTION_UPLOAD_RELEASE !== "false") {
    const files = summary.videos.flatMap((v) => [...v.mp4s, ...v.posters]);
    if (files.length) run("gh", ["release", "upload", tag, ...files, "--clobber"], { plan });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  if (command === "install-agent") installAgent();
  else if (command === "run") runSteps();
  else if (command === "report") report();
  else fail("usage: demovie-action.mjs <install-agent|run|report> [--dry-run]");
}
