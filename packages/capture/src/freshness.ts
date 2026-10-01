import { existsSync, readdirSync } from "node:fs";
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
  toPosix,
  writeJson,
} from "@demovie/core";

/** The page file plus every layout/template from its folder up to the router root (SPEC §9.9). */
export function layoutChain(appRoot: string, pageFile: string | null, routerRoot: string | null): string[] {
  if (!pageFile) return [];
  const files = [pageFile];
  const abs = path.join(appRoot, pageFile);
  if (pageFile.includes("/pages/") || pageFile.startsWith("pages/") || pageFile.startsWith("src/pages/")) {
    const pagesRoot = routerRoot ?? (pageFile.startsWith("src/") ? "src/pages" : "pages");
    for (const name of ["_app", "_document"]) {
      for (const ext of [".tsx", ".jsx", ".ts", ".js"]) {
        if (existsSync(path.join(appRoot, pagesRoot, name + ext)))
          files.push(toPosix(path.join(pagesRoot, name + ext)));
      }
    }
    return files;
  }
  const stop = routerRoot ? path.join(appRoot, routerRoot) : path.dirname(abs);
  let dir = path.dirname(abs);
  for (;;) {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      break;
    }
    for (const e of entries)
      if (/^(layout|template)\.(tsx|ts|jsx|js)$/.test(e))
        files.push(toPosix(path.relative(appRoot, path.join(dir, e))));
    if (dir === stop || dir === appRoot || !dir.startsWith(stop)) break;
    dir = path.dirname(dir);
  }
  return [...new Set(files)];
}

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
