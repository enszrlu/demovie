import { type AgentAdapter, withModel } from "./types.ts";

/** Cursor's CLI (`cursor-agent`, also installed as `agent`), flags checked against `--help` 2026.10.01 (DECISIONS). */
export const cursor: AgentAdapter = {
  id: "cursor",
  label: "Cursor CLI",
  binaries: ["cursor-agent", "agent"],
  modelFlag: "--model",
  interactive: (prompt, o) => [...withModel("--model", o), prompt],
  headless: (prompt, o) => [
    "-p",
    "--output-format",
    "stream-json",
    "--force",
    "--trust",
    ...withModel("--model", o),
    prompt,
  ],
  verify: {
    helpArgs: [["--help"]],
    flags: ["--print", "--output-format", "--force", "--trust", "--model"],
    checkedWith: "cursor-agent 2026.10.01",
  },
};
