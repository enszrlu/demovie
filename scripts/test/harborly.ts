/** Helpers for integration tests that need the Harborly fixture running (SPEC §18). */
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, openSync, rmSync } from "node:fs";
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
  const child = spawn("pnpm", ["dev"], {
    cwd: HARBORLY_DIR,
    stdio: ["ignore", log, log],
    detached: true,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
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
