import { DemovieError, loadProject } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export async function run(ctx: CommandContext): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const capture = await import("@demovie/capture");
  if (project.resolved.auth.strategy === "none") {
    return {
      data: { ok: true, strategy: "none", landingUrl: null, cookieNames: [] },
      human: "auth strategy is none: no login needed",
    };
  }
  const app = await capture.ensureApp(project, { yes: ctx.yes, seed: false });
  const browser = await capture.launchChromium().catch(async (error: unknown) => {
    if (app.started) await app.stop();
    throw error;
  });
  try {
    const outcome = await capture.ensureAuth(browser, project, app.url, {
      force: project.resolved.auth.strategy !== "storageState",
    });
    // Prove the session works: open the success path (or the first protected route) with the saved state.
    const context = await capture.createCaptureContext(browser, {
      config: project.resolved,
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
      colorScheme: "light",
      storageState: outcome.statePath ?? undefined,
    });
    const page = await context.newPage();
    const target = project.resolved.auth.successPath ?? "/";
    await page.goto(capture.appUrl(app.url, target), { waitUntil: "load" });
    const landing = page.url();
    await context.close();
    if (capture.isLoginUrl(landing, project.resolved.auth.loginPath)) {
      throw new DemovieError(
        "E_AUTH",
        `the saved session doesn't work: ${target} redirects to ${new URL(landing).pathname}`,
        "run `npx demovie auth record`, or check the credentials in .demovie/.env",
      );
    }
    return {
      data: { ok: true, strategy: outcome.strategy, landingUrl: landing, cookieNames: outcome.cookieNames },
      human: [
        `login works (${outcome.strategy})`,
        `landing: ${landing}`,
        `cookies: ${outcome.cookieNames.join(", ") || "(none)"}`,
      ],
    };
  } finally {
    await browser.close();
    if (app.started) await app.stop();
  }
}
