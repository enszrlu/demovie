import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseJsonc } from "../util/jsonc.ts";

export interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

/** `compilerOptions.baseUrl` + `paths` from tsconfig.json/jsconfig.json (comments and trailing commas allowed). */
export function readTsconfigPaths(appRoot: string): TsconfigPaths {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const file = path.join(appRoot, name);
    if (!existsSync(file)) continue;
    try {
      const json = parseJsonc(readFileSync(file, "utf8")) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };
      return {
        baseUrl: path.join(appRoot, json.compilerOptions?.baseUrl ?? "."),
        paths: json.compilerOptions?.paths ?? {},
      };
    } catch {
      // unreadable tsconfig: fall back to relative imports only
    }
  }
  return { baseUrl: appRoot, paths: {} };
}

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".css"];
const INDEX = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

/** A resolver for local specifiers (relative, tsconfig `paths`, `/`-rooted); bare package imports resolve to null. */
export function createResolver(appRoot: string): (fromFile: string, spec: string) => string | null {
  const { baseUrl, paths } = readTsconfigPaths(appRoot);
  const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
  return (fromFile, spec) => {
    const candidates: string[] = [];
    if (spec.startsWith(".")) candidates.push(path.resolve(path.dirname(fromFile), spec));
    else {
      for (const [pattern, targets] of Object.entries(paths)) {
        const prefix = pattern.replace(/\*$/, "");
        if (pattern.endsWith("*") ? spec.startsWith(prefix) : spec === pattern)
          for (const target of targets)
            candidates.push(path.resolve(baseUrl, target.replace(/\*$/, spec.slice(prefix.length))));
      }
      if (spec.startsWith("/")) candidates.push(path.join(appRoot, spec));
    }
    for (const c of candidates) {
      if (isFile(c)) return c;
      // TS sources imported with a .js extension
      const swapped = c.replace(/\.(m|c)?js$/, ".$1ts");
      if (swapped !== c && isFile(swapped)) return swapped;
      for (const ext of EXTENSIONS) if (isFile(c + ext)) return c + ext;
      for (const ext of INDEX) if (isFile(c + ext)) return c + ext;
    }
    return null;
  };
}
