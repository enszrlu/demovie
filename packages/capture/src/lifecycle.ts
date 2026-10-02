import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { checkUrl, DemovieError, ensureDir, isSafeAppUrl, logger, type Project, writeJson } from "@demovie/core";
import { execa } from "execa";
import treeKill from "tree-kill";

export interface AppState {
  pid: number;
  command: string;
  url: string;
  startedAt: string;
  log: string;
}

export interface AppHandle {
  url: string;
  /** True when this call started the app (so the caller should stop it afterwards). */
  started: boolean;
  reused: boolean;
  seeded: boolean;
  pid: number | null;
  stop: () => Promise<void>;
}

export function readAppState(project: Pick<Project, "paths">): AppState | null {
  if (!existsSync(project.paths.appState)) return null;
  try {
    return JSON.parse(readFileSync(project.paths.appState, "utf8")) as AppState;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lastLines(file: string, n = 40): string {
  if (!existsSync(file)) return "(no log)";
  return readFileSync(file, "utf8").trimEnd().split("\n").slice(-n).join("\n");
}

/** Run the demo seed command (SPEC §9.2: the user's seed is the only source of demo data). */
export async function runSeed(project: Project): Promise<boolean> {
  const seed = project.resolved.demo.seed;
  if (!seed) return false;
  const cwd = path.resolve(project.paths.root, project.resolved.app.start?.cwd ?? ".");
  logger.step(`Seeding demo data: ${seed}`);
  const result = await execa(seed, {
    shell: true,
    cwd,
    env: childEnv(project),
    reject: false,
    all: true,
  });
  if (result.exitCode !== 0) {
    throw new DemovieError(
      "E_APP_START",
      `seed command failed (exit ${result.exitCode}): ${seed}\n${String(result.all ?? "")
        .split("\n")
        .slice(-15)
        .join("\n")}`,
      `fix "${seed}" or set "demo.seed" to null in .demovie/config.json`,
    );
  }
  return true;
}

export interface EnsureAppOptions {
  /** Detach the process so it outlives this CLI invocation (`demovie up`). */
  detach?: boolean;
  /** Allow non-local URLs (SPEC §9.1). */
  yes?: boolean;
  seed?: boolean;
}

/** Make sure the app answers: reuse it, or seed → start → wait (SPEC §9.1). */
export async function ensureApp(project: Project, options: EnsureAppOptions = {}): Promise<AppHandle> {
  const { app } = project.resolved;
  const url = app.url;
  const readyUrl = new URL(app.start?.readyPath ?? "/", url.endsWith("/") ? url : `${url}/`).toString();
  if (!isSafeAppUrl(url) && !options.yes) {
    throw new DemovieError(
      "E_UNSAFE_URL",
      `${url} is not a local or preview URL; capturing it could create demo data in production`,
      "re-run with --yes if this really is a disposable environment",
    );
  }
  const reach = await checkUrl(readyUrl, { headers: app.headers, timeoutMs: 4000 });
  if (reach.ok && app.reuseRunning) {
    const seeded = options.seed === false ? false : await runSeed(project);
    return { url, started: false, reused: true, seeded, pid: null, stop: async () => {} };
  }
  if (!app.start) {
    throw new DemovieError(
      "E_APP_UNREACHABLE",
      `app not reachable at ${url}${reach.error ? ` (${reach.error})` : reach.status ? ` (HTTP ${reach.status})` : ""}`,
      'start your app first, or set "app.start.command" in .demovie/config.json so demovie can start it',
    );
  }
  const seeded = options.seed === false ? false : await runSeed(project);
  await ensureDir(project.paths.cacheDir);
  const log = project.paths.appLog;
  // append: an `up` app and a capture's own app may share the log; neither run erases the other's output
  appendFileSync(log, `\n--- ${new Date().toISOString()} ${app.start.command}\n`);
  const fd = openSync(log, "a");
  const cwd = path.resolve(project.paths.root, app.start.cwd);
  logger.step(`Starting the app: ${app.start.command}`);
  // Long-running process: plain spawn with a shell, in its own process group so `down` can kill the whole tree.
  const child = spawn(app.start.command, {
    shell: true,
    cwd,
    env: { ...childEnv(project), FORCE_COLOR: "0", BROWSER: "none" },
    stdio: ["ignore", fd, fd],
    detached: true,
    windowsHide: true,
  });
  closeSync(fd);
  const pid = child.pid ?? null;
  if (!pid)
    throw new DemovieError(
      "E_APP_START",
      `could not start: ${app.start.command}`,
      "check app.start.command in .demovie/config.json",
    );
  let exited: number | null = null;
  child.on("exit", (code) => {
    exited = code ?? 1;
  });
  const state: AppState = { pid, command: app.start.command, url, startedAt: new Date().toISOString(), log };
  // Only `up` leaves the app running for `down` to find; a capture's own app lives and dies with the capture.
  if (options.detach) await writeJson(project.paths.appState, state);
  // If this process dies before `stop()` runs, take the app's process tree with it (not for `up`).
  const killGroup = () => {
    try {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  };
  const onSignal = (signal: NodeJS.Signals) => {
    killGroup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  if (!options.detach) {
    process.once("exit", killGroup);
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }
  const stop = async () => {
    process.off("exit", killGroup);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await stopPid(project, pid);
  };

  const deadline = Date.now() + app.start.timeoutMs;
  for (;;) {
    const check = await checkUrl(readyUrl, { headers: app.headers, timeoutMs: 3000 });
    if (check.ok) break;
    if (exited !== null) {
      await rm(project.paths.appState, { force: true });
      throw new DemovieError(
        "E_APP_START",
        `the app exited (code ${exited}) before answering at ${readyUrl}\n--- last lines of ${log} ---\n${lastLines(log)}`,
        startHint(app.start.command),
      );
    }
    if (Date.now() > deadline) {
      await stop();
      throw new DemovieError(
        "E_APP_START",
        `the app did not answer at ${readyUrl} within ${Math.round(app.start.timeoutMs / 1000)}s\n--- last lines of ${log} ---\n${lastLines(log)}`,
        `${startHint(app.start.command)}; or raise "app.start.timeoutMs"`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (options.detach) child.unref();
  return { url, started: true, reused: false, seeded, pid, stop };
}

/**
 * Environment for the user's app and seed: the shell's environment plus `app.start.env` (whose values may be `$env:`
 * references into .demovie/.env). demovie's own secrets — the demo password, provider keys — are not passed on.
 */
/**
 * The app's environment: ours plus `app.start.env`. A test runner's `NODE_ENV=test` (vitest, jest) is dropped: `next
 * dev` keeps an inherited NODE_ENV, then misbehaves (it even rewrites tsconfig.json), so the app's tooling picks its own.
 */
export function childEnv(project: Pick<Project, "resolved">): Record<string, string> {
  const inherited = { ...process.env };
  if (inherited.NODE_ENV === "test") delete inherited.NODE_ENV;
  const env = { ...inherited, ...project.resolved.app.start?.env };
  return Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === "string"));
}

function startHint(command: string): string {
  return `run \`${command}\` yourself to see the error; check that "app.url" and the port match`;
}

/** Kill the process tree demovie started (SPEC §9.1). */
export async function stopPid(project: Pick<Project, "paths">, pid: number): Promise<boolean> {
  const wasAlive = alive(pid);
  if (wasAlive) {
    await new Promise<void>((resolve) => treeKill(pid, "SIGTERM", () => resolve()));
    for (let i = 0; i < 40 && alive(pid); i++) await new Promise((r) => setTimeout(r, 100));
    if (alive(pid)) await new Promise<void>((resolve) => treeKill(pid, "SIGKILL", () => resolve()));
  }
  await rm(project.paths.appState, { force: true });
  return wasAlive;
}

/**
 * Whether `pid` is still the process `up` started: on macOS and Linux its start time must match app.json's
 * `startedAt` (a pid can be reused by an unrelated process after the app exits). Windows has no cheap check.
 */
export function sameProcess(pid: number, startedAt: string): boolean {
  if (process.platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim()) return false;
  const started = Date.parse(r.stdout.trim());
  return Number.isNaN(started) || Math.abs(started - Date.parse(startedAt)) < 10_000;
}

/** `demovie down`: stop what `up` started — never a process that merely reuses its pid. */
export async function stopApp(
  project: Pick<Project, "paths">,
): Promise<{ stopped: boolean; pid: number | null; stale: boolean }> {
  const state = readAppState(project);
  if (!state) return { stopped: false, pid: null, stale: false };
  if (alive(state.pid) && !sameProcess(state.pid, state.startedAt)) {
    await rm(project.paths.appState, { force: true });
    return { stopped: false, pid: state.pid, stale: true };
  }
  const stopped = await stopPid(project, state.pid);
  return { stopped, pid: state.pid, stale: !stopped };
}
