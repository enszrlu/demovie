import { existsSync } from "node:fs";
import path from "node:path";
import { DemovieError, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { syncGlossary } from "../lib/extract.ts";
import type { CommandResult } from "../output.ts";

export async function run(ctx: CommandContext): Promise<CommandResult> {
  const { paths } = await loadProject(ctx.cwd);
  if (!existsSync(paths.glossaryMd)) {
    throw new DemovieError("E_NOT_FOUND", "no .demovie/glossary.md", "run `npx demovie extract glossary` to create it");
  }
  const glossary = await syncGlossary(paths);
  return {
    data: { file: path.relative(ctx.cwd, paths.glossaryJson), glossary },
    human: `glossary.json updated: ${glossary.uiLabels.length} UI labels · ${glossary.features.length} features · ${glossary.entities.length} entities · ${glossary.people.length} people · ${glossary.avoid.length} avoided words`,
  };
}
