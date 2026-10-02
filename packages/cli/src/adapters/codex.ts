import { type AgentAdapter, withModel } from "./types.ts";

/**
 * Codex CLI (`codex`), flags checked against `codex --help` / `codex exec --help` 0.156.1 (DECISIONS). Headless runs
 * use the workspace-write sandbox with network access, which `npx demovie` needs for the local app and Chromium.
 */
export const codex: AgentAdapter = {
  id: "codex",
  label: "Codex CLI",
  binaries: ["codex"],
  modelFlag: "-m",
  interactive: (prompt, o) => [...withModel("-m", o), prompt],
  headless: (prompt, o) => [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "-c",
    "sandbox_workspace_write.network_access=true",
    ...withModel("-m", o),
    prompt,
  ],
  verify: {
    helpArgs: [["--help"], ["exec", "--help"]],
    flags: ["--json", "--sandbox", "workspace-write", "--config", "--model"],
    checkedWith: "codex-cli 0.156.1",
  },
};
