import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type AgentId, assetDir, parseFrontmatter, VERSION } from "@demovie/core";

/** Project-level skill folders per agent (verified 2026-10-01, see DECISIONS.md). */
export const SKILL_DIRS: Record<AgentId, string> = {
  claude: ".claude/skills/demovie",
  codex: ".agents/skills/demovie",
  cursor: ".agents/skills/demovie",
};

/** User-level folders, only with an explicit `--global`. */
export const GLOBAL_SKILL_DIRS: Record<AgentId, string> = {
  claude: ".claude/skills/demovie",
  codex: ".agents/skills/demovie",
  cursor: ".cursor/skills/demovie",
};

export interface SkillInstallResult {
  installed: string[];
  skipped: string | null;
  version: string;
}

export function bundledSkillDir(): string {
  return assetDir("skill");
}

/** Copy the Agent Skill into the folders the selected agents read. */
export async function installSkill(
  root: string,
  agents: AgentId[],
  options: { global?: boolean } = {},
): Promise<SkillInstallResult> {
  const source = bundledSkillDir();
  if (!existsSync(path.join(source, "SKILL.md"))) {
    return { installed: [], skipped: "the Agent Skill is not bundled in this build", version: VERSION };
  }
  const base = options.global ? os.homedir() : root;
  const map = options.global ? GLOBAL_SKILL_DIRS : SKILL_DIRS;
  const targets = [...new Set(agents.map((a) => map[a]))];
  const installed: string[] = [];
  for (const rel of targets) {
    const dest = path.join(base, rel);
    await rm(dest, { recursive: true, force: true });
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(source, dest, { recursive: true });
    installed.push(options.global ? path.join("~", rel) : rel);
  }
  return { installed, skipped: null, version: VERSION };
}

/** Version stamp of an installed skill (`metadata.version` in SKILL.md frontmatter). */
export function installedSkillVersion(dir: string): string | null {
  const file = path.join(dir, "SKILL.md");
  if (!existsSync(file)) return null;
  const { data } = parseFrontmatter(readFileSync(file, "utf8"));
  const meta = data.metadata as Record<string, unknown> | undefined;
  return typeof meta?.version === "string" ? meta.version : null;
}
