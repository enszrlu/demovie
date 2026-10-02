import path from "node:path";
import { analyzeChanges, loadProject, writeJson } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

/** `demovie changes [--since <ref>]` (SPEC §15.1): commits, changed files, affected routes and suggestions. */
export async function run(ctx: CommandContext, options: { since?: string }): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const changes = await analyzeChanges(project, { since: options.since ?? null });
  const file = path.join(project.paths.cacheDir, "changes.json");
  await writeJson(file, changes);
  const rel = (f: string) => path.relative(ctx.cwd, f);
  const short = (sha: string) => sha.slice(0, 7) || "root";
  const visible = changes.commits.filter((c) => c.userVisible);
  const human = [
    `Changes since ${changes.since} (${short(changes.sinceSha)}..${short(changes.head)}): ${changes.commits.length} commit(s), ${changes.files.length} file(s)`,
    `Story: ${changes.suggestions.story}`,
    ...(visible.length ? ["User-visible commits:"] : []),
    ...visible.map(
      (c) =>
        `  ${c.type ? `${c.type}${c.scope ? `(${c.scope})` : ""}: ` : ""}${c.subject}${c.prs.length ? ` (${c.prs.map((n) => `#${n}`).join(", ")})` : ""}`,
    ),
    changes.routes.length ? "Affected routes:" : "No routes affected.",
    ...changes.routes.map(
      (r) =>
        `  ${r.path.padEnd(24)} ${r.reason === "direct" ? `direct: ${r.via[0]}` : `imports: ${r.via.join(" → ")}`}`,
    ),
    ...(changes.suggestions.flows.length ? [`Flows touching them: ${changes.suggestions.flows.join(", ")}`] : []),
    `→ ${rel(file)}`,
    ...(changes.routes.length
      ? [
          `Next: \`npx demovie capture --changed --since ${changes.since === "(all history)" ? "<ref>" : changes.since}\``,
        ]
      : []),
  ];
  return { data: { ...changes, file: rel(file) }, human };
}
