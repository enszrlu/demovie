/**
 * Regenerate the bundled SFX set (SPEC §13.2) into packages/audio/sfx: deterministic DSP, CC0.
 * Unchanged files keep their provenance timestamps, so re-running this is a no-op.
 *
 *   pnpm sfx:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeWav, generateSfx, recordProvenance, SFX_INFO, SFX_NAMES } from "../packages/audio/src/index.ts";
import { sha256 } from "../packages/core/src/index.ts";
import { repoRoot } from "./lib/repo.ts";

const dir = path.join(repoRoot, "packages/audio/sfx");
const entries = [];
for (const name of SFX_NAMES) {
  const file = path.join(dir, `${name}.wav`);
  const wav = encodeWav(generateSfx(name));
  let previous: Buffer | null = null;
  try {
    previous = readFileSync(file);
  } catch {
    // new file
  }
  if (!previous?.equals(wav)) writeFileSync(file, wav);
  entries.push({
    file: `${name}.wav`,
    kind: "sfx" as const,
    generator: "demovie-sfx" as const,
    license: "CC0-1.0",
    details: { description: SFX_INFO[name].description, script: "scripts/generate-sfx.ts", sha256: sha256(wav) },
  });
  process.stdout.write(`${name}.wav  ${(wav.length / 1024).toFixed(0)} KB\n`);
}
await recordProvenance(dir, entries);
process.stdout.write(`${SFX_NAMES.length} SFX in ${path.relative(repoRoot, dir)} (CC0-1.0)\n`);
