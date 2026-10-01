import { loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(ctx: CommandContext): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { ensureApp } = await import("@demovie/capture");
  const app = await ensureApp(project, { detach: true, yes: ctx.yes });
  const human = app.reused
    ? `app already running at ${app.url} (reused${app.seeded ? ", demo data re-seeded" : ""})`
    : `app running at ${app.url} (pid ${app.pid}${app.seeded ? ", demo data seeded" : ""}); stop it with \`npx demovie down\``;
  return {
    data: {
      url: app.url,
      started: app.started,
      reused: app.reused,
      seeded: app.seeded,
      pid: app.pid,
      log: project.paths.appLog,
    },
    human,
  };
}
