import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type CaptureMeta,
  type Config,
  type ElementMap,
  ElementMapSchema,
  matchesGlob,
  simpleGlobToRegExp,
  stableJson,
} from "@demovie/core";
import type { Page } from "playwright-core";
import { DECODE_SCRIPT, ELEMENT_MAP_SCRIPT, STABILITY_SCRIPT } from "./element-map.ts";
import { REDACT_SCRIPT, type RedactArgs, type RedactionPattern, redactText, serializePatterns } from "./redact.ts";

const MAX_FULL_PAGE = 10_000;

/** How much taller the biggest inner scroller (overflow-y auto/scroll, at least half the viewport) is than its box. */
export const INNER_SCROLL_SCRIPT = `() => {
  let extra = 0;
  for (const el of document.querySelectorAll("body *")) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    if (el.clientHeight < innerHeight * 0.5) continue;
    extra = Math.max(extra, el.scrollHeight - el.clientHeight);
  }
  return Math.round(extra);
}`;

/** Tracks in-flight requests so we can wait for 500 ms of network quiet (capped). */
export function trackNetwork(page: Page): {
  idle: (quietMs?: number, capMs?: number) => Promise<boolean>;
  dispose: () => void;
} {
  let inflight = 0;
  let last = Date.now();
  const onStart = () => {
    inflight++;
    last = Date.now();
  };
  const onEnd = () => {
    inflight = Math.max(0, inflight - 1);
    last = Date.now();
  };
  page.on("request", onStart);
  page.on("requestfinished", onEnd);
  page.on("requestfailed", onEnd);
  return {
    idle: async (quietMs = 500, capMs = 10_000) => {
      const start = Date.now();
      while (Date.now() - start < capMs) {
        if (inflight <= 0 && Date.now() - last >= quietMs) return true;
        await new Promise((r) => setTimeout(r, 50));
      }
      return false;
    },
    dispose: () => {
      page.off("request", onStart);
      page.off("requestfinished", onEnd);
      page.off("requestfailed", onEnd);
    },
  };
}

export function redactArgs(config: Config): RedactArgs {
  const mask = config.demo.mask;
  return {
    patterns: mask.enabled ? serializePatterns(mask.patterns as RedactionPattern[]) : [],
    allow: mask.allow.map((g) => simpleGlobToRegExp(g).source),
    mode: mask.replacement,
    selectors: mask.selectors,
  };
}

/** The `waitFor` selector configured for a route path (exact key or glob). */
export function waitForSelector(config: Config, routePath: string): string | null {
  const entries = Object.entries(config.capture.waitFor);
  return entries.find(([k]) => k === routePath)?.[1] ?? entries.find(([k]) => matchesGlob(routePath, k))?.[1] ?? null;
}

export interface SettleResult {
  warnings: string[];
}

/** SPEC §9.5 step 2: load, network idle (500 ms quiet, 10 s cap), fonts, waitFor, images decoded, layout stable (3 s cap). */
export async function settle(
  page: Page,
  network: ReturnType<typeof trackNetwork>,
  selector: string | null,
): Promise<SettleResult> {
  const warnings: string[] = [];
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => warnings.push("load event timed out"));
  if (!(await network.idle(500, 10_000))) warnings.push("network not idle after 10s");
  if (selector) {
    await page
      .waitForSelector(selector, { state: "visible", timeout: 15_000 })
      .catch(() => warnings.push(`waitFor selector ${selector} not visible after 15s`));
  }
  const decoded = await page.evaluate(`(${DECODE_SCRIPT})()`).catch(() => false);
  if (!decoded) warnings.push("fonts/images did not settle after 10s");
  const started = Date.now();
  let stable = false;
  while (Date.now() - started < 3000) {
    stable = Boolean(await page.evaluate(`(${STABILITY_SCRIPT})()`).catch(() => false));
    if (stable) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!stable) warnings.push("layout still moving after 3s");
  return { warnings };
}

export interface StateCapture {
  id: string;
  screen: Buffer;
  full: Buffer | null;
  fullSize: { width: number; height: number } | null;
  elements: ElementMap;
  meta: CaptureMeta;
}

export interface CaptureStateOptions {
  id: string;
  kind: "route" | "flow";
  config: Config;
  viewportName: string;
  colorScheme: "light" | "dark";
  route: string | null;
  flow: string | null;
  step: string | null;
  fullPage: boolean;
  gitSha: string | null;
  baseUrl: string;
  warnings?: string[];
  /** Skip settle(): the caller already waited (flows). */
  settled?: boolean;
  network?: ReturnType<typeof trackNetwork>;
}

