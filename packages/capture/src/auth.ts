import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DemovieError, ensureDir, logger, type Project } from "@demovie/core";
import { build } from "esbuild";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { createCaptureContext, freezeClock } from "./context.ts";

export interface AuthOutcome {
  ok: boolean;
  strategy: Project["config"]["auth"]["strategy"];
  landingUrl: string | null;
  cookieNames: string[];
  statePath: string | null;
  reused: boolean;
}

export function credentials(project: Project): { username: string; password: string } {
  const { usernameEnv, passwordEnv } = project.resolved.auth;
  const username = project.env[usernameEnv];
  const password = project.env[passwordEnv];
  if (!username || !password) {
    throw new DemovieError(
      "E_AUTH",
      `login credentials are missing: set ${usernameEnv} and ${passwordEnv}`,
      `add ${usernameEnv}=<test user> and ${passwordEnv}=<password> to ${path.relative(process.cwd(), project.paths.env) || ".demovie/.env"} (gitignored), or export them in your shell/CI`,
    );
  }
  logger.addSecret(password);
  return { username, password };
}

const USERNAME_SELECTORS = [
  'input[type="email"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
  'input[name*="email" i]',
  'input[name*="user" i]',
  'input[name*="login" i]',
  'input[id*="email" i]',
  'input[id*="user" i]',
];

async function firstVisible(page: Page, selectors: string[]): Promise<ReturnType<Page["locator"]> | null> {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  return null;
}

function isLoginUrl(url: string, loginPath: string | null): boolean {
  const p = new URL(url).pathname;
  return (
    (loginPath !== null && (p === loginPath || p.startsWith(`${loginPath}/`))) || /\/(log-?in|sign-?in)(\/|$)/i.test(p)
  );
}

/** The `form` strategy (SPEC §9.3): detect inputs, fill from env, submit, wait to leave the login page. */
export async function loginWithForm(page: Page, project: Project, baseUrl: string): Promise<string> {
  const { loginPath, successPath } = project.resolved.auth;
  const { username, password } = credentials(project);
  const loginUrl = new URL(loginPath ?? "/login", baseUrl).toString();
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  const user = (await firstVisible(page, USERNAME_SELECTORS)) ?? page.getByLabel(/email|user(name)?|login/i).first();
  const pass = page.locator('input[type="password"]').first();
  if ((await pass.count()) === 0) {
    throw new DemovieError(
      "E_AUTH",
      `no password field found on ${loginUrl}`,
      'set "auth.loginPath" in .demovie/config.json to your login page, or use "auth.strategy": "storageState" with `npx demovie auth record`',
    );
  }
  await user.fill(username);
  await pass.fill(password);
  const submit = page.locator('form button[type="submit"], form input[type="submit"]').first();
  const navigation = page.waitForURL(
    (url) => !isLoginUrl(url.toString(), loginPath) || (successPath !== null && url.pathname.startsWith(successPath)),
    {
      timeout: 20_000,
    },
  );
  if ((await submit.count()) > 0) await submit.click();
  else await pass.press("Enter");
  try {
    await navigation;
  } catch {
    const message = (
      await page
        .locator('[role="alert"], .error, [data-error]')
        .first()
        .textContent()
        .catch(() => null)
    )?.trim();
    throw new DemovieError(
      "E_AUTH",
      `login failed: still on ${new URL(page.url()).pathname} after submitting${message ? ` ("${message}")` : ""}`,
      `check ${project.resolved.auth.usernameEnv}/${project.resolved.auth.passwordEnv} in .demovie/.env, or run \`npx demovie auth record\``,
    );
  }
  if (successPath)
    await page.waitForURL((url) => url.pathname.startsWith(successPath), { timeout: 15_000 }).catch(() => {});
  return page.url();
}

