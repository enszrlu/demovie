import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Route } from "../schemas/project-files.ts";
import { toPosix } from "../util/fs.ts";
import { type AnyNode, exportedConst, literalValue, parseModule, UNKNOWN } from "../util/static-js.ts";
import type { NextjsDetection } from "./framework.ts";

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;
const PAGES_EXT = /\.(tsx|ts|jsx|js|mdx|md)$/;
// Login and account-recovery pages, also prefixed ("employee-login") and the e-mail confirmation steps.
const AUTH_PAGE =
  /(^|\/)([a-z0-9]+-)*(log-?in|sign-?in|sign-?up|register|forgot[-_]?password|reset[-_]?password|verify[-_]?email)(\/|$)|(^|\/)auth\/callback(\/|$)/i;
const PROTECTED_GROUPS = /^\((dashboard|app|protected|authenticated|private|admin|auth|account|main)\)$/i;
const PROTECTED_TOP = /^(app|dashboard|admin|account|settings|console|workspace)$/i;

export interface ProxyInfo {
  file: string;
  /** null = no matcher: proxy runs on every route. */
  matchers: string[] | null;
  /** The file mentions login/auth/session/redirect, i.e. it probably guards routes. */
  guardsAuth: boolean;
}

/** Find and statically read `proxy.ts` (Next 16) or `middleware.ts` (older) in the root or `src/`. */
export function readProxy(appRoot: string): ProxyInfo | null {
  const names = ["proxy", "middleware"];
  for (const name of names) {
    for (const dir of ["src", "."]) {
      for (const ext of [".ts", ".js", ".mjs", ".tsx", ".jsx"]) {
        const file = path.join(appRoot, dir, `${name}${ext}`);
        if (!existsSync(file)) continue;
        const code = readFileSync(file, "utf8");
        const ast = parseModule(code, file);
        let matchers: string[] | null = null;
        if (ast) {
          const config = exportedConst(ast, "config");
          const value = config ? literalValue(config) : UNKNOWN;
          const matcher = value && typeof value === "object" ? (value as Record<string, unknown>).matcher : undefined;
          if (typeof matcher === "string") matchers = [matcher];
          else if (Array.isArray(matcher)) {
            matchers = matcher
              .map((m) =>
                typeof m === "string" ? m : m && typeof m === "object" ? (m as { source?: unknown }).source : null,
              )
              .filter((m): m is string => typeof m === "string");
          }
        }
        return {
          file: toPosix(path.relative(appRoot, file)),
          matchers,
          guardsAuth: /login|signin|sign-in|auth|session|redirect/i.test(code),
        };
      }
    }
  }
  return null;
}

/** A matcher that runs on every ordinary page (an i18n or headers proxy) says nothing about which pages need login. */
function matchesEveryPage(re: RegExp): boolean {
  return ["/", "/about", "/pricing", "/blog/hello", "/x/y/z"].every((p) => re.test(p));
}

