import { existsSync } from "node:fs";
import path from "node:path";
import {
  type CaptureIndex,
  type CaptureIndexEntry,
  CaptureIndexSchema,
  configHash,
  execCapture,
  type Project,
  readJson,
  sha256File,
  writeJson,
} from "@demovie/core";

export { layoutChain } from "@demovie/core";

export async function hashFiles(appRoot: string, files: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const f of files) out[f] = (await sha256File(path.join(appRoot, f))) ?? "missing";
  return out;
}

export async function gitHead(cwd: string): Promise<string | null> {
  const r = await execCapture("git", ["rev-parse", "HEAD"], { cwd, timeoutMs: 10_000 });
  return r.code === 0 ? r.stdout.trim() : null;
}

export async function readCaptureIndex(project: Pick<Project, "paths">): Promise<CaptureIndex | null> {
  if (!existsSync(project.paths.captureIndex)) return null;
  return readJson(
    project.paths.captureIndex,
    CaptureIndexSchema,
    "delete .demovie/captures and re-run `npx demovie capture`",
  );
}

/** Upsert states into captures/index.json. */
export async function updateCaptureIndex(project: Project, entries: CaptureIndexEntry[]): Promise<CaptureIndex> {
  const existing = await readCaptureIndex(project);
  const byId = new Map((existing?.states ?? []).map((s) => [s.id, s]));
  for (const e of entries) byId.set(e.id, e);
  const index: CaptureIndex = {
    version: 1,
    updatedAt: new Date().toISOString(),
    gitSha: await gitHead(project.paths.root),
    configHash: configHash(project.config),
    states: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  await writeJson(project.paths.captureIndex, index);
  return index;
}

export interface Freshness {
  total: number;
  updatedAt: string | null;
  gitSha: string | null;
  stale: { id: string; reasons: string[] }[];
}

/** Stale = the config hash changed, or a hashed source file (page + layout chain, flow file) changed. */
export async function captureFreshness(project: Project): Promise<Freshness> {
  const index = await readCaptureIndex(project);
  if (!index) return { total: 0, updatedAt: null, gitSha: null, stale: [] };
  const currentConfig = configHash(project.config);
  const stale: Freshness["stale"] = [];
  const cache = new Map<string, string>();
  for (const state of index.states) {
    const reasons: string[] = [];
    if (state.configHash !== currentConfig) reasons.push("config changed");
    for (const [file, hash] of Object.entries(state.sourceHashes)) {
      if (!cache.has(file)) cache.set(file, (await sha256File(path.join(project.paths.root, file))) ?? "missing");
      if (cache.get(file) !== hash) reasons.push(`${file} changed`);
    }
    if (!existsSync(path.join(project.paths.capturesDir, state.id, "screen.png"))) reasons.push("screen.png missing");
    if (reasons.length) stale.push({ id: state.id, reasons });
  }
  return { total: index.states.length, updatedAt: index.updatedAt, gitSha: index.gitSha, stale };
}
