import { existsSync } from "node:fs";
import path from "node:path";
import { DemovieError, ensureDir, loadProject, writeFileAtomic } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(
  ctx: CommandContext,
  name: string,
  options: { start?: string; ts?: boolean },
): Promise<CommandResult> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new DemovieError(
      "E_USAGE",
      `flow name "${name}" must be lowercase letters, digits and dashes`,
      "e.g. `npx demovie flow new create-project`",
    );
  const project = await loadProject(ctx.cwd);
  const { FLOW_TS_TEMPLATE, FLOW_YAML_TEMPLATE, loadRoutes } = await import("@demovie/capture");
  const routes = await loadRoutes(project).catch(() => []);
  const start =
    options.start ?? project.resolved.auth.successPath ?? routes.find((r) => r.protected && !r.dynamic)?.path ?? "/";
  const file = path.join(project.paths.flowsDir, `${name}.flow.${options.ts ? "ts" : "yaml"}`);
  if (existsSync(file))
    throw new DemovieError(
      "E_USAGE",
      `${path.relative(ctx.cwd, file)} already exists`,
      "edit it, or pick another name",
    );
  await ensureDir(project.paths.flowsDir);
  await writeFileAtomic(file, options.ts ? FLOW_TS_TEMPLATE(name, start) : FLOW_YAML_TEMPLATE(name, start));
  return {
    data: { file: path.relative(ctx.cwd, file), name, start },
    human: [`wrote ${path.relative(ctx.cwd, file)}`, `Next: edit its steps, then \`npx demovie flow run ${name}\``],
  };
}
