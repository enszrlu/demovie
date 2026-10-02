import { existsSync, readFileSync, statSync } from "node:fs";
import { writeFileAtomic } from "./fs.ts";

/** Parse a dotenv file (KEY=value, quotes, comments, `export` prefix). */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[m[1]!] = value;
  }
  return out;
}

export function loadDotEnv(file: string): Record<string, string> {
  return existsSync(file) ? parseDotEnv(readFileSync(file, "utf8")) : {};
}

/** Merge keys into a dotenv file without touching other lines. */
export async function upsertDotEnv(file: string, entries: Record<string, string>): Promise<void> {
  const lines = existsSync(file)
    ? readFileSync(file, "utf8").split(/\r?\n/)
    : ["# demovie secrets — never commit this file"];
  const pending = new Map(Object.entries(entries));
  const updated = lines.map((line) => {
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && pending.has(m[1]!)) {
      const value = pending.get(m[1]!)!;
      pending.delete(m[1]!);
      return `${m[1]}=${quoteEnv(value)}`;
    }
    return line;
  });
  while (updated.length > 0 && updated[updated.length - 1] === "") updated.pop();
  for (const [key, value] of pending) updated.push(`${key}=${quoteEnv(value)}`);
  // Secrets: owner-only (0600) for a new file; an existing file keeps its mode.
  const mode = existsSync(file) ? statSync(file).mode & 0o777 : 0o600;
  await writeFileAtomic(file, `${updated.join("\n")}\n`, { mode });
}

function quoteEnv(value: string): string {
  return /^[A-Za-z0-9_@.\-/:+]*$/.test(value) ? value : JSON.stringify(value);
}

/**
 * Replace `"$env:NAME"` strings anywhere in a value with the named variable (SPEC §6.1).
 * Missing variables become empty strings and are reported through `missing`.
 */
export function resolveEnvRefs<T>(
  value: T,
  env: Record<string, string | undefined>,
  missing: Set<string> = new Set(),
  onResolved?: (value: string) => void,
): T {
  if (typeof value === "string") {
    const m = value.match(/^\$env:([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!m) return value;
    const resolved = env[m[1]!];
    if (resolved === undefined) missing.add(m[1]!);
    else onResolved?.(resolved);
    return (resolved ?? "") as T;
  }
  if (Array.isArray(value)) return value.map((v) => resolveEnvRefs(v, env, missing, onResolved)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveEnvRefs(v, env, missing, onResolved);
    return out as T;
  }
  return value;
}

/** A value that is plainly not a secret: an http(s) URL without credentials (e.g. `app.url` from the environment). */
export function isPlainUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}
