/**
 * The single verification entrypoint (SPEC §18).
 * Runs every check in order, prints a table, and ends with
 * `VERIFY OK (<n> checks)` or `VERIFY FAILED (<k> of <n>)`.
 *
 *   pnpm verify                 # everything
 *   pnpm verify --only 1,2,qa   # a subset while iterating (by number or name fragment)
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/repo.ts";
import { type RunResult, run } from "./lib/run.ts";
import { verifyChecks } from "./lib/verify-checks.ts";

export type CheckStatus = "pass" | "fail" | "pending";

export interface CheckOutcome {
  status: CheckStatus;
  detail: string;
}

export interface CheckContext {
  logDir: string;
  /** Run a command; output goes to the check's log file. */
  sh: (
    command: string,
    args: string[],
    options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
  ) => Promise<RunResult>;
  log: (line: string) => void;
}

export interface Check {
  name: string;
  /** Returns a reason when the feature this check covers doesn't exist yet. */
  pendingReason?: () => string | undefined;
  run: (ctx: CheckContext) => Promise<CheckOutcome>;
}

function parseArgs(argv: string[]): { only?: string[] } {
  const i = argv.indexOf("--only");
  if (i >= 0 && argv[i + 1]) return { only: argv[i + 1]!.split(",").map((s) => s.trim().toLowerCase()) };
  return {};
}

function selected(only: string[] | undefined, index: number, check: Check): boolean {
  if (!only) return true;
  return only.some((token) => token === String(index + 1) || check.name.toLowerCase().includes(token));
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

async function main(): Promise<void> {
  const { only } = parseArgs(process.argv.slice(2));
  const logDir = path.join(repoRoot, ".tmp", "verify");
  mkdirSync(logDir, { recursive: true });
  const results: { index: number; name: string; outcome: CheckOutcome; seconds: number }[] = [];
  const total = verifyChecks.length;

  for (const [index, check] of verifyChecks.entries()) {
    if (!selected(only, index, check)) continue;
    const label = `[${String(index + 1).padStart(2)}/${total}] ${check.name}`;
    const started = Date.now();
    const pending = check.pendingReason?.();
    let outcome: CheckOutcome;
    if (pending) {
      outcome = { status: "pending", detail: pending };
    } else {
      const logFile = path.join(
        logDir,
        `${String(index + 1).padStart(2, "0")}-${check.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.log`,
      );
      const lines: string[] = [];
      const ctx: CheckContext = {
        logDir,
        log: (line) => lines.push(line),
        sh: (command, args, options) =>
          run(command, args, {
            cwd: options?.cwd ?? repoRoot,
            env: options?.env,
            timeoutMs: options?.timeoutMs,
            logFile,
          }),
      };
      process.stdout.write(`${label} …\n`);
      try {
        outcome = await check.run(ctx);
      } catch (error) {
        outcome = { status: "fail", detail: error instanceof Error ? error.message : String(error) };
      }
      if (outcome.status === "fail" && existsSync(logFile)) {
        const tail = readFileSync(logFile, "utf8").trimEnd().split("\n").slice(-40).join("\n");
        process.stdout.write(`--- last lines of ${path.relative(repoRoot, logFile)} ---\n${tail}\n---\n`);
      }
    }
    const seconds = (Date.now() - started) / 1000;
    results.push({ index, name: check.name, outcome, seconds });
    process.stdout.write(`${label}: ${outcome.status.toUpperCase()} (${seconds.toFixed(1)}s) ${outcome.detail}\n`);
  }

  const nameWidth = Math.max(...results.map((r) => r.name.length), 5);
  process.stdout.write(`\n${pad("#", 3)} ${pad("check", nameWidth)} ${pad("status", 8)} ${pad("time", 8)} detail\n`);
  for (const r of results) {
    process.stdout.write(
      `${pad(String(r.index + 1), 3)} ${pad(r.name, nameWidth)} ${pad(r.outcome.status, 8)} ${pad(`${r.seconds.toFixed(1)}s`, 8)} ${r.outcome.detail}\n`,
    );
  }
  const failed = results.filter((r) => r.outcome.status === "fail").length;
  const pending = results.filter((r) => r.outcome.status === "pending").length;
  const n = results.length;
  const partial = only ? " — partial run" : "";
  if (failed > 0) {
    process.stdout.write(`VERIFY FAILED (${failed} of ${n})${partial}\n`);
    process.exit(1);
  }
  process.stdout.write(
    pending > 0
      ? `VERIFY OK (${n - pending} checks, ${pending} pending)${partial}\n`
      : `VERIFY OK (${n} checks)${partial}\n`,
  );
}

await main();
