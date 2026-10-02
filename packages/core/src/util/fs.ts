import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { DemovieError } from "../errors.ts";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Write atomically: temp file in the same folder, then rename. */
export async function writeFileAtomic(
  file: string,
  data: string | Uint8Array,
  options: { mode?: number } = {},
): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmp, data, options.mode === undefined ? undefined : { mode: options.mode });
  try {
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

export function stableJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/**
 * Write JSON with 2-space indentation, unless the file already holds the same data: a project formatter may have
 * reflowed it (e.g. a short array on one line), and rewriting unchanged data would only churn the user's git diff.
 */
export async function writeJson(file: string, data: unknown): Promise<void> {
  const next = stableJson(data);
  try {
    if (JSON.stringify(JSON.parse(await readFile(file, "utf8"))) === JSON.stringify(JSON.parse(next))) return;
  } catch {
    // missing or unparsable: write it
  }
  await writeFileAtomic(file, next);
}

export async function readJsonRaw(file: string): Promise<unknown> {
  const text = await readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new DemovieError(
      "E_CONFIG",
      `${file} is not valid JSON: ${(error as Error).message}`,
      `fix the JSON syntax in ${file}`,
    );
  }
}

/** Format zod issues as `path: message` lines. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    .join("; ");
}

/** Read and validate a JSON file; errors name the file, the problem and the fix. */
export async function readJson<T extends z.ZodType>(file: string, schema: T, fix?: string): Promise<z.infer<T>> {
  if (!existsSync(file)) {
    throw new DemovieError("E_NOT_FOUND", `${file} does not exist`, fix ?? "run `npx demovie init` first");
  }
  const raw = await readJsonRaw(file);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new DemovieError(
      "E_CONFIG",
      `${file} is invalid: ${formatIssues(result.error)}`,
      fix ?? `edit ${file} so it matches its JSON Schema`,
    );
  }
  return result.data;
}

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function sha256File(file: string): Promise<string | null> {
  try {
    return sha256(await readFile(file));
  } catch {
    return null;
  }
}

/** Short stable hash for ids and cache keys. */
export function shortHash(data: string | Uint8Array, length = 12): string {
  return sha256(data).slice(0, length);
}

/** True when `child` is inside `parent` (both absolute). Used to prevent path traversal. */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
