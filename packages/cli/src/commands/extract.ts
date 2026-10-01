import { DemovieError, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { type ExtractTarget, runExtraction } from "../lib/extract.ts";
import type { CommandResult } from "../output.ts";

const TARGETS = ["brand", "glossary", "routes", "all"] as const;

export async function run(ctx: CommandContext, what: string): Promise<CommandResult> {
  if (!TARGETS.includes(what as ExtractTarget)) {
    throw new DemovieError("E_USAGE", `unknown extract target "${what}"`, `use one of: ${TARGETS.join(", ")}`);
  }
  const project = await loadProject(ctx.cwd);
  const summary = await runExtraction({ project, target: what as ExtractTarget });
  const human: string[] = [];
  if (summary.brand)
    human.push(
      `brand: ${summary.brand.colors} colors · fonts: ${summary.brand.fonts.join(", ") || "none"} · primary ${summary.brand.primary ?? "?"}`,
    );
  if (summary.routes)
    human.push(
      `routes: ${summary.routes.total} (${summary.routes.protected} behind login, ${summary.routes.needsParams} need params)`,
    );
  if (summary.glossary)
    human.push(
      `glossary: ${summary.glossary.terms} terms${summary.glossary.discovered ? ` (+${summary.glossary.discovered} discovered)` : ""}`,
    );
  human.push(
    summary.runtime.reachable
      ? `runtime: ${summary.runtime.pages} pages${summary.runtime.loggedIn ? " (logged in)" : ""}`
      : `runtime: ${summary.runtime.note ?? "skipped"}`,
  );
  return { data: { target: what, ...summary }, human };
}
