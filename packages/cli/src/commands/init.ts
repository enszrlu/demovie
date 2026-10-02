import { existsSync } from "node:fs";
import path from "node:path";
import {
  type AgentId,
  type Config,
  ConfigSchema,
  checkUrl,
  DemovieError,
  type Detection,
  detectProject,
  discoverRoutes,
  ensureDir,
  GENERATED_GITIGNORE,
  loadDotEnv,
  projectPaths,
  resolveEnvRefs,
  schemaRef,
  upsertDotEnv,
  writeFileAtomic,
  writeJson,
} from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { detectProjectAgents, installedAgentClis, mcpSnippets, mergeCursorMcp } from "../lib/agents.ts";
import { type ExtractSummary, runExtraction } from "../lib/extract.ts";
import { ask, clack } from "../lib/prompts.ts";
import { installSkill } from "../lib/skill.ts";
import type { CommandResult } from "../output.ts";

export interface InitOptions {
  url?: string;
  framework?: "nextjs" | "generic";
  app?: string;
  agents?: string[];
  about?: string;
  start?: string;
  seed?: string;
  auth?: Config["auth"]["strategy"];
  loginPath?: string;
  successPath?: string;
  extract?: boolean;
  skill?: boolean;
  force?: boolean;
}

const FICTIONAL_TLD = /\.(demo|example|test|invalid|local|localhost)$/i;

