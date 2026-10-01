import { logger, type Route, routePatternToRegExp } from "@demovie/core";
import type { BrowserContext } from "playwright-core";
import { type RuntimeSample, sampleRuntime } from "./runtime-extract.ts";

/** Links the crawler must never follow (SPEC §8.2). */
export const LOGOUT_LINK = /log-?out|sign-?out/i;
export const DESTRUCTIVE_LINK = /delete|remove|destroy|cancel/i;
const ASSET_LINK =
  /\.(pdf|zip|gz|png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|json|xml|txt|csv|mp4|webm|mov|mp3|wav|woff2?|ttf|otf)$/i;

/** `http://x/docs` + `/about` → `http://x/docs/about` (keeps any basePath in the app URL). */
export function appUrl(base: string, routePath: string): string {
  return `${base.replace(/\/+$/, "")}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

/** Path relative to the app URL (strips the basePath). */
export function relativePath(base: string, url: string): string {
  const basePath = new URL(base).pathname.replace(/\/+$/, "");
  const p = new URL(url).pathname;
  const rel = basePath && p.startsWith(basePath) ? p.slice(basePath.length) || "/" : p;
  return rel.length > 1 ? rel.replace(/\/+$/, "") : rel;
}

export function shouldFollow(url: string, origin: string): boolean {
  try {
    const u = new URL(url);
    if (u.origin !== origin) return false;
    if (ASSET_LINK.test(u.pathname)) return false;
    const text = `${u.pathname}${u.search}`;
    return !LOGOUT_LINK.test(text) && !DESTRUCTIVE_LINK.test(text);
  } catch {
    return false;
  }
}

export interface CrawlPage {
  path: string;
  title: string;
  h1: string | null;
  depth: number;
  loggedIn: boolean;
}

export interface CrawlOptions {
  baseUrl: string;
  startPaths: string[];
  maxPages: number;
  maxDepth: number;
  loggedIn: boolean;
  /** Paths already visited by an earlier crawl (shared budget). */
  visited?: Set<string>;
  timeoutMs?: number;
}

/** Breadth-first, same-origin crawl that samples each page (brand, UI text, links). */
export async function crawl(
  context: BrowserContext,
  options: CrawlOptions,
): Promise<{ pages: CrawlPage[]; samples: RuntimeSample[] }> {
  const origin = new URL(options.baseUrl).origin;
  const visited = options.visited ?? new Set<string>();
  const queue: { path: string; depth: number }[] = options.startPaths.map((p) => ({ path: p, depth: 0 }));
  const pages: CrawlPage[] = [];
  const samples: RuntimeSample[] = [];
  const page = await context.newPage();
  try {
    while (queue.length > 0 && visited.size < options.maxPages) {
      const next = queue.shift()!;
      if (visited.has(next.path)) continue;
      visited.add(next.path);
      try {
        const response = await page.goto(appUrl(options.baseUrl, next.path), {
          waitUntil: "load",
          timeout: options.timeoutMs ?? 30_000,
        });
        await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
        const finalPath = relativePath(options.baseUrl, page.url());
        if (finalPath !== next.path) visited.add(finalPath);
        if (!response || response.status() >= 400) continue;
        const sample = await sampleRuntime(page);
        samples.push(sample);
        pages.push({
          path: finalPath,
          title: sample.title,
          h1: sample.h1,
          depth: next.depth,
          loggedIn: options.loggedIn,
        });
        if (next.depth >= options.maxDepth) continue;
        for (const link of sample.links) {
          if (!shouldFollow(link, origin)) continue;
          const rel = relativePath(options.baseUrl, link);
          if (!visited.has(rel) && !queue.some((q) => q.path === rel)) queue.push({ path: rel, depth: next.depth + 1 });
        }
      } catch (error) {
        logger.debug(`crawl: ${next.path}: ${(error as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await page.close();
  }
  return { pages, samples };
}

/**
 * Merge crawl results into fs routes: fill params of dynamic routes (first match per pattern), titles,
 * and add pages that no file maps to as `source: "crawl"`.
 */
export function mergeCrawl(routes: Route[], pages: CrawlPage[]): Route[] {
  const out = routes.map((r) => ({ ...r }));
  for (const page of pages) {
    const exact = out.find((r) => !r.dynamic && r.path === page.path);
    if (exact) {
      exact.title ??= page.h1 ?? page.title ?? null;
      continue;
    }
    const dynamic = out.find((r) => r.dynamic && routePatternToRegExp(r.path).test(page.path));
    if (dynamic) {
      if (!dynamic.params?.length) {
        const value = paramValue(dynamic.path, page.path);
        if (value) {
          dynamic.params = [value];
          delete dynamic.needsParams;
          dynamic.title ??= page.h1 ?? page.title ?? null;
        }
      }
      continue;
    }
    out.push({
      path: page.path,
      file: null,
      dynamic: false,
      protected: null,
      source: "crawl",
      title: page.h1 ?? page.title ?? null,
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** The concrete value(s) for a pattern's dynamic segments ("/p/[id]" + "/p/42" → "42"). */
export function paramValue(pattern: string, concrete: string): string | null {
  const pSegs = pattern.split("/");
  const cSegs = concrete.split("/");
  const values: string[] = [];
  for (let i = 0; i < pSegs.length; i++) {
    const seg = pSegs[i]!;
    if (/^\[\[?\.\.\./.test(seg)) {
      values.push(cSegs.slice(i).join("/"));
      break;
    }
    if (/^\[[^\]]+\]$/.test(seg)) values.push(cSegs[i] ?? "");
  }
  return values.filter(Boolean).join("/") || null;
}

/** Confirm protection without a session: a redirect to the login page means protected (SPEC §8.2). */
export async function probeProtection(
  baseUrl: string,
  routePath: string,
  loginPath: string | null,
  headers: Record<string, string> = {},
): Promise<boolean | null> {
  try {
    const res = await fetch(appUrl(baseUrl, routePath), { redirect: "manual", headers });
    await res.body?.cancel().catch(() => {});
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") ?? "";
      const target = new URL(location, baseUrl).pathname;
      return (loginPath !== null && target.startsWith(loginPath)) || /log-?in|sign-?in|auth/i.test(target);
    }
    if (res.status === 401 || res.status === 403) return true;
    if (res.status >= 200 && res.status < 300) return false;
    return null;
  } catch {
    return null;
  }
}
