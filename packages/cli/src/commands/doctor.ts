import { existsSync } from "node:fs";
import path from "node:path";
import {
  checkUrl,
  DemovieError,
  ensureDir,
  execCapture,
  findProjectRoot,
  loadProject,
  projectPaths,
  toDemovieError,
  which,
} from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export interface DoctorCheck {
  id: string;
  status: "ok" | "warn" | "fail";
  message: string;
  fix?: string;
  /** Prerequisite failures exit with 3 (SPEC §7). */
  kind: "prerequisite" | "config" | "app" | "info";
}

function nodeCheck(): DoctorCheck {
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  const ok = major > 20 || (major === 20 && minor >= 19);
  return {
    id: "node",
    status: ok ? "ok" : "fail",
    message: `Node.js ${process.versions.node}${ok ? "" : " (needs >= 20.19)"}`,
    ...(ok ? {} : { fix: "install Node.js 22 LTS from https://nodejs.org" }),
    kind: "prerequisite",
  };
}

const FFMPEG_FIX =
  process.platform === "darwin"
    ? "brew install ffmpeg"
    : process.platform === "win32"
      ? "winget install ffmpeg"
      : "sudo apt-get install -y ffmpeg";

async function ffmpegChecks(): Promise<DoctorCheck[]> {
  const ffmpeg = which("ffmpeg");
  const ffprobe = which("ffprobe");
  const checks: DoctorCheck[] = [];
  if (!ffmpeg) {
    checks.push({
      id: "ffmpeg",
      status: "fail",
      message: "ffmpeg not found on PATH",
      fix: FFMPEG_FIX,
      kind: "prerequisite",
    });
  } else {
    const version = (await execCapture(ffmpeg, ["-hide_banner", "-version"])).stdout.split("\n")[0] ?? "ffmpeg";
    const encoders = (await execCapture(ffmpeg, ["-hide_banner", "-encoders"])).stdout;
    const x264 = /\blibx264\b/.test(encoders);
    const fallback = /\bh264_videotoolbox\b/.test(encoders)
      ? "h264_videotoolbox"
      : /\blibopenh264\b/.test(encoders)
        ? "libopenh264"
        : null;
    checks.push({
      id: "ffmpeg",
      status: x264 ? "ok" : fallback ? "warn" : "fail",
      message: `${version.replace(/ Copyright.*$/, "")}${x264 ? " · libx264" : fallback ? ` · no libx264, will use ${fallback}` : " · no H.264 encoder"}`,
      ...(x264 ? {} : { fix: `install an ffmpeg build with libx264 (${FFMPEG_FIX})` }),
      kind: "prerequisite",
    });
    const filters = (await execCapture(ffmpeg, ["-hide_banner", "-filters"])).stdout;
    if (!/\bloudnorm\b/.test(filters)) {
      checks.push({
        id: "ffmpeg-filters",
        status: "warn",
        message: "ffmpeg lacks the loudnorm filter (audio mix)",
        fix: FFMPEG_FIX,
        kind: "prerequisite",
      });
    }
  }
  checks.push(
    ffprobe
      ? { id: "ffprobe", status: "ok", message: "ffprobe found", kind: "prerequisite" }
      : { id: "ffprobe", status: "fail", message: "ffprobe not found on PATH", fix: FFMPEG_FIX, kind: "prerequisite" },
  );
  return checks;
}

