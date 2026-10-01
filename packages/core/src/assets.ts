import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Files shipped inside the `demovie` package (SPEC §5.3). */
export type AssetKind = "runtime" | "fonts" | "sfx" | "skill" | "schema" | "templates";

/** Where each asset lives in the source checkout (dev, tests). */
const DEV_LOCATIONS: Record<AssetKind, string> = {
  runtime: "packages/runtime/dist/served",
  fonts: "packages/runtime/fonts",
  sfx: "packages/audio/sfx",
  skill: "packages/skill/demovie",
  schema: "packages/cli/schema",
  templates: "packages/skill/templates",
};

/** Where each asset lives inside the published package, relative to its root. */
const PACKAGE_LOCATIONS: Record<AssetKind, string> = {
  runtime: "assets/runtime",
  fonts: "assets/fonts",
  sfx: "assets/sfx",
  skill: "skill/demovie",
  schema: "schema",
  templates: "assets/templates",
};

function findUp(start: string, marker: string): string | null {
  let current = start;
  for (;;) {
    if (existsSync(path.join(current, marker))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Resolve a bundled asset folder. Order: `DEMOVIE_ASSETS_DIR`, the published package next to the running bundle,
 * then the source checkout.
 */
export function assetDir(kind: AssetKind): string {
  const override = process.env.DEMOVIE_ASSETS_DIR;
  if (override && existsSync(path.join(override, PACKAGE_LOCATIONS[kind])))
    return path.join(override, PACKAGE_LOCATIONS[kind]);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = findUp(here, "package.json");
  if (pkgRoot) {
    const bundled = path.join(pkgRoot, PACKAGE_LOCATIONS[kind]);
    if (existsSync(bundled)) return bundled;
  }
  const repo = findUp(here, "pnpm-workspace.yaml");
  if (repo) return path.join(repo, DEV_LOCATIONS[kind]);
  return path.join(pkgRoot ?? here, PACKAGE_LOCATIONS[kind]);
}
