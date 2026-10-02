/** Helpers for integration tests that need the Harborly fixture running (SPEC §18). */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../lib/repo.ts";

export const HARBORLY_DIR = path.join(repoRoot, "examples", "harborly");
export const HARBORLY_URL = "http://localhost:3000";
export const HARBORLY_ROUTES = ["/", "/pricing", "/changelog", "/customers", "/login"];
export const HARBORLY_APP_ROUTES = [
  "/app",
  "/app/projects",
  "/app/projects/prj_launch",
  "/app/projects/new",
  "/app/team",
  "/app/reports",
  "/app/settings",
];
export const FIXTURE_ENV = { DEMOVIE_USER: "demo@harborly.demo", DEMOVIE_PASSWORD: "harborly-demo" };

async function answers(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(3000) });
    await res.body?.cancel();
    return res.status < 500;
  } catch {
    return false;
  }
}

function run(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "ignore" });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** Seed Harborly and make sure its dev server answers on :3000. Returns a stop function (no-op when reused). */
export async function ensureHarborly(): Promise<{ url: string; started: boolean; stop: () => Promise<void> }> {
  await run("pnpm", ["demo:seed"], HARBORLY_DIR);
  if (await answers(`${HARBORLY_URL}/login`)) return { url: HARBORLY_URL, started: false, stop: async () => {} };
  mkdirSync(path.join(repoRoot, ".tmp"), { recursive: true });
  const log = openSync(path.join(repoRoot, ".tmp", "harborly-test.log"), "w");
  // Without vitest's NODE_ENV=test: `next dev` would keep it and rewrite tsconfig.json with wrong type paths.
  const { NODE_ENV: _testEnv, ...env } = process.env;
  const child = spawn("pnpm", ["dev"], {
    cwd: HARBORLY_DIR,
    stdio: ["ignore", log, log],
    detached: true,
    env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  const deadline = Date.now() + 120_000;
  while (!(await answers(`${HARBORLY_URL}/login`))) {
    if (Date.now() > deadline) throw new Error("Harborly dev server did not start (see .tmp/harborly-test.log)");
    await new Promise((r) => setTimeout(r, 500));
  }
  // Warm up Turbopack so the first test doesn't pay for compiling every route.
  await Promise.all([...HARBORLY_ROUTES, ...HARBORLY_APP_ROUTES].map((p) => answers(`${HARBORLY_URL}${p}`)));
  return {
    url: HARBORLY_URL,
    started: true,
    stop: async () => {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        /* already gone */
      }
    },
  };
}

/** A fresh copy of the Harborly sources (no node_modules/.next/.data/.demovie runtime state) under .tmp/. */
export function harborlyCopy(name: string, options: { keepDemovie?: boolean } = {}): string {
  const dest = path.join(repoRoot, ".tmp", `it-${name}`);
  rmSync(dest, { recursive: true, force: true });
  cpSync(HARBORLY_DIR, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(HARBORLY_DIR, src);
      if (/^(node_modules|\.next|\.data)(\/|$)/.test(rel)) return false;
      if (!options.keepDemovie && /^\.demovie(\/|$)/.test(rel)) return false;
      if (/^\.demovie\/(captures|\.cache|\.auth|videos\/[^/]+\/out)(\/|$)/.test(rel)) return false;
      return true;
    },
  });
  return dest;
}

/**
 * A Harborly copy with the committed `.demovie/` whose seed resets the *running* app's data (the dev server serves
 * examples/harborly, so seeding the copy's own .data/ would not reset what flows change).
 */
export function harborlyProject(name: string): string {
  const dir = harborlyCopy(name, { keepDemovie: true });
  const configFile = path.join(dir, ".demovie", "config.json");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  config.demo.seed = `pnpm --dir ${JSON.stringify(HARBORLY_DIR)} demo:seed`;
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

/** Make sure the given Harborly capture states exist (captures are gitignored; regenerate them when missing). */
export async function ensureHarborlyCaptures(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => !existsSync(path.join(HARBORLY_DIR, ".demovie", "captures", id, "screen.png")));
  if (missing.length === 0) return;
  const { loadProject } = await import("../../packages/core/src/index.ts");
  const { runCapture } = await import("../../packages/capture/src/index.ts");
  const saved = { ...process.env };
  Object.assign(process.env, FIXTURE_ENV);
  try {
    await runCapture(await loadProject(HARBORLY_DIR), {});
  } finally {
    process.env = saved;
  }
}