/** The `script` strategy: `.demovie/auth.ts` default-exports `async ({ page, baseURL, env }) => void`. */
export async function runAuthScript(page: Page, project: Project, baseUrl: string): Promise<void> {
  const scriptRel = project.resolved.auth.script ?? ".demovie/auth.ts";
  const script = path.resolve(project.paths.root, scriptRel);
  if (!existsSync(script)) {
    throw new DemovieError(
      "E_AUTH",
      `auth script ${scriptRel} not found`,
      `create ${scriptRel} exporting \`export default async ({ page, baseURL, env }) => { … }\``,
    );
  }
  await ensureDir(project.paths.cacheDir);
  const out = path.join(project.paths.cacheDir, "auth-script.mjs");
  await build({
    entryPoints: [script],
    outfile: out,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    logLevel: "silent",
  });
  const mod = (await import(`${pathToFileURL(out).href}?t=${Date.now()}`)) as {
    default?: (args: unknown) => Promise<void>;
  };
  if (typeof mod.default !== "function") {
    throw new DemovieError(
      "E_AUTH",
      `${scriptRel} has no default export`,
      "export a default async function ({ page, baseURL, env }) => {…}",
    );
  }
  await mod.default({ page, baseURL: baseUrl, env: project.env });
}

/**
 * Make sure a storage state with a logged-in session exists and return its path (undefined for `none`).
 * The state is reused until it fails (`force` re-authenticates).
 */
export async function ensureAuth(
  browser: Browser,
  project: Project,
  baseUrl: string,
  options: { force?: boolean } = {},
): Promise<AuthOutcome> {
  const strategy = project.resolved.auth.strategy;
  const statePath = project.paths.authState;
  if (strategy === "none")
    return { ok: true, strategy, landingUrl: null, cookieNames: [], statePath: null, reused: false };
  if (strategy === "storageState") {
    if (!existsSync(statePath)) {
      throw new DemovieError(
        "E_AUTH",
        "no recorded login state (.demovie/.auth/state.json)",
        "run `npx demovie auth record` and log in in the browser window",
      );
    }
    return { ok: true, strategy, landingUrl: null, cookieNames: await cookieNames(statePath), statePath, reused: true };
  }
  if (!options.force && existsSync(statePath)) {
    return { ok: true, strategy, landingUrl: null, cookieNames: await cookieNames(statePath), statePath, reused: true };
  }
  const context = await createCaptureContext(browser, {
    config: project.resolved,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
    colorScheme: "light",
  });
  try {
    const page = await context.newPage();
    await freezeClock(page, project.resolved.demo.now);
    let landing: string;
    if (strategy === "form") landing = await loginWithForm(page, project, baseUrl);
    else {
      await runAuthScript(page, project, baseUrl);
      landing = page.url();
    }
    await saveState(context, statePath, baseUrl);
    return {
      ok: true,
      strategy,
      landingUrl: landing,
      cookieNames: await cookieNames(statePath),
      statePath,
      reused: false,
    };
  } finally {
    await context.close();
  }
}

/** The site of a host: its last two labels (`app.example.com` → `example.com`), or the host itself (localhost, IPs). */
function siteOf(host: string): string {
  if (/^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".")) return host;
  return host.split(".").slice(-2).join(".");
}

/** Whether a cookie domain or origin host belongs to the app's site (its host, a parent or a sibling subdomain). */
export function sameSite(host: string, appHost: string): boolean {
  const h = host.replace(/^\./, "").toLowerCase();
  const app = appHost.toLowerCase();
  const site = siteOf(app);
  return h === app || app.endsWith(`.${h}`) || h === site || h.endsWith(`.${site}`);
}

/**
 * Save the logged-in session. With `appUrl`, only the app's own cookies and storage are kept: a manual login through an
 * identity provider (Google, GitHub…) must not leave the user's real IdP session in .demovie/.auth or in captures.
 */
export async function saveState(context: BrowserContext, statePath: string, appUrl?: string): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const state = await context.storageState();
  if (appUrl) {
    const appHost = new URL(appUrl).hostname;
    const dropped = state.cookies.filter((c) => !sameSite(c.domain, appHost)).length;
    state.cookies = state.cookies.filter((c) => sameSite(c.domain, appHost));
    state.origins = state.origins.filter((o) => sameSite(new URL(o.origin).hostname, appHost));
    if (dropped) logger.info(`kept the app's cookies only (${dropped} from other sites not saved)`);
  }
  await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
}

/** Cookie names only — values are never printed (SPEC §9.3, §17). */
export async function cookieNames(statePath: string): Promise<string[]> {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as { cookies?: { name: string }[] };
    return [...new Set((state.cookies ?? []).map((c) => c.name))].sort();
  } catch {
    return [];
  }
}

export { isLoginUrl };