/** SPEC §9.5 steps 3–5 for the page as it is now: redact, screenshot, element map, meta. */
export async function snapshotState(page: Page, options: CaptureStateOptions): Promise<StateCapture> {
  const warnings = [...(options.warnings ?? [])];
  if (!options.settled && options.network) {
    const settled = await settle(
      page,
      options.network,
      options.route ? waitForSelector(options.config, options.route) : null,
    );
    warnings.push(...settled.warnings);
  }
  await page.evaluate("window.scrollTo(0, 0)");
  const redactions = (await page.evaluate(
    `(${REDACT_SCRIPT})(${JSON.stringify(redactArgs(options.config))})`,
  )) as Record<string, number>;
  const screen = await page.screenshot({ animations: "disabled", caret: "hide", scale: "device", type: "png" });
  let full: Buffer | null = null;
  let fullSize: { width: number; height: number } | null = null;
  if (options.fullPage) {
    const size = (await page.evaluate(
      "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
    )) as {
      width: number;
      height: number;
    };
    const viewport = page.viewportSize();
    // An app shell (fixed nav, a scrolling <main>) never scrolls the document: grow the viewport by the inner
    // scroller's overflow for the full-page shot, so its content is laid out on one tall page, then restore it.
    const extra =
      viewport && size.height <= viewport.height + 1
        ? ((await page.evaluate(`(${INNER_SCROLL_SCRIPT})()`).catch(() => 0)) as number)
        : 0;
    if (viewport && extra > 0) {
      const height = Math.min(viewport.height + extra, MAX_FULL_PAGE);
      if (viewport.height + extra > MAX_FULL_PAGE)
        warnings.push(`full page clipped to ${MAX_FULL_PAGE}px (page is ${viewport.height + extra}px)`);
      await page.setViewportSize({ width: viewport.width, height });
      await page.waitForTimeout(300);
      full = await page.screenshot({ animations: "disabled", caret: "hide", scale: "device", type: "png" });
      fullSize = { width: viewport.width, height };
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
    } else {
      const height = Math.min(size.height, MAX_FULL_PAGE);
      if (size.height > MAX_FULL_PAGE)
        warnings.push(`full page clipped to ${MAX_FULL_PAGE}px (page is ${size.height}px)`);
      full = await page.screenshot({
        animations: "disabled",
        caret: "hide",
        scale: "device",
        type: "png",
        fullPage: true,
        clip: { x: 0, y: 0, width: size.width, height },
      });
      fullSize = { width: size.width, height };
    }
  }
  const raw = (await page.evaluate(`(${ELEMENT_MAP_SCRIPT})()`)) as Omit<ElementMap, "captureId" | "url">;
  // The URL can't be redacted in the page (that would navigate): redact it here, with the same patterns.
  const mask = options.config.demo.mask;
  const url = mask.enabled
    ? redactText(page.url(), {
        patterns: mask.patterns as RedactionPattern[],
        allow: mask.allow.map((g) => simpleGlobToRegExp(g)),
        mode: mask.replacement,
      })
    : page.url();
  const elements = ElementMapSchema.parse({ captureId: options.id, url, ...raw });
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const dpr = elements.viewport.deviceScaleFactor;
  const title = (await page.title().catch(() => "")) || null;
  const urlPath = new URL(url).pathname;
  const meta: CaptureMeta = {
    id: options.id,
    kind: options.kind,
    url,
    path: urlPath,
    route: options.route,
    flow: options.flow,
    step: options.step,
    title,
    viewport: {
      name: options.viewportName,
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: dpr,
      isMobile: Boolean(options.config.capture.viewports[options.viewportName]?.isMobile),
    },
    dpr,
    colorScheme: options.colorScheme,
    capturedAt: new Date().toISOString(),
    gitSha: options.gitSha,
    redactions,
    warnings,
    fullPage: fullSize,
    image: { width: Math.round(viewport.width * dpr), height: Math.round(viewport.height * dpr) },
  };
  return { id: options.id, screen, full, fullSize, elements, meta };
}

/** Write a state atomically: temp dir, then rename over the old one (SPEC §9.5). */
export async function writeState(capturesDir: string, state: StateCapture): Promise<string> {
  const finalDir = path.join(capturesDir, state.id);
  const tmpDir = path.join(path.dirname(finalDir), `.tmp-${path.basename(finalDir)}-${randomBytes(4).toString("hex")}`);
  await mkdir(tmpDir, { recursive: true });
  await writeFile(path.join(tmpDir, "screen.png"), state.screen);
  if (state.full) await writeFile(path.join(tmpDir, "full.png"), state.full);
  await writeFile(path.join(tmpDir, "elements.json"), stableJson(state.elements));
  await writeFile(path.join(tmpDir, "meta.json"), stableJson(state.meta));
  await rm(finalDir, { recursive: true, force: true });
  await rename(tmpDir, finalDir);
  return finalDir;
}
