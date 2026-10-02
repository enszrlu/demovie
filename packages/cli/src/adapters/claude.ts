import { type AgentAdapter, withModel } from "./types.ts";

/** Tools a headless run may use without prompting: the demovie CLI plus reading and editing files. */
export const CLAUDE_ALLOWED_TOOLS = "Bash(npx demovie:*),Bash(npx -y demovie:*),Read,Write,Edit,Glob,Grep";

/** Claude Code (`claude`), flags checked against `claude --help` 2.1.247 (DECISIONS). */
export const claude: AgentAdapter = {
  id: "claude",
  label: "Claude Code",
  binaries: ["claude"],
  modelFlag: "--model",
  interactive: (prompt, o) => [...withModel("--model", o), prompt],
  headless: (prompt, o) => [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    ...withModel("--model", o),
    "--allowedTools",
    CLAUDE_ALLOWED_TOOLS,
  ],
  verify: {
    helpArgs: [["--help"]],
    flags: ["--print", "--output-format", "--verbose", "--permission-mode", "--model", "--allowedTools"],
    checkedWith: "claude 2.1.247",
  },
};
