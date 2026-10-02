import { existsSync } from "node:fs";
import path from "node:path";
import { DemovieError } from "./errors.ts";
import { logger } from "./logger.ts";
import { type Config, ConfigSchema } from "./schemas/config.ts";
import { loadDotEnv, resolveEnvRefs } from "./util/env.ts";
import { readJson, sha256, toPosix, writeJson } from "./util/fs.ts";
import { VERSION } from "./version.ts";

export const DEMOVIE_DIR = ".demovie";

/** Every path inside a project's `.demovie/` folder (SPEC §6). */
export interface ProjectPaths {
  /** The app root (the folder that contains `.demovie/`). */
  root: string;
  dir: string;
  config: string;
  brandDir: string;
  brandJson: string;
  brandFontsDir: string;
  glossaryMd: string;
  glossaryJson: string;
  routes: string;
  flowsDir: string;
  assetsDir: string;
  assetsJson: string;
  videosDir: string;
  capturesDir: string;
  captureIndex: string;
  env: string;
  authDir: string;
  authState: string;
  cacheDir: string;
  appLog: string;
  appState: string;
  gitignore: string;
}

export function projectPaths(root: string): ProjectPaths {
  const dir = path.join(root, DEMOVIE_DIR);
  return {
    root,
    dir,
    config: path.join(dir, "config.json"),
    brandDir: path.join(dir, "brand"),
    brandJson: path.join(dir, "brand", "brand.json"),
    brandFontsDir: path.join(dir, "brand", "fonts"),
    glossaryMd: path.join(dir, "glossary.md"),
    glossaryJson: path.join(dir, "glossary.json"),
    routes: path.join(dir, "routes.json"),
    flowsDir: path.join(dir, "flows"),
    assetsDir: path.join(dir, "assets"),
    assetsJson: path.join(dir, "assets.json"),
    videosDir: path.join(dir, "videos"),
    capturesDir: path.join(dir, "captures"),
    captureIndex: path.join(dir, "captures", "index.json"),
    env: path.join(dir, ".env"),
    authDir: path.join(dir, ".auth"),
    authState: path.join(dir, ".auth", "state.json"),
    cacheDir: path.join(dir, ".cache"),
    appLog: path.join(dir, ".cache", "app.log"),
    appState: path.join(dir, ".cache", "app.json"),
    gitignore: path.join(dir, ".gitignore"),
  };
}

/** Walk up from `cwd` to the nearest folder containing `.demovie/config.json`. */
export function findProjectRoot(cwd: string): string | null {
  let current = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(current, DEMOVIE_DIR, "config.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export interface Project {
  paths: ProjectPaths;
  /** The config exactly as written (with `$env:` references). */
  config: Config;
  /** The config with `$env:` references resolved; never print it. */
  resolved: Config;
  /** process.env merged over `.demovie/.env`. */
  env: Record<string, string | undefined>;
  /** Env variables referenced by the config but not set. */
  missingEnv: string[];
}

/** Load `.demovie/config.json` (validated) plus `.demovie/.env`. */
export async function loadProject(cwd: string): Promise<Project> {
  const root = findProjectRoot(cwd);
  if (!root) {
    throw new DemovieError(
      "E_NOT_INITIALIZED",
      `no .demovie/config.json found in ${cwd} or its parents`,
      "run `npx demovie init` in your app folder",
    );
  }
  const paths = projectPaths(root);
  const config = await readJson(
    paths.config,
    ConfigSchema,
    `fix ${paths.config} (see the JSON Schema in its "$schema")`,
  );
  const env = { ...loadDotEnv(paths.env), ...process.env };
  const missing = new Set<string>();
  const resolved = applyEnvOverrides(resolveEnvRefs(config, env, missing), env);
  for (const value of Object.values(loadDotEnv(paths.env))) logger.addSecret(value);
  return { paths, config, resolved, env, missingEnv: [...missing] };
}

/**
 * CI overrides (DECISIONS): `DEMOVIE_APP_URL` points at an already running app (e.g. a preview deployment),
 * `DEMOVIE_APP_START` replaces the start command, `DEMOVIE_APP_HEADERS` (a JSON object) adds request headers such as
 * Vercel's protection bypass. Header values are treated as secrets.
 */
export function applyEnvOverrides(config: Config, env: Record<string, string | undefined>): Config {
  const app = { ...config.app };
  if (env.DEMOVIE_APP_URL) {
    app.url = env.DEMOVIE_APP_URL;
    app.start = null;
  }
  if (env.DEMOVIE_APP_START && !env.DEMOVIE_APP_URL)
    app.start = { cwd: ".", env: {}, readyPath: "/", timeoutMs: 120_000, ...app.start, command: env.DEMOVIE_APP_START };
  if (env.DEMOVIE_APP_HEADERS) {
    let headers: Record<string, string>;
    try {
      headers = JSON.parse(env.DEMOVIE_APP_HEADERS) as Record<string, string>;
    } catch {
      throw new DemovieError(
        "E_CONFIG",
        "DEMOVIE_APP_HEADERS is not a JSON object",
        'set it like {"x-vercel-protection-bypass":"…"}',
      );
    }
    for (const value of Object.values(headers)) logger.addSecret(String(value));
    app.headers = { ...app.headers, ...headers };
  }
  return app === config.app ? config : { ...config, app };
}

export async function saveConfig(paths: ProjectPaths, config: Config): Promise<void> {
  await writeJson(paths.config, config);
}

/**
 * `$schema` value for a JSON file written in `fromDir` (SPEC §6.1): the schema of the locally installed package when
 * demovie is in the project's node_modules, otherwise the unpkg URL for this version. Relative to the file itself,
 * which is how editors resolve it.
 */
export function schemaRef(root: string, fromDir: string, name: string): string {
  const local = path.join(root, "node_modules", "demovie", "schema", name);
  return existsSync(local)
    ? toPosix(path.relative(fromDir, local))
    : `https://unpkg.com/demovie@${VERSION}/schema/${name}`;
}

/** Hash of the config, used for capture freshness (SPEC §9.9). */
export function configHash(config: Config): string {
  const { $schema: _schema, ...rest } = config;
  return sha256(JSON.stringify(rest)).slice(0, 16);
}

export const GENERATED_GITIGNORE = `# Generated by demovie init — keeps secrets, caches and captures out of git (SPEC §17).
.env
.auth/
.cache/
captures/
videos/*/out/
videos/*/qa.json
`;
