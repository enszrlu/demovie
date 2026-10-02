export type AgentAdapterId = "claude" | "codex" | "cursor" | "custom";

export interface AdapterOptions {
  model?: string | undefined;
}

/** Data-driven description of how to launch one agent CLI (SPEC §14.4). */
export interface AgentAdapter {
  id: AgentAdapterId;
  label: string;
  /** Binaries to look for on PATH, in order of preference. */
  binaries: string[];
  modelFlag: string | null;
  /** Interactive mode: the prompt is the agent's first message; stdio is inherited. */
  interactive(prompt: string, o: AdapterOptions): string[];
  /** Non-interactive mode for --yes/CI: streams progress, exits with the agent's exit code. */
  headless(prompt: string, o: AdapterOptions): string[];
  /** Flags this adapter passes, checked against the installed CLI's --help (`helpArgs`). */
  verify: { helpArgs: string[][]; flags: string[]; checkedWith: string } | null;
}

export const withModel = (flag: string, o: AdapterOptions): string[] => (o.model ? [flag, o.model] : []);