export async function run(ctx: CommandContext, options: { fix?: boolean }): Promise<CommandResult> {
  const checks: DoctorCheck[] = [nodeCheck(), ...(await ffmpegChecks())];
  const fixed: string[] = [];

  // Chromium
  const capture = await import("@demovie/capture");
  let chromium = capture.chromiumStatus();
  if (!chromium.installed && options.fix) {
    ctx.logger.step(`Installing Chromium for Playwright ${chromium.playwrightVersion}…`);
    const install = await capture.installChromium();
    if (!install.ok) ctx.logger.warn(install.output.split("\n").slice(-5).join("\n"));
    chromium = capture.chromiumStatus();
    if (chromium.installed) fixed.push("installed Chromium");
  }
  // Installed is not enough (Linux may lack system libraries): launch it once.
  const launch = chromium.installed
    ? await capture
        .launchChromium()
        .then(async (browser) => {
          await browser.close();
          return null;
        })
        .catch((error: unknown) => toDemovieError(error))
    : null;
  checks.push(
    chromium.installed && launch
      ? { id: "chromium", status: "fail", message: launch.message, fix: launch.fix, kind: "prerequisite" }
      : chromium.installed
        ? {
            id: "chromium",
            status: "ok",
            message: `Chromium for Playwright ${chromium.playwrightVersion} (launches)`,
            kind: "prerequisite",
          }
        : {
            id: "chromium",
            status: "fail",
            message: `Chromium for Playwright ${chromium.playwrightVersion} is not installed`,
            fix: "npx demovie doctor --fix",
            kind: "prerequisite",
          },
  );

  // Project
  const root = findProjectRoot(ctx.cwd);
  if (!root) {
    checks.push({
      id: "config",
      status: "warn",
      message: "no .demovie/config.json (not initialized)",
      fix: "npx demovie init",
      kind: "config",
    });
  } else {
    try {
      const project = await loadProject(root);
      const paths = projectPaths(root);
      checks.push({
        id: "config",
        status: "ok",
        message: `${path.relative(ctx.cwd, paths.config) || ".demovie/config.json"} is valid`,
        kind: "config",
      });
      if (project.missingEnv.length > 0) {
        checks.push({
          id: "env",
          status: "warn",
          message: `config references unset env vars: ${project.missingEnv.join(", ")}`,
          fix: `add them to .demovie/.env or export them`,
          kind: "config",
        });
      }
      const missingDirs = [paths.flowsDir, paths.assetsDir, paths.videosDir, paths.brandDir].filter(
        (d) => !existsSync(d),
      );
      if (missingDirs.length > 0 && options.fix) {
        for (const dir of missingDirs) await ensureDir(dir);
        fixed.push(`created ${missingDirs.map((d) => path.relative(root, d)).join(", ")}`);
      } else if (missingDirs.length > 0) {
        checks.push({
          id: "folders",
          status: "warn",
          message: `missing ${missingDirs.map((d) => path.relative(root, d)).join(", ")}`,
          fix: "npx demovie doctor --fix",
          kind: "config",
        });
      }
      const reach = await checkUrl(project.resolved.app.url, {
        headers: project.resolved.app.headers,
        timeoutMs: 4000,
      });
      const canStart = Boolean(project.resolved.app.start?.command);
      checks.push(
        reach.ok
          ? {
              id: "app",
              status: "ok",
              message: `app answers at ${project.resolved.app.url} (${reach.status})`,
              kind: "app",
            }
          : {
              id: "app",
              status: canStart ? "warn" : "fail",
              message: `app not reachable at ${project.resolved.app.url}${reach.error ? ` (${reach.error})` : ""}${canStart ? "; `demovie up` or `capture` will start it" : ""}`,
              fix: canStart ? "npx demovie up" : 'start your app, or set "app.start.command" in .demovie/config.json',
              kind: "app",
            },
      );
      const auth = project.resolved.auth;
      if (auth.strategy === "form") {
        const has = Boolean(project.env[auth.usernameEnv] && project.env[auth.passwordEnv]);
        checks.push(
          has
            ? {
                id: "auth",
                status: "ok",
                message: `form login configured (${auth.loginPath}); credentials found in env`,
                kind: "config",
              }
            : {
                id: "auth",
                status: "warn",
                message: `form login configured but ${auth.usernameEnv}/${auth.passwordEnv} are not set`,
                fix: `add ${auth.usernameEnv}=… and ${auth.passwordEnv}=… to .demovie/.env`,
                kind: "config",
              },
        );
      } else if (auth.strategy === "storageState") {
        const has = existsSync(paths.authState);
        checks.push(
          has
            ? { id: "auth", status: "ok", message: "recorded login state found", kind: "config" }
            : {
                id: "auth",
                status: "warn",
                message: "no recorded login state",
                fix: "npx demovie auth record",
                kind: "config",
              },
        );
      } else if (auth.strategy === "script") {
        const script = path.resolve(root, auth.script ?? ".demovie/auth.ts");
        checks.push(
          existsSync(script)
            ? { id: "auth", status: "ok", message: `auth script ${path.relative(root, script)}`, kind: "config" }
            : {
                id: "auth",
                status: "warn",
                message: `auth script ${path.relative(root, script)} is missing`,
                fix: "create it (see docs/capture-and-auth.md)",
                kind: "config",
              },
        );
      } else {
        checks.push({ id: "auth", status: "ok", message: "no login needed", kind: "config" });
      }
    } catch (error) {
      const e =
        error instanceof DemovieError ? error : new DemovieError("E_CONFIG", String(error), "fix .demovie/config.json");
      checks.push({ id: "config", status: "fail", message: e.message, fix: e.fix, kind: "config" });
    }
  }

  // Git
  const git = which("git");
  if (!git)
    checks.push({
      id: "git",
      status: "warn",
      message: "git not found (freshness and `changes` need it)",
      fix: "install git",
      kind: "info",
    });
  else {
    const inside = await execCapture(git, ["rev-parse", "--is-inside-work-tree"], { cwd: root ?? ctx.cwd });
    checks.push(
      inside.code === 0
        ? { id: "git", status: "ok", message: "inside a git repository", kind: "info" }
        : {
            id: "git",
            status: "warn",
            message: "not a git repository (capture freshness uses file hashes only)",
            fix: "git init",
            kind: "info",
          },
    );
  }

  const failed = checks.filter((c) => c.status === "fail");
  const exitCode = failed.some((c) => c.kind === "prerequisite")
    ? 3
    : failed.some((c) => c.kind === "config")
      ? 2
      : failed.some((c) => c.kind === "app")
        ? 4
        : 0;
  const icon = { ok: "✓", warn: "!", fail: "✗" } as const;
  const human = [
    ...checks.map(
      (c) => `${icon[c.status]} ${c.id.padEnd(8)} ${c.message}${c.status !== "ok" && c.fix ? `\n  fix: ${c.fix}` : ""}`,
    ),
    ...fixed.map((f) => `fixed: ${f}`),
    failed.length === 0 ? "doctor: all required checks passed" : `doctor: ${failed.length} check(s) failed`,
  ];
  // The GitHub Action installs the Chromium build of this Playwright version.
  const browser = {
    installed: chromium.installed,
    launches: chromium.installed && !launch,
    playwrightVersion: chromium.playwrightVersion,
  };
  return { data: { checks, fixed, chromium: browser }, human, exitCode };
}
