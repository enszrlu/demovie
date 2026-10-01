import { DemovieError, FORMATS, type FormatId } from "@demovie/core";
import type { Browser, BrowserContext, CDPSession, Page } from "playwright-core";
import type { StaticServer } from "./server.ts";

/**
 * Chromium flags for stable output (SPEC §11.1):
 * - sRGB output and no LCD/subpixel text, so colors and glyph edges don't depend on the display;
 * - software raster (`--disable-gpu`) and no runtime-specific Skia paths, so pixels are reproducible;
 * - all compositor stages run before a frame is drawn, images decode before raster (no checkerboarding);
 * - no background throttling, hidden scrollbars, muted audio.
 */
export const RENDER_CHROMIUM_ARGS = [
  "--force-color-profile=srgb",
  "--disable-lcd-text",
  "--font-render-hinting=none",
  "--disable-font-subpixel-positioning",
  "--disable-gpu",
  "--disable-skia-runtime-opts",
  "--disable-partial-raster",
  "--disable-checker-imaging",
  "--run-all-compositor-stages-before-draw",
  "--disable-threaded-animation",
  "--disable-threaded-scrolling",
  "--disable-image-animation-resync",
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
];

export async function launchRenderer(): Promise<Browser> {
  const { launchChromium } = await import("@demovie/capture");
  return launchChromium({ args: RENDER_CHROMIUM_ARGS });
}

export interface CompositionPage {
  page: Page;
  context: BrowserContext;
  cdp: CDPSession;
  format: FormatId;
  scale: number;
  console: { type: string; text: string }[];
  /** Requests outside the server origin, aborted by the sandbox (DM-A03). */
  blocked: string[];
  /** 4xx/5xx responses and failed requests (DM-A02). */
  failed: { url: string; status: number | null }[];
  close(): Promise<void>;
}

export interface OpenOptions {
  format: FormatId;
  scale: number;
  timeoutMs?: number;
  query?: Record<string, string>;
}

/** Open the composition at a format/scale and wait for `__DEMOVIE__.ready` (SPEC §11.2). */
export async function openComposition(
  browser: Browser,
  server: StaticServer,
  options: OpenOptions,
): Promise<CompositionPage> {
  const size = FORMATS[options.format];
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    // Chromium ignores a device scale factor below 1: render at ≥ 1 and downscale in the screenshot clip.
    deviceScaleFactor: Math.max(1, options.scale),
    colorScheme: "light",
    reducedMotion: "no-preference",
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block",
  });
  const blocked: string[] = [];
  const failed: CompositionPage["failed"] = [];
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(`${server.origin}/`) || url === server.origin) return route.continue();
    blocked.push(url);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  const consoleMessages: { type: string; text: string }[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 500) });
  });
  page.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.message }));
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().startsWith(server.origin))
      failed.push({ url: res.url().replace(server.origin, ""), status: res.status() });
  });
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(server.origin)) failed.push({ url: req.url().replace(server.origin, ""), status: null });
  });
  const params = new URLSearchParams({
    format: options.format,
    scale: String(options.scale),
    ...(options.query ?? {}),
  });
  await page.goto(`${server.origin}/?${params.toString()}`, { waitUntil: "load", timeout: 60_000 });
  const timeout = options.timeoutMs ?? 60_000;
  // Poll from Node: in-page polling (waitForFunction) uses the page's timers, which the virtual clock
  // disables once v.ready() runs, so a poll scheduled just before ready would never fire.
  const deadline = Date.now() + timeout;
  let state = "";
  while (Date.now() < deadline) {
    state = String(
      await page
        .evaluate(
          "window.__DEMOVIE__ ? (window.__DEMOVIE__.error ? 'error' : window.__DEMOVIE__.ready ? 'ready' : 'wait') : 'wait'",
        )
        .catch(() => "wait"),
    );
    if (state !== "wait") break;
    await new Promise((r) => setTimeout(r, 40));
  }
  if (state === "wait") {
    await context.close();
    throw new DemovieError(
      "E_RENDER",
      `the composition did not call v.ready() within ${timeout / 1000}s${consoleMessages.length ? `; console:\n${consoleMessages.map((m) => `  [${m.type}] ${m.text}`).join("\n")}` : ""}`,
      "make sure main.js awaits createVideo(), builds the timeline, then calls v.ready() exactly once",
    );
  }
  const error = (await page.evaluate("window.__DEMOVIE__.error || null")) as string | null;
  if (error) {
    await context.close();
    throw new DemovieError(
      "E_RENDER",
      `composition error: ${error}${consoleMessages.length ? `\nconsole:\n${consoleMessages.map((m) => `  [${m.type}] ${m.text}`).join("\n")}` : ""}`,
      "fix the error in composition/main.js (try `npx demovie preview <slug>` to see it live)",
    );
  }
  const cdp = await context.newCDPSession(page);
  return {
    page,
    context,
    cdp,
    format: options.format,
    scale: options.scale,
    console: consoleMessages,
    blocked,
    failed,
    close: () => context.close(),
  };
}

export async function seek(page: Page, t: number): Promise<void> {
  await page.evaluate(`window.__DEMOVIE__.seek(${JSON.stringify(t)})`);
}

/** Screenshot of the viewport through CDP (SPEC §11.2). */
export async function screenshot(
  cdp: CDPSession,
  type: "png" | "jpeg",
  quality = 92,
  clip?: { width: number; height: number; scale: number },
): Promise<Buffer> {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: type,
    ...(type === "jpeg" ? { quality } : {}),
    ...(clip && clip.scale !== 1
      ? { clip: { x: 0, y: 0, width: clip.width, height: clip.height, scale: clip.scale } }
      : {}),
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: type === "jpeg",
  });
  return Buffer.from(data, "base64");
}

/** Screenshot of a composition page at its requested output scale. */
export function capture(comp: CompositionPage, type: "png" | "jpeg", quality = 92): Promise<Buffer> {
  const size = FORMATS[comp.format];
  return screenshot(comp.cdp, type, quality, {
    width: size.width,
    height: size.height,
    scale: comp.scale / Math.max(1, comp.scale),
  });
}
