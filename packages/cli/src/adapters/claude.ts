import { type AgentAdapter, withModel } from "./types.ts";

/** Tools a headless run may use without prompting: the demovie CLI plus reading and editing files. */
export const CLAUDE_ALLOWED_TOOLS = "Bash(npx demovie:*),Bash(npx -y demovie:*),Read,Write,Edit,Glob,Grep";

/**
 * What a headless run may never do, even though the allow list covers it (deny rules win over allow rules):
 * start another agent or the app, change setup, auth or CI, or edit the files that run code or hold secrets.
 */
export function claudeDeniedTools(o: { voice?: boolean | undefined } = {}): string {
  const commands = ["make", "up", "init", "auth", "ci", "mcp", "skill", ...(o.voice ? [] : ["audio voice"])];
  const bash = commands.flatMap((c) => [`Bash(npx demovie ${c}:*)`, `Bash(npx -y demovie ${c}:*)`]);
  const files = [
    "Edit(./.demovie/config.json)",
    "Edit(./.demovie/auth.ts)",
    "Edit(./.demovie/flows/**/*.ts)",
    "Edit(./.demovie/.env)",
    "Read(./.demovie/.env)",
    "Read(./.demovie/.auth/**)",
  ];
  return [...bash, ...files].join(",");
}

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
    "--disallowedTools",
    claudeDeniedTools(o),
  ],
  verify: {
    helpArgs: [["--help"]],
    flags: [
      "--print",
      "--output-format",
      "--verbose",
      "--permission-mode",
      "--model",
      "--allowedTools",
      "--disallowedTools",
    ],
    checkedWith: "claude 2.1.247",
  },
};
