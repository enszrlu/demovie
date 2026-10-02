import { DemovieError } from "@demovie/core";
import type { AgentAdapter } from "./types.ts";

/** Split a command template like a shell would (quotes and backslashes), without running a shell. */
export function splitCommand(template: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < template.length) current += template[++i];
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (ch === "\\" && i + 1 < template.length) {
      current += template[++i];
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || current) out.push(current);
      current = "";
      has = false;
    } else {
      current += ch;
      has = true;
    }
  }
  if (quote)
    throw new DemovieError("E_USAGE", `unterminated ${quote} in --agent-cmd`, "close the quote in --agent-cmd");
  if (has || current) out.push(current);
  return out;
}

/** `--agent custom --agent-cmd "mytool run {prompt}"`: `{prompt}` and `{model}` are replaced inside arguments. */
export function customAdapter(template: string): AgentAdapter {
  const parts = splitCommand(template);
  if (parts.length === 0)
    throw new DemovieError("E_USAGE", "--agent-cmd is empty", 'pass e.g. --agent-cmd "mytool run {prompt}"');
  const [binary, ...rest] = parts as [string, ...string[]];
  const build = (prompt: string, model?: string) => {
    const args = rest.map((a) => a.replaceAll("{prompt}", prompt).replaceAll("{model}", model ?? ""));
    return rest.some((a) => a.includes("{prompt}")) ? args : [...args, prompt];
  };
  return {
    id: "custom",
    label: binary,
    binaries: [binary],
    modelFlag: null,
    interactive: (prompt, o) => build(prompt, o.model),
    headless: (prompt, o) => build(prompt, o.model),
    verify: null,
  };
}
