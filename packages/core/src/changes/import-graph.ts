import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { toPosix } from "../util/fs.ts";
import { moduleImports, parseModule } from "../util/static-js.ts";
import { createResolver } from "./resolve.ts";

const SOURCE = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".demovie",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
]);

export interface ImportGraph {
  /** App-relative POSIX paths of every parsed source file. */
  files: string[];
  /** file → files that import it (reverse edges). */
  importers: Map<string, Set<string>>;
}

function sourceFiles(appRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(path.join(dir, e.name));
      } else if (SOURCE.test(e.name) && !e.name.endsWith(".d.ts")) out.push(path.join(dir, e.name));
    }
  };
  walk(appRoot);
  return out.sort();
}

/**
 * Parse every source file of the app (statically: esbuild + acorn, nothing is executed) and record who imports whom,
 * resolving relative imports and tsconfig `paths` aliases (SPEC §15.1). CSS imports are edges too.
 */
export function buildImportGraph(appRoot: string): ImportGraph {
  const resolve = createResolver(appRoot);
  const rel = (abs: string) => toPosix(path.relative(appRoot, abs));
  const importers = new Map<string, Set<string>>();
  const files = sourceFiles(appRoot);
  for (const file of files) {
    let code: string;
    try {
      code = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const ast = parseModule(code, file);
    if (!ast) continue;
    const from = rel(file);
    for (const imp of moduleImports(ast)) {
      const target = resolve(file, imp.source);
      if (!target?.startsWith(appRoot)) continue;
      const to = rel(target);
      if (!importers.has(to)) importers.set(to, new Set());
      importers.get(to)!.add(from);
    }
  }
  return { files: files.map(rel), importers };
}

/**
 * Walk the reverse import graph from each changed file (up to `maxDepth` hops) and report every target file reached,
 * with the shortest chain `[changed, …, target]`.
 */
export function reachTargets(
  graph: ImportGraph,
  changed: string[],
  targets: Set<string>,
  maxDepth = 6,
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const start of changed) {
    const seen = new Set([start]);
    let frontier: string[][] = [[start]];
    for (let depth = 0; depth <= maxDepth && frontier.length; depth++) {
      const next: string[][] = [];
      for (const chain of frontier) {
        const file = chain[chain.length - 1]!;
        if (targets.has(file)) {
          const best = found.get(file);
          if (!best || chain.length < best.length) found.set(file, chain);
        }
        for (const importer of graph.importers.get(file) ?? []) {
          if (seen.has(importer)) continue;
          seen.add(importer);
          next.push([...chain, importer]);
        }
      }
      frontier = next;
    }
  }
  return found;
}
