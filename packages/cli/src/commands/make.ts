import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  DemovieError,
  findProjectRoot,
  loadProject,
  projectPaths,
  TYPE_PRESETS,
  toPosix,
  type VideoType,
  which,
} from "@demovie/core";
import { execa } from "execa";
import { ADAPTERS, type AgentAdapter, customAdapter } from "../adapters/index.ts";
import { type CommandContext, isCI } from "../context.ts";
import { AgentProgress, type AgentRunSummary, formatDuration } from "../lib/agent-progress.ts";
import { installSkill, SKILL_DIRS } from "../lib/skill.ts";
import type { CommandResult } from "../output.ts";

export interface MakeOptions {
  agent?: "claude" | "codex" | "cursor" | "custom";
  agentCmd?: string;
  model?: string;
  type?: VideoType;
  duration?: number;
  format?: string[];
  about?: string;
  resources?: string[];
  voice?: boolean;
  review?: boolean;
  dryRun?: boolean;
}

/** The prompt of SPEC §14.4, verbatim apart from the filled-in values. */
export function makePrompt(o: {
  type: VideoType;
  duration: number;
  formats: string[];
  about: string;
  resources: string[];
  voice: boolean;
  review: boolean;
}): string {
  return [
    `Use the demovie skill to make a ${o.type} video (${o.duration}s, ${o.formats.join(", ")}) about: ${o.about}.`,
    `Resources: ${o.resources.length ? o.resources.join(", ") : "none"}.`,
    `Voiceover: ${o.voice ? "on" : "off"}.`,
    o.review ? "Review the brief and storyboard with me before animating." : "Work autonomously; do not ask questions.",
  ].join(" ");
}

