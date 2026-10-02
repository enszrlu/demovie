import { existsSync } from "node:fs";
import path from "node:path";
import { DemovieError, findProjectRoot, loadProject, TYPE_PRESETS, type VideoType, which } from "@demovie/core";
import { execa } from "execa";
import { ADAPTERS, type AgentAdapter, customAdapter } from "../adapters/index.ts";
import { type CommandContext, isCI } from "../context.ts";
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
export async function run(ctx: CommandContext, options: MakeOptions): Promise<CommandResult> {
  const root = findProjectRoot(ctx.cwd) ?? ctx.cwd;
  const project = findProjectRoot(ctx.cwd) ? await loadProject(ctx.cwd) : null;

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
      : adapter.headless(prompt, { model: options.model });
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
  const child = await execa(binary, args, {
    cwd: root,
    reject: false,
    stdin: "inherit",
    stdout: ctx.json ? process.stderr : "inherit",
    stderr: "inherit",
  });
  const exitCode = typeof child.exitCode === "number" ? child.exitCode : 1;
  return {
    data: { agent: adapter.id, mode, command, exitCode },
    human: [`${adapter.label} exited with ${exitCode}`],
    exitCode,
  };
}
