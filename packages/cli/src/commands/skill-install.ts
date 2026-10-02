import { AGENT_IDS, type AgentId, DemovieError, findProjectRoot, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { installSkill } from "../lib/skill.ts";
import type { CommandResult } from "../output.ts";

/**
 * `demovie skill install [--agent …] [--global]` (SPEC §14.2): project-level by default — `.claude/skills/demovie`
 * (Claude Code) and `.agents/skills/demovie` (Codex, Cursor and other Agent Skills readers). `--global` only on request.
 */
export async function run(
  ctx: CommandContext,
  options: { agent?: string[]; global?: boolean },
): Promise<CommandResult> {
  const root = findProjectRoot(ctx.cwd) ?? ctx.cwd;
  for (const a of options.agent ?? [])
    if (!AGENT_IDS.includes(a as AgentId))
      throw new DemovieError("E_USAGE", `unknown agent "${a}"`, `use --agent ${AGENT_IDS.join(",")}`);
  const configured = findProjectRoot(ctx.cwd) ? (await loadProject(ctx.cwd)).config.agents : [];
  const agents: AgentId[] = options.agent?.length
    ? (options.agent as AgentId[])
    : configured.length
      ? configured
      : ["claude", "codex"];
  const result = await installSkill(root, agents, { global: Boolean(options.global) });
  if (result.skipped)
    throw new DemovieError(
      "E_FAILED",
      `skill not installed: ${result.skipped}`,
      "reinstall demovie (npm i -D demovie)",
    );
  return {
    data: { ...result, agents, global: Boolean(options.global) },
    human: [
      ...result.installed.map((dir) => `installed the demovie skill ${result.version} → ${dir}`),
      `Agents read it from there; ask yours to "make a launch video with demovie", or run \`npx demovie make\`.`,
    ],
  };
}
