/**
 * Write the generated reference docs (docs/config.md, docs/qa-rules.md, docs/compositions.md) from the code.
 *
 *   pnpm docs:build
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generatedDocs } from "./lib/docs-gen.ts";
import { repoRoot } from "./lib/repo.ts";

const changed: string[] = [];
for (const [rel, content] of generatedDocs()) {
  const file = path.join(repoRoot, rel);
  if (existsSync(file) && readFileSync(file, "utf8") === content) continue;
  writeFileSync(file, content);
  changed.push(rel);
}
process.stdout.write(`docs: ${changed.length ? `updated ${changed.join(", ")}` : "up to date"}\n`);
