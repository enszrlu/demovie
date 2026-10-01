import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import type { Check, CheckContext, CheckOutcome } from "../verify.ts";
import { listRepoFiles, repoRoot } from "./repo.ts";

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
  const skipped = report.numPendingTests + report.numTodoTests;
  const detail = `${report.numPassedTests} passed, ${report.numFailedTests} failed, ${skipped} skipped`;
  return { status: result.code === 0 && report.success ? "pass" : "fail", detail };
}

export const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

const pass = (detail: string): CheckOutcome => ({ status: "pass", detail });
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
    run: async () => fail("not wired yet"),
  },
  {
    name: "Render smoke test",
    pendingReason: () =>
      missing("packages/render/src/render.ts", "renderer (M3)") ??
      missing("examples/compositions/clean-launch/video.json", "clean-launch"),
    run: async () => fail("not wired yet"),
  },
  {
    name: "MCP smoke test",
    pendingReason: () => missing("packages/mcp/src/server.ts", "MCP server (M6)"),
    run: async () => fail("not wired yet"),
  },
  {
    name: "Skill lint",
    pendingReason: () => missing("packages/skill/demovie/SKILL.md", "Agent Skill (M6)"),
    run: async () => fail("not wired yet"),
  },
  {
    name: "Plugin + marketplace manifests",
    pendingReason: () => missing(".claude-plugin/marketplace.json", "plugin marketplace (M6)"),
    run: async () => fail("not wired yet"),
  },
  {
    name: "Action + scripts dry-run",
    pendingReason: () => missing("packages/action/action.yml", "GitHub Action (M7)"),
    run: async () => fail("not wired yet"),
  },
  {
    name: "Docs check",
    pendingReason: () => missing("docs/getting-started.md", "docs (M9)"),
    run: async () => fail("not wired yet"),
  },
  {
    name: "Package tarball smoke test",
    pendingReason: () => missing("packages/cli/src/commands/init.ts", "init/doctor (M1)"),
    run: async () => fail("not wired yet"),
  },
];
