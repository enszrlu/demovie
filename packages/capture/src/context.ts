import { type Config, urlPatternToRegExp, type Viewport } from "@demovie/core";
import type { Browser, BrowserContext, Page } from "playwright-core";

export interface ContextOptions {
  config: Config;
  viewport: Viewport;
  colorScheme: "light" | "dark";
  storageState?: string | undefined;
  /** Requests that were blocked (for diagnostics). */
  blocked?: string[];
}

/** CSS injected into every captured page (SPEC §9.4): hide configured selectors, Next.js dev indicators, scrollbars and the caret. */
export function captureCss(hide: string[]): string {
  const hidden = [
    "nextjs-portal",
    "[data-nextjs-toast]",
    "[data-nextjs-dev-tools-button]",
    "#__next-build-watcher",
    ...hide,
  ];
  return `${hidden.join(",\n")} { display: none !important; visibility: hidden !important; }
html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
html, body, * { scrollbar-width: none !important; caret-color: transparent !important; }`;
}

/**
 * Add `app.headers` (e.g. a preview-protection bypass secret) to requests for the app's own origin only. Playwright's
 * `extraHTTPHeaders` would send them to every host the page contacts: fonts, analytics, an identity provider.
 */
export async function routeAppHeaders(
  context: BrowserContext,
  appUrl: string,
  headers: Record<string, string>,
): Promise<void> {
  if (Object.keys(headers).length === 0) return;
  const origin = new URL(appUrl).origin;
  await context.route(
    (url) => url.origin === origin,
    (route) => route.fallback({ headers: { ...route.request().headers(), ...headers } }),
  );
}

/** A Playwright context configured for demo-mode capture (SPEC §9.4). */
export async function createCaptureContext(browser: Browser, options: ContextOptions): Promise<BrowserContext> {
  const { config, viewport } = options;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? viewport.isMobile ?? false,
    colorScheme: options.colorScheme,
    locale: config.demo.locale,
    timezoneId: config.demo.timezone,
    reducedMotion: "reduce",
    ignoreHTTPSErrors: false,
    ...(options.storageState ? { storageState: options.storageState } : {}),
  });
  await routeAppHeaders(context, config.app.url, config.app.headers);
  const block = config.demo.blockRequests.map(urlPatternToRegExp);
  if (block.length > 0) {
    await context.route(
      (url) => block.some((re) => re.test(url.toString())),
      (route) => {
        options.blocked?.push(route.request().url());
        return route.abort("blockedbyclient");
      },
    );
  }
  const css = captureCss(config.demo.hide);
  await context.addInitScript((styles: string) => {
    const install = () => {
      if (document.getElementById("__demovie_capture_css")) return;
      const style = document.createElement("style");
      style.id = "__demovie_capture_css";
      style.textContent = styles;
      (document.head ?? document.documentElement).appendChild(style);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  }, css);
  return context;
}

/** Freeze `Date` at `demo.now` while timers keep running (SPEC §9.2). Call before the first navigation. */
export async function freezeClock(page: Page, now: string | null): Promise<void> {
  if (!now) return;
  await page.clock.setFixedTime(new Date(now));
}
