import { createInterface } from "node:readline";
import { DemovieError, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

/** Headed browser: the user logs in by hand (OAuth, magic link, 2FA); the storage state is saved (SPEC §9.3). */
export async function run(ctx: CommandContext): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  if (!process.stdin.isTTY && !ctx.yes) {
    throw new DemovieError(
      "E_USAGE",
      "`auth record` needs an interactive terminal and a display",
      "run it on your machine, then commit nothing: the state is saved to .demovie/.auth/ (gitignored)",
    );
  }
  const capture = await import("@demovie/capture");
  const app = await capture.ensureApp(project, { yes: ctx.yes, seed: false });
  const browser = await capture.launchChromium({ headless: false }).catch(async (error: unknown) => {
    if (app.started) await app.stop();
    throw error;
  });
  try {
    const context = await browser.newContext({ viewport: null });
    await capture.routeAppHeaders(context, app.url, project.resolved.app.headers);
    const page = await context.newPage();
    const { loginPath, successPath } = project.resolved.auth;
    await page.goto(capture.appUrl(app.url, loginPath ?? "/"));
    ctx.logger.info(
      `Log in in the browser window. demovie saves the session when you reach ${successPath ?? "the app"} — or press Enter here when done.`,
    );
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const enter = new Promise<void>((resolve) => rl.once("line", () => resolve()));
    const reached = successPath
      ? page.waitForURL((u) => u.pathname.startsWith(successPath), { timeout: 15 * 60_000 }).then(() => undefined)
      : new Promise<void>(() => {});
    await Promise.race([enter, reached]);
    rl.close();
    await capture.saveState(context, project.paths.authState, app.url);
    const cookies = await capture.cookieNames(project.paths.authState);
    return {
      data: { ok: true, statePath: project.paths.authState, cookieNames: cookies },
      human: [
        `saved the login state to .demovie/.auth/state.json`,
        `cookies: ${cookies.join(", ") || "(none)"}`,
        'set "auth.strategy": "storageState" in .demovie/config.json to use it',
      ],
    };
  } finally {
    await browser.close();
    if (app.started) await app.stop();
  }
}
