import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { toPosix } from "../util/fs.ts";

/** The page file plus every layout/template from its folder up to the router root (SPEC §9.9, §15.1). */
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
