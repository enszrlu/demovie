import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DemovieError,
  logger,
  type Project,
  ProvenanceSchema,
  VideoSchema,
  writeFileAtomic,
  writeJson,
} from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { ask } from "./prompts.ts";

/** Apply `mutate` to the raw video.json and write it back only when something changed (keeps formatting stable). */
export async function updateVideoJson(file: string, mutate: (raw: Record<string, any>) => void): Promise<boolean> {
  const raw = JSON.parse(await readFile(file, "utf8")) as Record<string, any>;
  const before = JSON.stringify(raw);
  mutate(raw);
  if (JSON.stringify(raw) === before) return false;
  VideoSchema.parse(raw);
  await writeJson(file, raw);
  return true;
}

/** Write only when the bytes differ, so regenerating identical audio doesn't touch the file. */
export async function writeIfChanged(file: string, data: Uint8Array | string): Promise<boolean> {
  const next = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  if (existsSync(file) && readFileSync(file).equals(next)) return false;
  await writeFileAtomic(file, next);
  return true;
}

export async function writeJsonIfChanged(file: string, data: unknown): Promise<boolean> {
  return writeIfChanged(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** `audio/...` paths are relative to the video folder; `assets/...` point into `.demovie/assets`. */
export function resolveAudioSrc(project: Project, videoDir: string, src: string): string {
  const clean = src.replace(/^\/+/, "");
  if (clean.startsWith("assets/")) return path.join(project.paths.assetsDir, clean.slice("assets/".length));
  return path.join(videoDir, clean);
}

/** True when `.demovie/assets/provenance.json` lists the file as imported with `add --licensed`. */
export function isLicensedAsset(project: Project, file: string): boolean {
  const prov = path.join(project.paths.assetsDir, "provenance.json");
  if (!existsSync(prov)) return false;
  const entries = ProvenanceSchema.parse(JSON.parse(readFileSync(prov, "utf8"))).files;
  return entries.some((e) => e.file === path.basename(file) && e.generator === "user-licensed");
}

export function requireKey(project: Project, name: "ELEVENLABS_API_KEY" | "OPENAI_API_KEY", label: string): string {
  const key = project.env[name];
  if (!key) {
    throw new DemovieError(
      "E_CONFIG",
      `${name} is not set (needed for ${label}; your own key, billed to your account)`,
      `export ${name}=… or add it to .demovie/.env (gitignored; demovie never logs it)`,
    );
  }
  logger.addSecret(key);
  return key;
}

/** Print the estimate, then require `--yes` or an interactive confirmation (SPEC §13.3). */
export async function confirmCost(ctx: CommandContext, summary: string): Promise<void> {
  ctx.logger.info(summary);
  if (ctx.confirmed) return;
  if (ctx.interactive) {
    if (await ask.confirm("Proceed with this paid request?", false)) return;
    throw new DemovieError(
      "E_USAGE",
      "cancelled: the paid request was not confirmed",
      "re-run and confirm, or pass --yes",
    );
  }
  throw new DemovieError(
    "E_USAGE",
    `${summary} — confirmation required`,
    "re-run with --yes to accept the estimated cost",
  );
}
