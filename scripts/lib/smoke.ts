/** Package tarball smoke test (SPEC §18): pack, install into .tmp/, run the CLI via npx (and bunx when available). */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CheckContext, CheckOutcome } from "../verify.ts";
import { repoRoot } from "./repo.ts";

function dirSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    total += st.isDirectory() ? dirSize(full) : st.size;
  }
  return total;
}

function harborlyCopy(dest: string): void {
  const src = path.join(repoRoot, "examples", "harborly");
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !/(^|\/)(node_modules|\.next|\.data|\.demovie)(\/|$)/.test(path.relative(src, p)),
  });
}

export async function tarballSmoke(ctx: CheckContext): Promise<CheckOutcome> {
  const base = path.join(repoRoot, ".tmp", "smoke");
  rmSync(base, { recursive: true, force: true });
  mkdirSync(path.join(base, "pack"), { recursive: true });
  const pack = await ctx.sh("pnpm", ["pack", "--pack-destination", path.join(base, "pack")], {
    cwd: path.join(repoRoot, "packages", "cli"),
  });
  const tgz = readdirSync(path.join(base, "pack")).find((f) => f.endsWith(".tgz"));
  if (pack.code !== 0 || !tgz) return { status: "fail", detail: "pnpm pack failed" };
  const tarball = path.join(base, "pack", tgz);

  // Unpacked size of the package itself (dependencies and Chromium excluded).
  const unpacked = path.join(base, "unpacked");
  mkdirSync(unpacked, { recursive: true });
  await ctx.sh("tar", ["-xzf", tarball, "-C", unpacked]);
  const sizeMb = dirSize(unpacked) / 1024 / 1024;

  const app = path.join(base, "npx");
  mkdirSync(app, { recursive: true });
  writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "demovie-smoke", private: true }, null, 2));
  const install = await ctx.sh("npm", ["install", tarball, "--no-audit", "--no-fund", "--loglevel=error"], {
    cwd: app,
    timeoutMs: 10 * 60_000,
  });
  if (install.code !== 0) return { status: "fail", detail: "npm install of the tarball failed" };
  const version = await ctx.sh("npx", ["--no-install", "demovie", "--version"], { cwd: app });
  if (version.code !== 0) return { status: "fail", detail: "npx demovie --version failed" };
  const doctor = await ctx.sh("npx", ["--no-install", "demovie", "doctor", "--json"], { cwd: app });
  let doctorOk = false;
  try {
    const parsed = JSON.parse(doctor.stdout) as { checks: { id: string; status: string }[] };
    doctorOk = ["node", "ffmpeg", "ffprobe", "chromium"].every(
      (id) => parsed.checks.find((c) => c.id === id)?.status !== "fail",
    );
  } catch {
    doctorOk = false;
  }
  if (!doctorOk)
    return { status: "fail", detail: `doctor --json reported failing prerequisites (exit ${doctor.code})` };
  harborlyCopy(path.join(app, "harborly"));
  const init = await ctx.sh("npx", ["--no-install", "demovie", "--cwd", "harborly", "init", "--yes", "--json"], {
    cwd: app,
    env: { DEMOVIE_USER: "demo@harborly.demo", DEMOVIE_PASSWORD: "harborly-demo" },
    timeoutMs: 5 * 60_000,
  });
  const initOk =
    init.code === 0 &&
    existsSync(path.join(app, "harborly", ".demovie", "config.json")) &&
    existsSync(path.join(app, "harborly", ".demovie", "routes.json"));
  if (!initOk) return { status: "fail", detail: `init --yes failed (exit ${init.code})` };

  let bun = "bunx: bun not installed (skipped)";
  const bunVersion = await ctx.sh("bun", ["--version"], { cwd: base });
  if (bunVersion.code === 0) {
    const bunApp = path.join(base, "bunx");
    mkdirSync(bunApp, { recursive: true });
    writeFileSync(
      path.join(bunApp, "package.json"),
      JSON.stringify({ name: "demovie-smoke-bun", private: true }, null, 2),
    );
    const add = await ctx.sh("bun", ["add", tarball], { cwd: bunApp, timeoutMs: 10 * 60_000 });
    const bv = add.code === 0 ? await ctx.sh("bunx", ["demovie", "--version"], { cwd: bunApp }) : add;
    const bd = add.code === 0 ? await ctx.sh("bunx", ["demovie", "doctor", "--json"], { cwd: bunApp }) : add;
    if (bv.code !== 0 || !bd.stdout.includes('"checks"')) return { status: "fail", detail: "bunx demovie failed" };
    bun = `bunx demovie --version → ${bv.stdout.trim()} (bun ${bunVersion.stdout.trim()})`;
  }
  return {
    status: sizeMb < 15 ? "pass" : "fail",
    detail: `${tgz}: unpacked ${sizeMb.toFixed(1)} MB (< 15 MB); npx demovie --version → ${version.stdout.trim()}; doctor ok; init --yes ok; ${bun}`,
  };
}
