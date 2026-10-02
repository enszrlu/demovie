import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { type Provenance, type ProvenanceEntry, ProvenanceSchema, writeJson } from "@demovie/core";

export function readProvenance(dir: string): Provenance {
  const file = path.join(dir, "provenance.json");
  return existsSync(file) ? ProvenanceSchema.parse(JSON.parse(readFileSync(file, "utf8"))) : { files: [] };
}

const comparable = (e: Omit<ProvenanceEntry, "createdAt">) =>
  JSON.stringify({
    file: e.file,
    kind: e.kind,
    generator: e.generator,
    license: e.license,
    details: sortKeys(e.details),
  });

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  return value;
}

/**
 * Add or replace the entries for these files in `<dir>/provenance.json` (SPEC §13.4). An unchanged entry (same
 * generator, license and details, which include the file's sha256) keeps its original `createdAt`, so regenerating
 * identical audio leaves the file untouched. `remove` drops entries for files that no longer exist.
 */
export async function recordProvenance(
  dir: string,
  entries: Omit<ProvenanceEntry, "createdAt">[],
  remove: string[] = [],
): Promise<void> {
  const current = readProvenance(dir);
  const before = JSON.stringify(current);
  const now = new Date().toISOString();
  let files = current.files.filter((f) => !remove.includes(f.file));
  for (const entry of entries) {
    const existing = files.find((f) => f.file === entry.file);
    if (existing && comparable(existing) === comparable(entry)) continue;
    files = [...files.filter((f) => f.file !== entry.file), { ...entry, createdAt: now }];
  }
  const next: Provenance = {
    files: files
      .sort((a, b) => a.file.localeCompare(b.file))
      .map((f) => ({
        file: f.file,
        kind: f.kind,
        generator: f.generator,
        license: f.license,
        createdAt: f.createdAt,
        details: f.details,
      })),
  };
  if (JSON.stringify(next) !== before || !existsSync(path.join(dir, "provenance.json")))
    await writeJson(path.join(dir, "provenance.json"), next);
}