function defaultNow(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}T10:30:00.000Z`;
}

function guessSuccessPath(routes: { path: string; protected: boolean | null; dynamic: boolean }[]): string | null {
  const prot = routes
    .filter((r) => r.protected && !r.dynamic)
    .map((r) => r.path)
    .sort((a, b) => a.length - b.length);
  return prot[0] ?? null;
}

export async function run(ctx: CommandContext, options: InitOptions): Promise<CommandResult> {
  const interactive = ctx.interactive;
  if (interactive) clack.intro("demovie");

  // 1. Detect
  let detection: Detection = detectProject(ctx.cwd, {
    ...(options.app ? { app: options.app } : {}),
    ...(options.framework ? { framework: options.framework } : {}),
    ...(options.url ? { url: options.url } : {}),
  });
  if (detection.framework === "generic" && detection.candidates.length > 1 && !options.framework && !options.url) {
    if (!interactive) {
      throw new DemovieError(
        "E_USAGE",
        `found ${detection.candidates.length} Next.js apps: ${detection.candidates.join(", ")}`,
        `re-run with --app <path>, e.g. \`npx demovie init --app ${detection.candidates[0]}\``,
      );
    }
    const app = await ask.select(
      "Which app is the product?",
      detection.candidates.map((c) => ({ value: c, label: c })),
    );
    detection = detectProject(ctx.cwd, { app });
  }
  if (detection.framework === "generic" && !options.url && !interactive) {
    throw new DemovieError(
      "E_USAGE",
      "no supported framework detected and no --url given",
      "run `npx demovie init --url http://localhost:<port>` (generic mode) or run init inside your Next.js app",
    );
  }

  const root = detection.appRoot;
  const paths = projectPaths(root);
  const exists = existsSync(paths.config);
  const describe = detection.nextjs
    ? `Next.js ${detection.nextjs.version ?? "?"} (${detection.nextjs.router === "both" ? "App + Pages Router" : detection.nextjs.router === "app" ? `App Router, ${detection.nextjs.appDir}` : `Pages Router, ${detection.nextjs.pagesDir}`})${detection.packageManager ? ` · ${detection.packageManager}` : ""}${detection.tailwind ? ` · Tailwind v${detection.tailwind}` : ""}${detection.shadcn ? " · shadcn/ui" : ""}`
    : `generic site at ${detection.url}`;
  ctx.logger.step(`Detected ${describe}`);

  // 2. Build or reuse the config
  let config: Config;
  if (exists && !options.force) {
    config = ConfigSchema.parse(
      JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(paths.config, "utf8"))),
    );
    ctx.logger.step(
      `Using the existing ${path.relative(ctx.cwd, paths.config) || ".demovie/config.json"} (pass --force to regenerate it)`,
    );
  } else {
    const fsRoutes = detection.nextjs ? discoverRoutes(root, detection.nextjs) : [];
    const loginRoute = fsRoutes.find((r) => /\/(log-?in|sign-?in)$/i.test(r.path))?.path ?? null;
    let startCommand = options.start ?? detection.startCommand;
    let url = options.url ?? detection.url;
    let seed = options.seed ?? detection.seedCommand;
    let strategy: Config["auth"]["strategy"] = options.auth ?? (loginRoute ? "form" : "none");
    let loginPath = options.loginPath ?? loginRoute;
    let successPath = options.successPath ?? guessSuccessPath(fsRoutes);
    let username = process.env.DEMOVIE_USER ?? loadDotEnv(paths.env).DEMOVIE_USER;
    let password: string | undefined;
    let agents: AgentId[] = (options.agents as AgentId[] | undefined) ?? detectProjectAgents(root);
    if (agents.length === 0) agents = ["claude"];

    if (interactive) {
      if (detection.framework === "nextjs") {
        startCommand =
          (await ask.text(`Start command (port ${detection.port})`, { initial: startCommand ?? "", optional: true })) ||
          null;
      }
      url = await ask.text("App URL", { initial: url });
      const reach = await checkUrl(url, { timeoutMs: 3000 });
      clack.log.step(
        reach.ok
          ? `Your app is running at ${url} ✓`
          : `Your app is not running at ${url} (demovie starts it with the start command)`,
      );
      const needsLogin = await ask.confirm("Does the product need a login?", strategy !== "none");
      if (needsLogin) {
        strategy = await ask.select(
          "How does demovie log in?",
          [
            { value: "form", label: "Email + password form", hint: "fills your login page" },
            {
              value: "storageState",
              label: "Record a login once",
              hint: "OAuth, magic link, 2FA (`demovie auth record`)",
            },
            { value: "script", label: "Custom script", hint: ".demovie/auth.ts" },
          ],
          strategy === "none" ? "form" : strategy,
        );
        loginPath = await ask.text("Login page path", { initial: loginPath ?? "/login" });
        successPath =
          (await ask.text("Path reached after login", { initial: successPath ?? "/", optional: true })) || null;
        if (strategy === "form") {
          username = await ask.text("Test user email", { initial: username ?? "" });
          password = await ask.password("Test user password (stored in .demovie/.env, gitignored)");
        }
      } else {
        strategy = "none";
      }
      seed = (await ask.text("Demo data seed command (optional)", { initial: seed ?? "", optional: true })) || null;
      const clis = installedAgentClis();
      agents = await ask.multiselect(
        "Agents you use",
        (["claude", "codex", "cursor"] as AgentId[]).map((a) => ({
          value: a,
          label: a === "claude" ? "Claude Code" : a === "codex" ? "Codex" : "Cursor",
          hint: clis[a] ? "installed" : "not found on PATH",
        })),
        agents,
      );
    }

    const allowDomain = username?.split("@")[1];
    config = ConfigSchema.parse({
      $schema: schemaRef(root, paths.dir, "config.schema.json"),
      version: 1,
      project: {
        name: detection.name,
        framework: detection.framework,
        root: ".",
        nextjs: detection.nextjs
          ? {
              version: detection.nextjs.version,
              router: detection.nextjs.router,
              appDir: detection.nextjs.appDir,
              pagesDir: detection.nextjs.pagesDir,
              basePath: detection.nextjs.basePath,
              ...(detection.nextjs.i18n ? { i18n: detection.nextjs.i18n } : {}),
              output: detection.nextjs.output,
            }
          : null,
      },
      app: {
        url,
        start: startCommand
          ? { command: startCommand, cwd: ".", env: { DEMO_MODE: "1" }, readyPath: "/", timeoutMs: 120_000 }
          : null,
        reuseRunning: true,
        headers: {},
      },
      demo: {
        seed: seed ?? null,
        now: defaultNow(),
        hide: [".cookie-banner", "#intercom-container"],
        mask: { allow: allowDomain && FICTIONAL_TLD.test(allowDomain) ? [`*@${allowDomain}`] : [] },
      },
      auth: {
        strategy,
        loginPath: strategy === "none" ? null : loginPath,
        successPath: strategy === "none" ? null : successPath,
        script: strategy === "script" ? ".demovie/auth.ts" : null,
      },
      capture: { fullPage: fsRoutes.some((r) => r.path === "/") ? ["/"] : [] },
      agents,
    });

    await ensureDir(paths.dir);
    for (const dir of [paths.flowsDir, paths.assetsDir, paths.videosDir, paths.brandDir]) await ensureDir(dir);
    await writeJson(paths.config, config);
    await writeFileAtomic(paths.gitignore, GENERATED_GITIGNORE);
    if (!existsSync(paths.assetsJson)) await writeJson(paths.assetsJson, { assets: [] });
    if (password && username) await upsertDotEnv(paths.env, { DEMOVIE_USER: username, DEMOVIE_PASSWORD: password });
    else if (username && !process.env.DEMOVIE_USER && !loadDotEnv(paths.env).DEMOVIE_USER)
      await upsertDotEnv(paths.env, { DEMOVIE_USER: username });
  }

  // 3. Extract
  let summary: ExtractSummary | null = null;
  const env = { ...loadDotEnv(paths.env), ...process.env };
  const missing = new Set<string>();
  const resolved = resolveEnvRefs(config, env, missing);
  if (options.extract !== false) {
    const spinner = interactive ? clack.spinner() : null;
    spinner?.start("Extracting…");
    summary = await runExtraction({
      project: { paths, config, resolved, env, missingEnv: [...missing] },
      target: "all",
      detection,
      ...(options.about ? { about: options.about } : {}),
    });
    spinner?.stop("Extracted");
    if (summary.runtime.note) ctx.logger.warn(summary.runtime.note);
  }

  // 4. Agent setup (project-level only; global config is never touched)
  const agents = config.agents;
  const skill =
    options.skill === false ? { installed: [], skipped: "--no-skill", version: "" } : await installSkill(root, agents);
  const mcp: string[] = [];
  if (agents.includes("cursor")) {
    const merged = await mergeCursorMcp(root);
    mcp.push(path.relative(root, merged.file));
  }
  const snippets = mcpSnippets();
  const hints = agents.includes("codex")
    ? [`Codex MCP (add it yourself; demovie never edits global config):\n${snippets.codex}`]
    : [];

  const next = 'npx demovie capture, then ask your agent: "/demovie make a 30s launch video"';
  const human: string[] = [];
  if (summary?.brand) {
    human.push(
      `brand: ${summary.brand.colors} colors · ${summary.brand.fonts.length} fonts (${summary.brand.fonts.join(", ") || "none"}) · ${summary.brand.logo ? path.basename(summary.brand.logo) : "no logo"}`,
    );
  }
  if (summary?.routes && summary.glossary) {
    human.push(
      `routes: ${summary.routes.total} (${summary.routes.protected} behind login) · glossary: ${summary.glossary.terms} terms`,
    );
  }
  human.push(
    `skill → ${skill.installed.length ? skill.installed.join(", ") : `skipped (${skill.skipped})`}${mcp.length ? ` · MCP → ${mcp.join(", ")}` : ""}`,
  );
  for (const w of summary?.brand?.warnings ?? []) human.push(`warn: ${w}`);
  human.push(...hints);
  human.push(`Next: ${next}`);
  if (interactive) {
    clack.note(human.join("\n"), "Done");
    clack.outro(`Next: ${next}`);
  }

  return {
    data: {
      root,
      config: path.relative(ctx.cwd, paths.config) || paths.config,
      created: !exists || Boolean(options.force),
      detection: {
        framework: detection.framework,
        nextjs: detection.nextjs,
        packageManager: detection.packageManager,
        startCommand: config.app.start?.command ?? null,
        url: config.app.url,
        tailwind: detection.tailwind,
        shadcn: detection.shadcn,
      },
      auth: { strategy: config.auth.strategy, loginPath: config.auth.loginPath, successPath: config.auth.successPath },
      extraction: summary,
      skill,
      mcp,
      next,
    },
    human: interactive ? [] : human,
  };
}