/** Convert a Next.js matcher (path-to-regexp syntax) to a RegExp. */
export function matcherToRegExp(pattern: string): RegExp {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === "/" && pattern[i + 1] === ":") {
      i += 2;
      let name = "";
      while (i < pattern.length && /[A-Za-z0-9_]/.test(pattern[i]!)) name += pattern[i++];
      let segment = "[^/]+";
      if (pattern[i] === "(") {
        const end = closingParen(pattern, i);
        segment = pattern.slice(i + 1, end);
        i = end + 1;
      }
      const modifier = pattern[i];
      if (modifier === "*") {
        re += `(?:/${segment})*`;
        i++;
      } else if (modifier === "+") {
        re += `(?:/${segment})+`;
        i++;
      } else if (modifier === "?") {
        re += `(?:/${segment})?`;
        i++;
      } else {
        re += `/${segment}`;
      }
      void name;
    } else if (ch === "(") {
      const end = closingParen(pattern, i);
      re += pattern.slice(i, end + 1);
      i = end + 1;
    } else {
      re += ch.replace(/[.+^${}|[\]\\]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${re}/?$`);
}

function closingParen(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return text.length - 1;
}

/** Sample concrete path for matcher tests: dynamic segments become "x". */
function samplePath(routePath: string): string {
  return routePath
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, "x")
    .replace(/\[\.\.\.[^\]]+\]/g, "x/y")
    .replace(/\[[^\]]+\]/g, "x");
}

function isPrivateSegment(seg: string): boolean {
  return seg.startsWith("_");
}

function isInterceptingSegment(seg: string): boolean {
  return (
    /^\((\.{1,3}|\.\.\)\(\.\.)\)/.test(seg) ||
    seg.startsWith("(.)") ||
    seg.startsWith("(..)") ||
    seg.startsWith("(...)")
  );
}

interface RawRoute {
  path: string;
  file: string;
  segments: string[];
  slot?: string;
  router: "app" | "pages";
}

function walkAppDir(appRoot: string, appDir: string): RawRoute[] {
  const out: RawRoute[] = [];
  const base = path.join(appRoot, appDir);
  const visit = (dir: string, segments: string[], slot: string | undefined) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    const page = entries.find((e) => PAGE_FILE.test(e));
    if (page) {
      const urlSegments = segments.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
      out.push({
        path: `/${urlSegments.join("/")}`,
        file: toPosix(path.relative(appRoot, path.join(dir, page))),
        segments,
        router: "app",
        ...(slot ? { slot } : {}),
      });
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (entry === "node_modules" || isPrivateSegment(entry) || isInterceptingSegment(entry)) continue;
      if (segments.length === 0 && entry === "api") continue;
      if (entry === "api" && segments.every((s) => /^\(.*\)$/.test(s))) continue;
      const nextSlot = entry.startsWith("@") ? entry.slice(1) : slot;
      visit(full, [...segments, entry], nextSlot === "children" ? undefined : nextSlot);
    }
  };
  visit(base, [], undefined);
  return out;
}

function walkPagesDir(appRoot: string, pagesDir: string): RawRoute[] {
  const out: RawRoute[] = [];
  const base = path.join(appRoot, pagesDir);
  const visit = (dir: string, segments: string[]) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (segments.length === 0 && entry === "api") continue;
        if (entry === "node_modules" || entry.startsWith("_")) continue;
        visit(full, [...segments, entry]);
        continue;
      }
      if (!PAGES_EXT.test(entry)) continue;
      const name = entry.replace(PAGES_EXT, "");
      if (segments.length === 0 && /^(_app|_document|_error|404|500)$/.test(name)) continue;
      if (name.startsWith("_")) continue;
      const urlSegments = name === "index" ? segments : [...segments, name];
      out.push({
        path: `/${urlSegments.join("/")}`,
        file: toPosix(path.relative(appRoot, full)),
        segments: urlSegments,
        router: "pages",
      });
    }
  };
  visit(base, []);
  return out;
}

export interface DiscoverOptions {
  params?: Record<string, string[]>;
}

/** Discover page routes from the filesystem (SPEC §8.2). */
export function discoverRoutes(appRoot: string, nextjs: NextjsDetection, options: DiscoverOptions = {}): Route[] {
  const raw = [
    ...(nextjs.appDir ? walkAppDir(appRoot, nextjs.appDir) : []),
    ...(nextjs.pagesDir ? walkPagesDir(appRoot, nextjs.pagesDir) : []),
  ];
  const proxy = readProxy(appRoot);
  const matchers =
    proxy?.matchers?.map((m) => ({ source: m, re: matcherToRegExp(m) })).filter((m) => !matchesEveryPage(m.re)) ?? null;
  const basePath = nextjs.basePath ?? "";
  const seen = new Set<string>();
  const routes: Route[] = [];

  for (const r of raw.sort((a, b) => a.path.localeCompare(b.path) || (a.slot ?? "").localeCompare(b.slot ?? ""))) {
    const key = `${r.path}#${r.slot ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const routePath = r.path === "/" ? "/" : r.path.replace(/\/+$/, "");
    const dynamic = /\[[^\]]+\]/.test(routePath);
    const params = options.params?.[routePath];

    let isProtected: boolean | null = null;
    let reason: string | undefined;
    if (AUTH_PAGE.test(routePath)) {
      isProtected = false;
      reason = "auth page";
    } else if (matchers?.length && proxy?.guardsAuth) {
      const sample = basePath + samplePath(routePath);
      const hit = matchers.find((m) => m.re.test(sample) || m.re.test(samplePath(routePath)));
      isProtected = Boolean(hit);
      reason = hit ? `${proxy.file} matcher ${hit.source}` : `outside ${proxy.file} matcher`;
    } else {
      const hint =
        r.segments.find((s) => PROTECTED_GROUPS.test(s)) ??
        (PROTECTED_TOP.test(r.path.split("/")[1] ?? "") ? r.path.split("/")[1] : undefined);
      if (hint) {
        isProtected = true;
        reason = `folder hint ${hint}`;
      }
    }

    routes.push({
      path: routePath,
      file: r.file,
      dynamic,
      ...(dynamic ? (params?.length ? { params } : { needsParams: true }) : {}),
      protected: isProtected,
      ...(reason ? { protectedReason: reason } : {}),
      source: "fs",
      router: r.router,
      ...(r.slot ? { slot: r.slot } : {}),
    });
  }
  return routes;
}

/** Concrete URL paths for a route: static routes as-is, dynamic routes once per param value. */
export function concretePaths(route: Route): string[] {
  if (!route.dynamic) return [route.path];
  return (route.params ?? []).map((value) => fillParams(route.path, value));
}

/** Fill every dynamic segment of a pattern with one value ("/a/[id]" + "x" → "/a/x"). */
export function fillParams(pattern: string, value: string): string {
  const values = value.split("/").filter(Boolean);
  let index = 0;
  return pattern.replace(/\[\[?(\.\.\.)?[^\]]+\]\]?/g, (_m, spread) => {
    if (spread) return values.slice(index).join("/");
    return values[index++] ?? value;
  });
}

/** Match a concrete path against a route pattern (for crawl results). */
export function routePatternToRegExp(pattern: string): RegExp {
  const re = pattern
    .split("/")
    .map((seg) => {
      if (/^\[\[\.\.\.[^\]]+\]\]$/.test(seg)) return "(?:.*)";
      if (/^\[\.\.\.[^\]]+\]$/.test(seg)) return ".+";
      if (/^\[[^\]]+\]$/.test(seg)) return "[^/]+";
      return seg.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${re.replace(/\/\(\?:\.\*\)$/, "(?:/.*)?")}/?$`);
}

export type { AnyNode };
