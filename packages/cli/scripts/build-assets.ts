/**
 * Post-build step for the `demovie` package:
 *  - generates JSON Schemas from the zod schemas (never hand-written) into schema/
 *  - copies the browser runtime, fallback fonts, SFX, style templates and the Agent Skill into the package
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsonSchemaFor, SCHEMAS, type SchemaName } from "../../core/src/schemas/index.ts";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(pkg, "../..");

const schemaDir = path.join(pkg, "schema");
rmSync(schemaDir, { recursive: true, force: true });
mkdirSync(schemaDir, { recursive: true });
for (const name of Object.keys(SCHEMAS) as SchemaName[]) {
  writeFileSync(path.join(schemaDir, `${name}.schema.json`), `${JSON.stringify(jsonSchemaFor(name), null, 2)}\n`);
}

const copies: [string, string][] = [
  ["packages/runtime/dist/served", "assets/runtime"],
  ["packages/runtime/fonts", "assets/fonts"],
  ["packages/audio/sfx", "assets/sfx"],
  ["packages/skill/templates", "assets/templates"],
  ["packages/skill/demovie", "skill/demovie"],
];
rmSync(path.join(pkg, "assets"), { recursive: true, force: true });
rmSync(path.join(pkg, "skill"), { recursive: true, force: true });
const copied: string[] = [];
for (const [from, to] of copies) {
  const src = path.join(repo, from);
  if (!existsSync(src)) continue;
  cpSync(src, path.join(pkg, to), { recursive: true });
  copied.push(to);
}
for (const file of ["LICENSE"]) cpSync(path.join(repo, file), path.join(pkg, file));
process.stdout.write(`schemas: ${Object.keys(SCHEMAS).length} · assets: ${copied.join(", ") || "none yet"}\n`);
