import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { DemovieError, execCapture, logger } from "@demovie/core";
import { type Browser, chromium, type LaunchOptions } from "playwright-core";

const require = createRequire(import.meta.url);

export interface ChromiumStatus {
  installed: boolean;
  executablePath: string | null;
  playwrightVersion: string;
}

function playwrightVersion(): string {
  try {
    return (require("playwright-core/package.json") as { version: string }).version;
  } catch {
    return "unknown";
  }
}

/** Whether Playwright's Chromium build (the one this playwright-core version expects) is installed. */
export function chromiumStatus(): ChromiumStatus {
  let executablePath: string | null = null;
  try {
    executablePath = chromium.executablePath();
  } catch {
    executablePath = null;
  }
  return {
    installed: Boolean(executablePath && existsSync(executablePath)),
    executablePath,
    playwrightVersion: playwrightVersion(),
  };
}

/** Install Chromium (and the headless shell) through playwright-core's own installer. */
export async function installChromium(): Promise<{ ok: boolean; output: string }> {
  const cli = path.join(path.dirname(require.resolve("playwright-core/package.json")), "cli.js");
  const result = await execCapture(process.execPath, [cli, "install", "chromium", "chromium-headless-shell"], {
    timeoutMs: 15 * 60_000,
  });
  return { ok: result.code === 0, output: `${result.stdout}\n${result.stderr}`.trim() };
}

/** Turns a Playwright launch error into an actionable one: not installed, missing Linux libraries, or other. */
export function launchFailure(error: unknown): DemovieError {
  const message = (error as Error)?.message ?? String(error);
  // Linux without Chromium's system libraries (WSL, containers): Playwright installs them with install-deps.
  if (/missing dependencies|missing system dependencies|error while loading shared libraries/i.test(message))
    return new DemovieError(
      "E_PREREQ_CHROMIUM",
      "Chromium is installed but this system is missing libraries it needs",
      `run \`sudo npx -y playwright-core@${playwrightVersion()} install-deps chromium\`, then retry`,
      { cause: error },
    );
  if (/Executable doesn't exist|browserType\.launch: .*(not found|install)/i.test(message))
    return new DemovieError(
      "E_PREREQ_CHROMIUM",
      `Chromium for Playwright ${playwrightVersion()} is not installed`,
      "run `npx demovie doctor --fix` (installs Chromium via Playwright)",
      { cause: error },
    );
  const first = message.split("\n").find((l) => l.trim() && !/^browserType\.launch:\s*$/.test(l.trim())) ?? message;
  return new DemovieError(
    "E_PREREQ_CHROMIUM",
    `could not launch Chromium: ${first.trim()}`,
    "run `npx demovie doctor` to diagnose",
    {
      cause: error,
    },
  );
}

/** Launch headless Chromium, turning launch failures into actionable errors. */
export async function launchChromium(options: LaunchOptions = {}): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true, ...options });
  } catch (error) {
    logger.debug((error as Error)?.message ?? String(error));
    throw launchFailure(error);
  }
}
