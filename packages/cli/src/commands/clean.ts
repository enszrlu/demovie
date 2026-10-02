import { existsSync, readdirSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { loadProject, toPosix } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export interface CleanOptions {
  /** Also remove logs and the other caches (never the paid voiceover cache). */
  all?: boolean;
  dryRun?: boolean;
}

/** Bytes under a file or folder (0 when missing). */
export function sizeOf(target: string): number {
  if (!existsSync(target)) return 0;
  const stat = statSync(target);
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const entry of readdirSync(target)) total += sizeOf(path.join(target, entry));
  return total;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * `demovie clean`: free disk space under `.demovie/.cache`. Rendered frames are kept so a re-render only redraws what
 * changed, which adds up to gigabytes; they regenerate on the next render. `--all` also removes logs and the app's
 * run state. The voiceover cache is never touched (it cost money), nor are captures, videos or outputs.
 */
export async function run(ctx: CommandContext, options: CleanOptions = {}): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const cache = project.paths.cacheDir;
  const keep = new Set(["voice"]);
  const targets = options.all
    ? existsSync(cache)
      ? readdirSync(cache)
          .filter((entry) => !keep.has(entry))
          .map((entry) => path.join(cache, entry))
      : []
    : [path.join(cache, "frames")];
  const removed = targets
    .filter((target) => existsSync(target))
    .map((target) => ({ path: toPosix(path.relative(ctx.cwd, target)), bytes: sizeOf(target) }));
  const freed = removed.reduce((sum, r) => sum + r.bytes, 0);
  if (!options.dryRun) for (const target of targets) await rm(target, { recursive: true, force: true });
  const verb = options.dryRun ? "would free" : "freed";
  return {
    data: { dryRun: Boolean(options.dryRun), freedBytes: freed, removed },
    human: removed.length
      ? [
          `${verb} ${formatBytes(freed)}: ${removed.map((r) => `${r.path} (${formatBytes(r.bytes)})`).join(", ")}`,
          ...(options.all ? [] : ["kept: captures, videos, outputs and the voiceover cache (use --all for logs too)"]),
        ]
      : ["nothing to clean"],
  };
}
