/** verify check 12 (SPEC §18): action.yml is valid, and the action scripts dry-run against Harborly. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ActionMetadataSchema, parseYaml } from "../../packages/core/src/index.ts";
import { repoRoot } from "./repo.ts";

const ACTION_DIR = path.join(repoRoot, "packages/action");

export function validateAction(): { ok: boolean; detail: string; inputs: number; steps: number } {
  const text = readFileSync(path.join(ACTION_DIR, "action.yml"), "utf8");
  const parsed = ActionMetadataSchema.safeParse(parseYaml(text));
  if (!parsed.success)
    return {
      ok: false,
      detail: `action.yml: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      inputs: 0,
      steps: 0,
    };
  const problems: string[] = [];
  const inputs = Object.keys(parsed.data.inputs);
  for (const m of text.matchAll(/inputs\.([a-z-]+)/g))
    if (!inputs.includes(m[1]!)) problems.push(`undeclared input ${m[1]}`);
  for (const step of parsed.data.runs.steps)
    if (step.uses && !/^[\w-]+\/[\w-]+@v\d+$/.test(step.uses)) problems.push(`unpinned action ${step.uses}`);
  for (const m of text.matchAll(/github\.action_path \}\}\/([\w./-]+)/g))
    if (!existsSync(path.join(ACTION_DIR, m[1]!))) problems.push(`missing script ${m[1]}`);
  return {
    ok: problems.length === 0,
    detail: problems.join("; "),
    inputs: inputs.length,
    steps: parsed.data.runs.steps.length,
  };
}

export function dryRunAction(cli: string): { ok: boolean; detail: string } {
  const harborly = path.join(repoRoot, "examples/harborly");
  const script = path.join(ACTION_DIR, "scripts/demovie-action.mjs");
  const env = {
    ...process.env,
    GITHUB_ACTIONS: "",
    GITHUB_OUTPUT: "",
    GITHUB_STEP_SUMMARY: "",
    DEMOVIE_BIN: `node ${path.join(repoRoot, cli)}`,
    DEMOVIE_ACTION_SINCE: "HEAD~1",
  };
  const run = spawnSync(process.execPath, [script, "run", "--dry-run"], { cwd: harborly, env, encoding: "utf8" });
  if (run.status !== 0) return { ok: false, detail: `run --dry-run exited ${run.status}: ${run.stderr.trim()}` };
  const planned = run.stdout
    .split("\n")
    .filter((l) => l.startsWith("[dry-run] "))
    .map((l) => l.replace(/^\[dry-run\] node \S+ /, ""));
  const expected = [
    "doctor",
    "capture --changed --since",
    "--json changes --since",
    "make --agent claude --type changelog",
  ];
  const missing = expected.filter((e) => !planned.some((p) => p.startsWith(e)));
  if (missing.length) return { ok: false, detail: `dry-run plan lacks: ${missing.join(", ")}` };
  const report = spawnSync(process.execPath, [script, "report"], { cwd: harborly, env, encoding: "utf8" });
  if (report.status !== 0) return { ok: false, detail: `report exited ${report.status}: ${report.stderr.trim()}` };
  return {
    ok: true,
    detail: `dry-run: ${planned.map((p) => p.split(" ").find((w) => !w.startsWith("-"))).join(" → ")}; report → .demovie/.cache/action-comment.md (no GitHub calls outside Actions)`,
  };
}
