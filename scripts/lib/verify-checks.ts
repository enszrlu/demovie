import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import type { Check, CheckContext, CheckOutcome } from "../verify.ts";
import { checkDocs } from "./docs-check.ts";
import { assertVideo, describeMedia, loudness, summarize } from "./media.ts";
import { listRepoFiles, repoRoot } from "./repo.ts";
import { tarballSmoke } from "./smoke.ts";

const exists = (rel: string): boolean => existsSync(path.join(repoRoot, rel));
const missing = (rel: string, feature: string): string | undefined =>
  exists(rel) ? undefined : `${feature} not implemented yet (${rel})`;

interface VitestJson {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  success: boolean;
  testResults: { assertionResults: { fullName: string; status: string }[] }[];
}

async function vitest(ctx: CheckContext, project: "unit" | "integration"): Promise<CheckOutcome> {
  const jsonFile = path.join(ctx.logDir, `vitest-${project}.json`);
  rmSync(jsonFile, { force: true });
  const result = await ctx.sh("pnpm", [
    "exec",
    "vitest",
    "run",
    "--project",
    project,
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=${jsonFile}`,
  ]);
  if (!existsSync(jsonFile)) return { status: "fail", detail: `vitest exited ${result.code} without a report` };
  const report = JSON.parse(readFileSync(jsonFile, "utf8")) as VitestJson;
  const skipped = report.testResults
    .flatMap((f) => f.assertionResults)
    .filter((a) => a.status === "pending" || a.status === "skipped" || a.status === "todo");
  // the only tests allowed to skip are live paid-API tests without the user's keys (GOAL.md)
  const unexpected = skipped.filter((a) => !/\blive\b/i.test(a.fullName));
  const why = skipped.length > unexpected.length ? " (live paid-API tests: no API keys set)" : "";
  const detail = `${report.numPassedTests} passed, ${report.numFailedTests} failed, ${skipped.length} skipped${why}`;
  if (unexpected.length)
    return { status: "fail", detail: `${detail}; unexpected skips: ${unexpected.map((a) => a.fullName).join("; ")}` };
  return { status: result.code === 0 && report.success ? "pass" : "fail", detail };
}

export const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

const pass = (detail: string): CheckOutcome => ({ status: "pass", detail });

/**
 * The reference compositions' WAVs are gitignored: regenerate music (when it is the synth's) and the mix for every
 * composition that declares audio. Both are deterministic, so committed beats.json/provenance.json stay unchanged.
 */
export async function ensureCompositionAudio(
  ctx: CheckContext,
  composition: string,
): Promise<{ ok: boolean; detail: string }> {
  const dir = path.join(repoRoot, "examples/compositions", composition);
  const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")) as {
    audio?: { music?: { src: string } | null; sfx?: unknown[] };
  };
  const steps: string[][] = [];
  if (video.audio?.music?.src === "audio/music.wav") steps.push(["audio", "music"]);
  if (video.audio?.music || (video.audio?.sfx?.length ?? 0) > 0) steps.push(["audio", "mix"]);
  for (const step of steps) {
    const r = await ctx.sh("node", [CLI, "--cwd", "examples/harborly", ...step, `../compositions/${composition}`]);
    if (r.code !== 0) return { ok: false, detail: `${composition}: demovie ${step.join(" ")} exited ${r.code}` };
  }
  return { ok: true, detail: steps.length ? "audio generated" : "no audio" };
}

export const CLI = "packages/cli/dist/index.js";
export const FIXTURE_ENV = { DEMOVIE_USER: "demo@harborly.demo", DEMOVIE_PASSWORD: "harborly-demo" };

/** Captures are gitignored: regenerate Harborly's when a composition needs states that don't exist yet. */
export async function ensureHarborlyCaptures(
  ctx: CheckContext,
  composition: string,
): Promise<{ ok: boolean; detail: string }> {
  const video = JSON.parse(
    readFileSync(path.join(repoRoot, "examples/compositions", composition, "video.json"), "utf8"),
  ) as { captures: string[] };
  const missingIds = video.captures.filter(
    (id) => !existsSync(path.join(repoRoot, "examples/harborly/.demovie/captures", id, "screen.png")),
  );
  if (missingIds.length === 0) return { ok: true, detail: "captures present" };
  const r = await ctx.sh("node", [CLI, "--cwd", "examples/harborly", "capture"], {
    env: FIXTURE_ENV,
    timeoutMs: 15 * 60_000,
  });
  return r.code === 0
    ? { ok: true, detail: "captured Harborly" }
    : { ok: false, detail: `demovie capture exited ${r.code}` };
}
const fail = (detail: string): CheckOutcome => ({ status: "fail", detail });

export const verifyChecks: Check[] = [
  {
    name: "Biome",
    run: async (ctx) => {
      const r = await ctx.sh("pnpm", ["exec", "biome", "ci", "--colors=off", "."]);
      const summary = stripAnsi(r.output).match(/Checked \d+ files?[^\n]*/)?.[0] ?? `exit ${r.code}`;
      return r.code === 0 ? pass(summary) : fail(summary);
    },
  },
  {
    name: "Typecheck",
    run: async (ctx) => {
      const r = await ctx.sh("pnpm", ["run", "typecheck"]);
      const errors = (r.output.match(/error TS\d+/g) ?? []).length;
      return r.code === 0
        ? pass("packages, scripts and examples/harborly (tsc strict)")
        : fail(`${errors} type errors`);
    },
  },
  {
    name: "Unit tests",
    run: (ctx) => vitest(ctx, "unit"),
  },
  {
    name: "Build",
    run: async (ctx) => {
      const r = await ctx.sh("pnpm", ["run", "build"]);
      if (r.code !== 0) return fail(`pnpm build exited ${r.code}`);
      const v = await ctx.sh("node", ["packages/cli/dist/index.js", "--version"]);
      return v.code === 0
        ? pass(`all packages built; demovie --version → ${v.stdout.trim()}`)
        : fail("built CLI does not run");
    },
  },
  {
    name: "License check",
    run: async (ctx) => {
      const r = await ctx.sh("pnpm", ["exec", "tsx", "scripts/check-licenses.ts"]);
      return r.code === 0
        ? pass(r.stdout.trim().replace(/^License check OK: /, ""))
        : fail("forbidden or unknown licenses");
    },
  },
  {
    name: "Integration tests",
    pendingReason: () =>
      listRepoFiles().some((f) => f.endsWith(".int.test.ts")) ? undefined : "no integration tests yet (M1+)",
    run: (ctx) => vitest(ctx, "integration"),
  },
  {
    name: "QA reference compositions",
    pendingReason: () =>
      missing("packages/qa/src/engine.ts", "QA engine (M4)") ??
      missing("examples/compositions/clean-launch/video.json", "clean-launch"),
    run: async (ctx) => {
      const root = path.join(repoRoot, "examples/compositions");
      const dirs = readdirSync(root)
        .filter((d) => existsSync(path.join(root, d, "video.json")))
        .sort();
      const good: string[] = [];
      const bad: string[] = [];
      let intended = 0;
      for (const dir of dirs) {
        const ready = await ensureHarborlyCaptures(ctx, dir);
        if (!ready.ok) return fail(ready.detail);
        const sound = await ensureCompositionAudio(ctx, dir);
        if (!sound.ok) return fail(sound.detail);
        const expectedFile = path.join(root, dir, "expected-qa.json");
        const expected = existsSync(expectedFile)
          ? (JSON.parse(readFileSync(expectedFile, "utf8")) as { format: string; rules: string[] })
          : null;
        const r = await ctx.sh(
          "node",
          [
            CLI,
            "--cwd",
            "examples/harborly",
            "--json",
            "qa",
            `../compositions/${dir}`,
            "--format",
            expected?.format ?? "all",
            // Fixtures may target warn rules; --strict makes them fail the run too.
            ...(expected ? ["--strict"] : []),
          ],
          { timeoutMs: 20 * 60_000 },
        );
        let qa: {
          summary: { errors: number; warnings: number };
          reports: { format: string; rules: { id: string; status: string }[] }[];
        };
        try {
          qa = JSON.parse(r.stdout);
        } catch {
          return fail(`${dir}: qa did not return JSON (exit ${r.code})`);
        }
        if (!expected) {
          if (qa.summary.errors !== 0 || r.code !== 0)
            return fail(`${dir}: ${qa.summary.errors} QA error(s) (expected 0)`);
          good.push(`${dir} 0 errors/${qa.summary.warnings} warnings (${qa.reports.map((x) => x.format).join(", ")})`);
        } else {
          const failed = new Set(
            qa.reports.flatMap((x) => x.rules.filter((rule) => rule.status === "fail").map((rule) => rule.id)),
          );
          const missingRules = expected.rules.filter((id) => !failed.has(id));
          if (missingRules.length > 0 || r.code === 0)
            return fail(`${dir}: intended rules not triggered: ${missingRules.join(", ") || "(qa exited 0)"}`);
          intended += expected.rules.length;
          bad.push(dir);
        }
      }
      if (good.length === 0) return fail("no reference composition passed");
      return pass(`${good.join("; ")}; ${bad.length} bad-* fixtures trigger all ${intended} intended rules`);
    },
  },
  {
    name: "Render smoke test",
    pendingReason: () =>
      missing("packages/render/src/render.ts", "renderer (M3)") ??
      missing("examples/compositions/clean-launch/video.json", "clean-launch"),
    run: async (ctx) => {
      const ready = await ensureHarborlyCaptures(ctx, "clean-launch");
      if (!ready.ok) return fail(ready.detail);
      const sound = await ensureCompositionAudio(ctx, "clean-launch");
      if (!sound.ok) return fail(sound.detail);
      const r = await ctx.sh(
        "node",
        [
          CLI,
          "--cwd",
          "examples/harborly",
          "--json",
          "render",
          "../compositions/clean-launch",
          "--quality",
          "final",
          "--format",
          "all",
        ],
        { timeoutMs: 30 * 60_000 },
      );
      if (r.code !== 0) return fail(`render exited ${r.code}`);
      const report = JSON.parse(r.stdout) as { outputs: { format: string; file: string }[] };
      const video = JSON.parse(
        readFileSync(path.join(repoRoot, "examples/compositions/clean-launch/video.json"), "utf8"),
      ) as { fps: number; duration: number; audio?: { loudness?: { targetLufs?: number } } };
      const target = video.audio?.loudness?.targetLufs ?? -16;
      const lines: string[] = [];
      for (const out of report.outputs) {
        const file = path.resolve(repoRoot, "examples/harborly", out.file);
        const summary = summarize(file);
        const [w, h] =
          out.format === "16:9"
            ? [1920, 1080]
            : out.format === "9:16"
              ? [1080, 1920]
              : out.format === "1:1"
                ? [1080, 1080]
                : [1080, 1350];
        const problems = assertVideo(summary, { width: w!, height: h!, fps: video.fps, duration: video.duration });
        // M5: clean-launch has music + SFX; the rendered audio must sit within the target ± 1 LU
        const l = loudness(file);
        if (!(Math.abs(l.integrated - target) <= 1))
          problems.push(`loudness ${l.integrated} LUFS (want ${target} ± 1 LU)`);
        if (problems.length) return fail(`${out.format}: ${problems.join("; ")}`);
        lines.push(`${describeMedia(summary)} · ${l.integrated} LUFS, ${l.truePeak} dBTP`);
      }
      for (const l of lines) ctx.log(l);
      return pass(lines.join(" | "));
    },
  },
  {
    name: "MCP smoke test",
    pendingReason: () => missing("packages/cli/src/commands/mcp.ts", "MCP server (M6)"),
    run: async (ctx) => {
      const ready = await ensureHarborlyCaptures(ctx, "clean-launch");
      if (!ready.ok) return fail(ready.detail);
      const { EXPECTED_TOOLS, runMcpSmoke } = await import("../../packages/mcp/test/smoke.ts");
      const r = await runMcpSmoke({
        command: process.execPath,
        args: [path.join(repoRoot, CLI), "mcp"],
        cwd: path.join(repoRoot, "examples/harborly"),
        stillsSlug: "../compositions/clean-launch",
        format: "16:9",
      });
      if (r.tools.join(",") !== EXPECTED_TOOLS.join(","))
        return fail(`tools: ${r.tools.join(", ")} (want ${EXPECTED_TOOLS.join(", ")})`);
      if (r.status.ok !== true || r.status.initialized !== true)
        return fail(`status: ${JSON.stringify(r.status).slice(0, 200)}`);
      if (r.image?.mimeType !== "image/png" || r.image.bytes < 5000)
        return fail(`stills returned no PNG image: ${JSON.stringify(r.stills).slice(0, 200)}`);
      return pass(
        `SDK client over stdio (built CLI): ${r.tools.length} tools listed; status → initialized; stills → ${(r.image.bytes / 1024).toFixed(0)} KB PNG image content; ${r.progress} progress notification(s)`,
      );
    },
  },
  {
    name: "Skill lint",
    pendingReason: () => missing("packages/skill/demovie/SKILL.md", "Agent Skill (M6)"),
    run: async () => {
      const { lintSkill } = await import("./agent-checks.ts");
      const r = lintSkill();
      return r.ok ? pass(r.detail) : fail(r.detail);
    },
  },
  {
    name: "Plugin + marketplace manifests",
    pendingReason: () => missing(".claude-plugin/marketplace.json", "plugin marketplace (M6)"),
    run: async () => {
      const { checkPluginManifests } = await import("./agent-checks.ts");
      const r = checkPluginManifests();
      return r.ok ? pass(r.detail) : fail(r.detail);
    },
  },
  {
    name: "Action + scripts dry-run",
    pendingReason: () => missing("packages/action/action.yml", "GitHub Action (M7)"),
    run: async () => {
      const { dryRunAction, validateAction } = await import("./action-check.ts");
      const valid = validateAction();
      if (!valid.ok) return fail(valid.detail);
      const dry = dryRunAction(CLI);
      if (!dry.ok) return fail(dry.detail);
      return pass(`action.yml valid (${valid.inputs} inputs, ${valid.steps} composite steps); ${dry.detail}`);
    },
  },
  {
    name: "Docs check",
    pendingReason: () => missing("docs/getting-started.md", "docs (M9)"),
    run: async () => {
      const docs = checkDocs(CLI);
      return docs.ok ? pass(docs.detail) : fail(docs.detail);
    },
  },
  {
    name: "Package tarball smoke test",
    pendingReason: () => missing("packages/cli/src/commands/init.ts", "init/doctor (M1)"),
    run: (ctx) => tarballSmoke(ctx),
  },
];
