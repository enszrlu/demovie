import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { type AgentId, DemovieError, which, writeJson } from "@demovie/core";

export const MCP_SERVER = { command: "npx", args: ["-y", "demovie", "mcp"] };

/** Agents a project already uses, from files in the repo (never from global config). */
export function detectProjectAgents(root: string): AgentId[] {
  const found: AgentId[] = [];
  if (existsSync(path.join(root, ".claude")) || existsSync(path.join(root, "CLAUDE.md"))) found.push("claude");
  if (
    existsSync(path.join(root, ".codex")) ||
    existsSync(path.join(root, "AGENTS.md")) ||
    existsSync(path.join(root, ".agents"))
  )
    found.push("codex");
  if (existsSync(path.join(root, ".cursor")) || existsSync(path.join(root, ".cursorrules"))) found.push("cursor");
  return found;
}

/** Agent CLIs on PATH (for hints only). */
export function installedAgentClis(): Record<AgentId, string | null> {
  return { claude: which("claude"), codex: which("codex"), cursor: which("cursor-agent") ?? which("agent") };
}

/**
 * Merge the demovie MCP server into the project's `.cursor/mcp.json` (SPEC §14.3). Other servers are kept.
 */
export async function mergeCursorMcp(root: string): Promise<{ file: string; changed: boolean }> {
  const file = path.join(root, ".cursor", "mcp.json");
  let data: { mcpServers?: Record<string, unknown> } & Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      throw new DemovieError(
        "E_CONFIG",
        `${file} is not valid JSON: ${(error as Error).message}`,
        `fix or remove ${file}, then re-run`,
      );
    }
  }
  const servers = (data.mcpServers ?? {}) as Record<string, unknown>;
  const desired = { type: "stdio", ...MCP_SERVER };
  const changed = JSON.stringify(servers.demovie) !== JSON.stringify(desired);
  if (changed) {
    data.mcpServers = { ...servers, demovie: desired };
    await writeJson(file, data);
  }
  return { file, changed };
}

/** Snippets for agents whose MCP config is global; demovie never edits global config (SPEC §6, §14.3). */
export function mcpSnippets(): Record<string, string> {
  return {
    codex: `# ~/.codex/config.toml  (or run: codex mcp add demovie -- npx -y demovie mcp)\n[mcp_servers.demovie]\ncommand = "npx"\nargs = ["-y", "demovie", "mcp"]`,
    claude: "claude mcp add demovie -- npx -y demovie mcp   # or install the demovie plugin, which registers it",
  };
}