/** POSIX-shell quoting for --dry-run output. */
export function shellQuote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`;
}

function findBinary(adapter: AgentAdapter): string | null {
  for (const b of adapter.binaries) {
    if (b.includes("/") || b.includes("\\")) return existsSync(b) ? b : null;
    const found = which(b);
    if (found) return b;
  }
  return null;
}

/** `demovie make` (SPEC §14.4): launch the user's own, already signed-in agent CLI with the demovie skill. */
/** Set for the agent `make` starts, so that agent can't start another one (or any command via --agent-cmd). */
export const MAKE_ENV = "DEMOVIE_MAKE_SESSION";

export async function run(ctx: CommandContext, options: MakeOptions): Promise<CommandResult> {
  if (process.env[MAKE_ENV])
    throw new DemovieError(
      "E_USAGE",
      "demovie make is already running: an agent it started can't start another agent",
      "make the video in this session with the demovie skill instead (capture, new, stills, qa, render)",
    );
  let root = findProjectRoot(ctx.cwd) ?? ctx.cwd;
  let project = findProjectRoot(ctx.cwd) ? await loadProject(ctx.cwd) : null;

  // agent selection: explicit, else the project's configured agents, else whatever is installed
  const available = Object.values(ADAPTERS)
    .filter((a) => findBinary(a))
    .map((a) => a.id);
  ctx.logger.debug(`agent CLIs on PATH: ${available.join(", ") || "none"}`);
  let adapter: AgentAdapter;
  if (options.agent === "custom" || (!options.agent && options.agentCmd)) {
    if (!options.agentCmd)
      throw new DemovieError(
        "E_USAGE",
        "--agent custom needs --agent-cmd",
        'pass e.g. --agent-cmd "mytool run {prompt}"',
      );
    adapter = customAdapter(options.agentCmd);
  } else if (options.agent) {
    adapter = ADAPTERS[options.agent];
  } else {
    const order = [...(project?.config.agents ?? []), "claude", "codex", "cursor"] as (keyof typeof ADAPTERS)[];
    const available = order.map((id) => ADAPTERS[id]).find((a) => findBinary(a));
    if (!available)
      throw new DemovieError(
        "E_PREREQ",
        "no agent CLI found on PATH (looked for claude, codex, cursor-agent)",
        'install one and sign in to it yourself, or pass --agent custom --agent-cmd "mytool run {prompt}"',
      );
    adapter = available;
  }
  const binary = findBinary(adapter);
  if (!binary)
    throw new DemovieError(
      "E_PREREQ",
      `${adapter.label} (${adapter.binaries.join(" or ")}) is not installed or not on PATH`,
      `install ${adapter.label} and sign in to it yourself, then re-run; or pick another --agent`,
    );

  // A repo without .demovie/: set it up first, since the agent isn't allowed to run `init` itself.
  if (!project && !options.dryRun) {
    ctx.logger.step("no .demovie/ here yet: running `demovie init` first");
    const init = await import("./init.ts");
    const setup = await init.run(ctx, adapter.id === "custom" ? {} : { agents: [adapter.id] });
    for (const line of [setup.human].flat()) if (line) ctx.logger.info(line);
    const initialized = findProjectRoot(ctx.cwd);
    if (!initialized)
      throw new DemovieError(
        "E_CONFIG",
        "`demovie init` did not create .demovie/config.json",
        "run `npx demovie init` yourself, then `npx demovie make` again",
      );
    root = initialized;
    project = await loadProject(ctx.cwd);
  }

  const type = options.type ?? "launch";
  const preset = TYPE_PRESETS[type];
  const duration = options.duration ?? preset.defaultDuration;
  const formats = options.format?.length ? options.format : preset.formats;
  const headless = ctx.yes || isCI() || !process.stdin.isTTY || !process.stdout.isTTY;
  const review = options.review ?? !headless;
  const prompt = makePrompt({
    type,
    duration,
    formats,
    about: options.about ?? project?.config.project.name ?? path.basename(root),
    resources: options.resources ?? [],
    voice: Boolean(options.voice),
    review,
  });
  const mode: "interactive" | "headless" = !headless && review ? "interactive" : "headless";
  const args =
    mode === "interactive"
      ? adapter.interactive(prompt, { model: options.model })
      : adapter.headless(prompt, { model: options.model, voice: Boolean(options.voice) });
  const command = [binary, ...args].map(shellQuote).join(" ");

  // the agent needs the skill where it looks for skills (project-level only)
  const skillAgents = adapter.id === "custom" ? (["claude", "codex"] as const) : ([adapter.id] as const);
  const missingSkill = skillAgents.filter((a) => !existsSync(path.join(root, SKILL_DIRS[a], "SKILL.md")));

  if (options.dryRun) {
    return {
      data: {
        agent: adapter.id,
        available,
        binary,
        mode,
        args,
        command,
        prompt,
        cwd: root,
        installsSkill: missingSkill,
      },
      human: [
        command,
        `# ${adapter.label}, ${mode} mode, in ${path.relative(ctx.cwd, root) || "."}${missingSkill.length ? ` · would install the skill for ${missingSkill.join(", ")}` : ""}`,
        `# agent CLIs on PATH: ${available.join(", ") || "none"}`,
      ],
    };
  }

  if (missingSkill.length) {
    const result = await installSkill(root, [...missingSkill]);
    if (result.installed.length) ctx.logger.step(`installed the demovie skill: ${result.installed.join(", ")}`);
  }
  ctx.logger.step(`launching ${adapter.label} (${mode})…`);
  ctx.logger.debug(command);
  const started = Date.now();
  let exitCode: number;
  let summary: AgentRunSummary | null = null;
  let log: string | null = null;
  if (mode === "headless" && adapter.id !== "custom") {
    // Readable progress instead of the agent's raw JSON event stream, which is kept as a log.
    const logDir = path.join(projectPaths(root).cacheDir, "make");
    await mkdir(logDir, { recursive: true });
    log = path.join(logDir, `${new Date(started).toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const raw = createWriteStream(log);
    const out = ctx.json ? process.stderr : process.stdout;
    const progress = new AgentProgress((line) => out.write(`${line}\n`));
    const child = execa(binary, args, {
      cwd: root,
      env: { [MAKE_ENV]: "1" },
      reject: false,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "inherit",
      buffer: false,
    });
    const lines = createInterface({ input: child.stdout! });
    lines.on("line", (line) => {
      raw.write(`${line}\n`);
      progress.line(line);
    });
    const [finished] = await Promise.all([child, new Promise((resolve) => lines.once("close", resolve))]);
    await new Promise((resolve) => raw.end(resolve));
    exitCode = typeof finished.exitCode === "number" ? finished.exitCode : 1;
    summary = progress.summary();
  } else {
    const child = await execa(binary, args, {
      cwd: root,
      env: { [MAKE_ENV]: "1" },
      reject: false,
      stdin: "inherit",
      stdout: ctx.json ? process.stderr : "inherit",
      stderr: "inherit",
    });
    exitCode = typeof child.exitCode === "number" ? child.exitCode : 1;
  }

  const durationMs = summary?.durationMs ?? Date.now() - started;
  const videos = videosSince(root, started).map((f) => toPosix(path.relative(ctx.cwd, f)));
  const facts = [
    formatDuration(durationMs),
    ...(summary?.turns ? [`${summary.turns} turns`] : []),
    ...(summary?.costUsd ? [`$${summary.costUsd.toFixed(2)} (as reported by ${adapter.label})`] : []),
  ];
  return {
    data: {
      agent: adapter.id,
      mode,
      command,
      exitCode,
      durationMs,
      turns: summary?.turns ?? null,
      costUsd: summary?.costUsd ?? null,
      videos,
      log: log ? toPosix(path.relative(ctx.cwd, log)) : null,
    },
    human: [
      exitCode === 0
        ? `${adapter.label} finished · ${facts.join(" · ")}`
        : `${adapter.label} exited with ${exitCode} · ${facts.join(" · ")}`,
      videos.length ? `videos: ${videos.join(", ")}` : "no new MP4 in .demovie/videos/*/out",
      ...(log ? [`full agent log: ${toPosix(path.relative(ctx.cwd, log))}`] : []),
    ],
    exitCode,
  };
}

/** MP4s written under .demovie/videos/<slug>/out since `since` (ms). */
function videosSince(root: string, since: number): string[] {
  const dir = projectPaths(root).videosDir;
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const slug of readdirSync(dir)) {
    const outDir = path.join(dir, slug, "out");
    if (!existsSync(outDir)) continue;
    for (const file of readdirSync(outDir))
      if (file.endsWith(".mp4") && statSync(path.join(outDir, file)).mtimeMs >= since)
        found.push(path.join(outDir, file));
  }
  return found.sort();
}
