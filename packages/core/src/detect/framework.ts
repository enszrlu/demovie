import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { DemovieError } from "../errors.ts";
import { globToRegExp } from "../util/glob.ts";
import { titleCase } from "../util/slug.ts";
import { type AnyNode, defaultExportValue, parseModule, topLevelConsts, UNKNOWN, walk } from "../util/static-js.ts";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  homepage?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

export interface NextjsDetection {
  version: string | null;
  router: "app" | "pages" | "both";
  appDir: string | null;
  pagesDir: string | null;
  basePath: string | null;
  i18n: { locales: string[]; defaultLocale: string | null } | null;
  output: string | null;
  configFile: string | null;
}

export interface Detection {
  framework: "nextjs" | "generic";
  /** Absolute app root (where `.demovie/` goes). */
  appRoot: string;
  workspaceRoot: string | null;
  packageManager: PackageManager | null;
  packageJson: PackageJson | null;
  name: string;
  nextjs: NextjsDetection | null;
  startCommand: string | null;
  buildStartCommand: string | null;
  port: number;
  url: string;
  tailwind: 3 | 4 | null;
  shadcn: boolean;
  seedCommand: string | null;
  /** Other Next.js apps found in the workspace (monorepos). */
  candidates: string[];
}

export function readPackageJson(dir: string): PackageJson | null {
  const file = path.join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

function allDeps(pkg: PackageJson | null): Record<string, string> {
  return { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
}

/** Lockfile-based package manager, searching up to the workspace root. */
export function detectPackageManager(dir: string): PackageManager | null {
  let current = path.resolve(dir);
  for (;;) {
    if (existsSync(path.join(current, "pnpm-lock.yaml")) || existsSync(path.join(current, "pnpm-workspace.yaml")))
      return "pnpm";
    if (existsSync(path.join(current, "bun.lock")) || existsSync(path.join(current, "bun.lockb"))) return "bun";
    if (existsSync(path.join(current, "yarn.lock"))) return "yarn";
    if (existsSync(path.join(current, "package-lock.json"))) return "npm";
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Workspace package globs from pnpm-workspace.yaml or package.json workspaces. */
export function workspaceGlobs(dir: string): string[] | null {
  const pnpmFile = path.join(dir, "pnpm-workspace.yaml");
  if (existsSync(pnpmFile)) {
    try {
      const data = parseYaml(readFileSync(pnpmFile, "utf8")) as { packages?: string[] } | null;
      return (data?.packages ?? []).filter((p) => !p.startsWith("!"));
    } catch {
      return [];
    }
  }
  const pkg = readPackageJson(dir);
  if (pkg?.workspaces) return Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces.packages ?? []);
  return null;
}

/** Expand simple workspace globs ("apps/*", "packages/**") into package folders. */
export function expandWorkspaceGlobs(root: string, globs: string[]): string[] {
  const out = new Set<string>();
  for (const glob of globs) {
    const clean = glob.replace(/\/$/, "");
    if (!clean.includes("*")) {
      if (existsSync(path.join(root, clean, "package.json"))) out.add(path.join(root, clean));
      continue;
    }
    const re = globToRegExp(clean);
    const base = clean.slice(0, clean.indexOf("*")).replace(/\/[^/]*$/, "");
    const maxDepth = clean.includes("**") ? 4 : clean.split("/").length - base.split("/").filter(Boolean).length;
    const visit = (dir: string, depth: number) => {
      if (depth > maxDepth) return;
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = path.join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        const rel = path.relative(root, full).split(path.sep).join("/");
        if (re.test(rel) && existsSync(path.join(full, "package.json"))) out.add(full);
        visit(full, depth + 1);
      }
    };
    visit(path.join(root, base), 1);
  }
  return [...out].sort();
}

function hasRouteFiles(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((f) => /^(page|layout)\.(tsx|ts|jsx|js|mdx)$/.test(f));
  } catch {
    return false;
  }
}

function findWorkspaceRoot(dir: string): string | null {
  let current = path.resolve(dir);
  for (;;) {
    if (workspaceGlobs(current) !== null) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function installedNextVersion(appRoot: string, range: string | undefined): string | null {
  for (const dir of [appRoot, findWorkspaceRoot(appRoot)].filter(Boolean) as string[]) {
    const pkg = readPackageJson(path.join(dir, "node_modules", "next"));
    if (pkg?.version) return pkg.version;
  }
  return range ? range.replace(/^[~^>=<\s]+/, "") : null;
}

/** Read `next.config.*` statically for basePath, i18n and output. Never executes it. */
export function readNextConfig(appRoot: string): Pick<NextjsDetection, "basePath" | "i18n" | "output" | "configFile"> {
  const file = ["next.config.ts", "next.config.mjs", "next.config.js", "next.config.cjs", "next.config.mts"]
    .map((f) => path.join(appRoot, f))
    .find((f) => existsSync(f));
  const empty = { basePath: null, i18n: null, output: null, configFile: file ?? null };
  if (!file) return empty;
  const ast = parseModule(readFileSync(file, "utf8"), file);
  if (!ast) return empty;
  let value = defaultExportValue(ast) as Record<string, unknown> | typeof UNKNOWN;
  if (value === UNKNOWN || typeof value !== "object" || value === null) {
    // `const nextConfig: NextConfig = {...}; export default withPlugin(nextConfig)`: take the largest object literal.
    const consts = topLevelConsts(ast);
    let best: AnyNode | null = null;
    for (const node of consts.values())
      if (node.type === "ObjectExpression" && (!best || node.properties.length > best.properties.length)) best = node;
    value = (best ? (literalObject(best) as Record<string, unknown>) : {}) ?? {};
  }
  const cfg = value as Record<string, unknown>;
  const i18n = cfg.i18n as { locales?: unknown; defaultLocale?: unknown } | undefined;
  return {
    basePath: typeof cfg.basePath === "string" ? cfg.basePath : null,
    i18n:
      i18n && typeof i18n === "object" && Array.isArray(i18n.locales)
        ? {
            locales: i18n.locales.filter((l): l is string => typeof l === "string"),
            defaultLocale: typeof i18n.defaultLocale === "string" ? i18n.defaultLocale : null,
          }
        : null,
    output: typeof cfg.output === "string" ? cfg.output : null,
    configFile: file,
  };
}

function literalObject(node: AnyNode): unknown {
  const out: Record<string, unknown> = {};
  for (const prop of node.properties as AnyNode[]) {
    if (prop.type !== "Property" || prop.computed) continue;
    const key = prop.key.type === "Identifier" ? prop.key.name : String(prop.key.value);
    const v = prop.value;
    if (v.type === "Literal") out[key] = v.value;
    else if (v.type === "ObjectExpression") out[key] = literalObject(v);
    else if (v.type === "ArrayExpression")
      out[key] = v.elements.map((e: AnyNode) => (e?.type === "Literal" ? e.value : null));
  }
  return out;
}

export function runScriptCommand(pm: PackageManager | null, script: string): string {
  switch (pm) {
    case "pnpm":
      return `pnpm ${script}`;
    case "yarn":
      return `yarn ${script}`;
    case "bun":
      return `bun run ${script}`;
    default:
      return `npm run ${script}`;
  }
}

/** Port from `-p`/`--port` in a script, else PORT, else 3000. */
export function portFromScript(
  script: string | undefined,
  env: Record<string, string | undefined> = process.env,
): number {
  const m = script?.match(/(?:-p|--port)[=\s]+(\d{2,5})/);
  if (m) return Number(m[1]);
  const fromEnv = Number(env.PORT);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : 3000;
}

function detectTailwind(appRoot: string, pkg: PackageJson | null): 3 | 4 | null {
  const deps = allDeps(pkg);
  const range = deps.tailwindcss;
  if (deps["@tailwindcss/postcss"] || deps["@tailwindcss/vite"]) return 4;
  if (!range) {
    return ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs"].some((f) =>
      existsSync(path.join(appRoot, f)),
    )
      ? 3
      : null;
  }
  const major = Number(range.replace(/^[~^>=<\s]+/, "").split(".")[0]);
  return major >= 4 ? 4 : 3;
}

function isNextApp(dir: string): boolean {
  return Boolean(allDeps(readPackageJson(dir)).next);
}

export interface DetectOptions {
  /** `--app <path>` inside a monorepo. */
  app?: string;
  /** `--framework` override. */
  framework?: "nextjs" | "generic";
  /** `--url` (generic mode). */
  url?: string;
  env?: Record<string, string | undefined>;
}

/** Detect the framework, router, package manager, start command and URL (SPEC §8.1). */
export function detectProject(cwd: string, options: DetectOptions = {}): Detection {
  let appRoot = path.resolve(cwd, options.app ?? ".");
  const workspaceRoot = findWorkspaceRoot(appRoot);
  let candidates: string[] = [];

  if (!options.app && options.framework !== "generic" && !options.url && !isNextApp(appRoot)) {
    const globs = workspaceGlobs(appRoot);
    if (globs) {
      candidates = expandWorkspaceGlobs(appRoot, globs).filter(isNextApp);
      if (candidates.length === 1) {
        appRoot = candidates[0]!;
      } else if (candidates.length > 1 && options.framework === "nextjs") {
        throw new DemovieError(
          "E_USAGE",
          `found ${candidates.length} Next.js apps in this workspace: ${candidates.map((c) => path.relative(cwd, c)).join(", ")}`,
          `re-run with --app <path>, e.g. \`npx demovie init --app ${path.relative(cwd, candidates[0]!)}\``,
        );
      }
    }
  }

  const pkg = readPackageJson(appRoot);
  const pm = detectPackageManager(appRoot);
  const deps = allDeps(pkg);
  const isNext =
    options.framework === "nextjs" || (options.framework !== "generic" && !options.url && Boolean(deps.next));

  let nextjs: NextjsDetection | null = null;
  if (isNext) {
    const appDir = ["src/app", "app"].find((d) => hasRouteFiles(path.join(appRoot, d))) ?? null;
    const pagesDir = ["src/pages", "pages"].find((d) => existsSync(path.join(appRoot, d))) ?? null;
    nextjs = {
      version: installedNextVersion(appRoot, deps.next),
      router: appDir && pagesDir ? "both" : pagesDir && !appDir ? "pages" : "app",
      appDir,
      pagesDir,
      ...readNextConfig(appRoot),
    };
  }

  const scripts = pkg?.scripts ?? {};
  const env = options.env ?? process.env;
  const devScript = scripts.dev ? "dev" : scripts.start ? "start" : null;
  const port = portFromScript(devScript ? scripts[devScript] : undefined, env);
  const startCommand = devScript ? runScriptCommand(pm, devScript) : null;
  const buildStartCommand =
    scripts.build && scripts.start ? `${runScriptCommand(pm, "build")} && ${runScriptCommand(pm, "start")}` : null;
  const seedScript = ["demo:seed", "seed:demo", "db:seed:demo", "seed"].find((s) => scripts[s]);
  const url = options.url ?? `http://localhost:${port}${nextjs?.basePath ?? ""}`;

  return {
    framework: isNext ? "nextjs" : "generic",
    appRoot,
    workspaceRoot: workspaceRoot && workspaceRoot !== appRoot ? workspaceRoot : null,
    packageManager: pm,
    packageJson: pkg,
    name: guessProductName(appRoot, pkg),
    nextjs,
    startCommand,
    buildStartCommand,
    port,
    url,
    tailwind: detectTailwind(appRoot, pkg),
    shadcn: existsSync(path.join(appRoot, "components.json")),
    seedCommand: seedScript ? runScriptCommand(pm, seedScript) : null,
    candidates: candidates.map((c) => path.relative(cwd, c) || "."),
  };
}

/** Product name: root layout metadata title, else package name. */
export function guessProductName(appRoot: string, pkg: PackageJson | null): string {
  for (const layout of [
    "src/app/layout.tsx",
    "app/layout.tsx",
    "src/app/layout.jsx",
    "app/layout.jsx",
    "src/app/layout.js",
    "app/layout.js",
  ]) {
    const file = path.join(appRoot, layout);
    if (!existsSync(file)) continue;
    const ast = parseModule(readFileSync(file, "utf8"), file);
    if (!ast) continue;
    let title: string | null = null;
    walk(ast, (node) => {
      if (title || node.type !== "Property" || node.key?.name !== "title") return;
      if (node.value.type === "Literal" && typeof node.value.value === "string") title = node.value.value;
      else if (node.value.type === "ObjectExpression") {
        const def = (node.value.properties as AnyNode[]).find((p) => p.key?.name === "default");
        if (def?.value.type === "Literal") title = String(def.value.value);
      }
    });
    if (title) return cleanTitle(title);
  }
  return pkg?.name ? titleCase(pkg.name) : titleCase(path.basename(appRoot));
}

/** "Harborly — Plan, ship…" / "Dashboard | Harborly" → the product-ish part. */
export function cleanTitle(title: string): string {
  const parts = title
    .split(/\s+[|·•—–-]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return title.trim();
  return [...parts].sort((a, b) => a.length - b.length)[0]!;
}
