import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeChanges,
  appendDiscovered,
  type CaptureIndexEntry,
  configHash,
  DemovieError,
  detectProject,
  discoverRoutes,
  type ElementMap,
  fillParams,
  logger,
  matchesAny,
  type Project,
  parseGlossaryMd,
  type Route,
  type Routes,
  RoutesSchema,
  readJson,
  routeSlug,
  toPosix,
  writeFileAtomic,
  writeJson,
} from "@demovie/core";
import type { Browser, BrowserContext } from "playwright-core";
import { ensureAuth, isLoginUrl } from "./auth.ts";
import { launchChromium } from "./browser.ts";
import {
  type StateCapture,
  settle,
  snapshotState,
  trackNetwork,
  waitForSelector,
  writeState,
} from "./capture-state.ts";
import { createCaptureContext, freezeClock } from "./context.ts";
import { appUrl, probeProtection } from "./crawl.ts";
import { listFlows, loadTsFlow, parseFlowYaml, runFlow, type TsFlowDefinition } from "./flows.ts";
import { captureFreshness, gitHead, hashFiles, layoutChain, updateCaptureIndex } from "./freshness.ts";
import { type AppHandle, ensureApp } from "./lifecycle.ts";

export interface CaptureRequest {
  routes?: string[] | undefined;
  flows?: string[] | undefined;
  viewports?: string[] | undefined;
  dark?: boolean | undefined;
  fullPage?: boolean | undefined;
  changed?: boolean | undefined;
  since?: string | undefined;
  /** Only flows, no routes (`flow run`). */
  flowsOnly?: boolean | undefined;
  yes?: boolean | undefined;
}

export interface CapturedState {
  id: string;
  kind: "route" | "flow";
  path: string;
  viewport: string;
  colorScheme: "light" | "dark";
  dir: string;
  warnings: string[];
  redactions: Record<string, number>;
  elements: number;
  ms: number;
}

export interface CaptureReport {
  states: CapturedState[];
  flows: { name: string; viewport: string; states: string[]; steps: number }[];
  skipped: { what: string; reason: string }[];
  app: { url: string; started: boolean; reused: boolean; seeded: boolean };
  glossaryAdded: string[];
  durationMs: number;
}

interface RouteJob {
  route: Route;
  path: string;
  viewport: string;
  scheme: "light" | "dark";
  authed: boolean;
  fullPage: boolean;
}

/** Routes from routes.json (or discovered from the filesystem when it doesn't exist yet). */
export async function loadRoutes(project: Project): Promise<Route[]> {
  if (existsSync(project.paths.routes)) return (await readJson(project.paths.routes, RoutesSchema)).routes;
  const d = detectProject(project.paths.root, { framework: project.resolved.project.framework });
  if (d.nextjs) return discoverRoutes(project.paths.root, d.nextjs, { params: project.resolved.capture.routes.params });
  throw new DemovieError(
    "E_NOT_FOUND",
    "no .demovie/routes.json",
    "run `npx demovie extract routes` (generic mode crawls the running app)",
  );
}

function schemes(project: Project, dark: boolean | undefined): ("light" | "dark")[] {
  const s = project.resolved.demo.colorScheme;
  const list: ("light" | "dark")[] = s === "both" ? ["light", "dark"] : [s];
  if (dark && !list.includes("dark")) list.push("dark");
  return list;
}

export async function runCapture(project: Project, request: CaptureRequest): Promise<CaptureReport> {
  const started = Date.now();
  const config = project.resolved;
  const report: CaptureReport = {
    states: [],
    flows: [],
    skipped: [],
    app: { url: config.app.url, started: false, reused: false, seeded: false },
    glossaryAdded: [],
    durationMs: 0,
  };
  const viewports = request.viewports?.length ? request.viewports : config.capture.defaultViewports;
  for (const v of viewports) {
    if (!config.capture.viewports[v]) {
      throw new DemovieError(
        "E_USAGE",
        `unknown viewport "${v}"`,
        `use one of: ${Object.keys(config.capture.viewports).join(", ")} (or add it to capture.viewports)`,
      );
    }
  }
  const allRoutes = await loadRoutes(project);
  // `--route` without `--flow` captures only those routes; flows run when asked for, or when nothing was narrowed.
  const routesOnly = Boolean(request.routes?.length) && !request.flows?.length;
  const flowFiles = routesOnly
    ? []
    : listFlows(project).filter((f) => !request.flows?.length || request.flows.includes(f.name));
  if (request.flows?.length) {
    const missing = request.flows.filter((n) => !flowFiles.some((f) => f.name === n));
    if (missing.length)
      throw new DemovieError(
        "E_NOT_FOUND",
        `flow(s) not found: ${missing.join(", ")}`,
        `create them with \`npx demovie flow new ${missing[0]}\``,
      );
  }

  // Which route states?
  const jobs: RouteJob[] = [];
  const onlyFlows = request.flowsOnly || (request.flows?.length && !request.routes?.length);
  if (!onlyFlows) {
    const include = request.routes?.length ? request.routes : config.capture.routes.include;
    for (const route of allRoutes) {
      if (!matchesAny(route.path, include) || matchesAny(route.path, config.capture.routes.exclude)) continue;
      if (route.slot) continue; // parallel slots render inside their parent route's URL
      const concrete = route.dynamic
        ? (config.capture.routes.params[route.path] ?? route.params ?? []).map((p) => fillParams(route.path, p))
        : [route.path];
      if (concrete.length === 0) {
        report.skipped.push({
          what: route.path,
          reason: `dynamic route without params: add "capture.routes.params": { "${route.path}": ["<value>"] } to .demovie/config.json`,
        });
        continue;
      }
      for (const p of concrete) {
        for (const viewport of viewports) {
          for (const scheme of schemes(project, request.dark)) {
            jobs.push({
              route,
              path: p,
              viewport,
              scheme,
              authed: route.protected !== false && config.auth.strategy !== "none",
              fullPage:
                Boolean(request.fullPage) ||
                matchesAny(p, config.capture.fullPage) ||
                config.capture.fullPage.includes(route.path),
            });
          }
        }
      }
    }
  }

  // --changed: keep only stale or affected states.
  let flowsToRun = flowFiles;
  if (request.changed) {
    const fresh = await captureFreshness(project);
    const staleIds = new Set(fresh.stale.map((s) => s.id));
    const known = new Set(
      (await import("./freshness.ts").then((m) => m.readCaptureIndex(project)))?.states.map((s) => s.id) ?? [],
    );
    // with --since: routes reached from the changed files directly or through the import graph (SPEC §15.1)
    const analysis = request.since
      ? await analyzeChanges(project, { since: request.since, gh: false, workingTree: true })
      : null;
    const changed = new Set(analysis?.files.map((f) => f.path) ?? []);
    const affectedPaths = new Set(analysis?.routes.map((r) => r.path) ?? []);
    const affectedFlows = new Set(analysis?.suggestions.flows ?? []);
    const affected = (route: Route) => affectedPaths.has(route.path);
    const idOf = (j: RouteJob) => `routes/${routeSlug(j.path)}@${j.viewport}${j.scheme === "dark" ? ".dark" : ""}`;
    const kept = jobs.filter((j) => staleIds.has(idOf(j)) || !known.has(idOf(j)) || affected(j.route));
    for (const j of jobs) if (!kept.includes(j)) report.skipped.push({ what: idOf(j), reason: "fresh" });
    jobs.splice(0, jobs.length, ...kept);
    flowsToRun = flowFiles.filter((f) => {
      const ids = [...known].filter((id) => id.startsWith(`flows/${f.name}@`));
      const stale =
        ids.length === 0 ||
        ids.some((id) => staleIds.has(id)) ||
        affectedFlows.has(f.name) ||
        changed.has(toPosix(path.relative(project.paths.root, f.file)));
      if (!stale) report.skipped.push({ what: `flow ${f.name}`, reason: "fresh" });
      return stale;
    });
  }
  if (jobs.length === 0 && flowsToRun.length === 0) {
    report.durationMs = Date.now() - started;
    return report;
  }

  // App up (seed → start → wait), browser, auth.
  const app: AppHandle = await ensureApp(project, { yes: request.yes });
  report.app = { url: app.url, started: app.started, reused: app.reused, seeded: app.seeded };
  // --lang makes locale-dependent widgets (date inputs, number formats in the UI chrome) follow demo.locale.
  const browser = await launchChromium({ args: [`--lang=${config.demo.locale}`] });
  const gitSha = await gitHead(project.paths.root);
  const cHash = configHash(project.config);
  const indexEntries: CaptureIndexEntry[] = [];
  const glossaryLabels: string[] = [];
  const titles = new Map<string, string>();
  const protectionUpdates = new Map<string, boolean>();
  const routerRoot = config.project.nextjs?.appDir ?? config.project.nextjs?.pagesDir ?? null;
  try {
    const needsAuth = config.auth.strategy !== "none" && (jobs.some((j) => j.authed) || flowsToRun.length > 0);
    let statePath: string | undefined;
    if (needsAuth) statePath = (await ensureAuth(browser, project, app.url)).statePath ?? undefined;
    const contexts = new Map<string, BrowserContext>();
    const contextFor = async (viewport: string, scheme: "light" | "dark", authed: boolean, fresh = false) => {
      const key = `${viewport}|${scheme}|${authed}`;
      if (fresh && contexts.has(key)) {
        await contexts.get(key)!.close();
        contexts.delete(key);
      }
      if (!contexts.has(key)) {
        contexts.set(
          key,
          await createCaptureContext(browser, {
            config,
            viewport: config.capture.viewports[viewport]!,
            colorScheme: scheme,
            storageState: authed ? statePath : undefined,
          }),
        );
      }
      return contexts.get(key)!;
    };

    // Route states, `capture.concurrency` at a time.
    const queue = [...jobs];
    const worker = async () => {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        const t0 = Date.now();
        const id = `routes/${routeSlug(job.path)}@${job.viewport}${job.scheme === "dark" ? ".dark" : ""}`;
        let state: StateCapture | null = null;
        for (let attempt = 0; attempt < 2 && !state; attempt++) {
          const context = await contextFor(job.viewport, job.scheme, job.authed);
          const page = await context.newPage();
          const network = trackNetwork(page);
          try {
            await freezeClock(page, config.demo.now);
            const response = await page.goto(appUrl(app.url, job.path), { waitUntil: "load", timeout: 60_000 });
            const landed = new URL(page.url()).pathname;
            if (
              isLoginUrl(page.url(), config.auth.loginPath) &&
              !isLoginUrl(appUrl(app.url, job.path), config.auth.loginPath)
            ) {
              if (!job.authed && config.auth.strategy !== "none") {
                // Public guess was wrong: the route is protected (SPEC §8.2, confirmed at capture time).
                protectionUpdates.set(job.route.path, true);
                job.authed = true;
                continue;
              }
              if (attempt === 0 && config.auth.strategy !== "none") {
                statePath = (await ensureAuth(browser, project, app.url, { force: true })).statePath ?? undefined;
                await contextFor(job.viewport, job.scheme, true, true);
                continue;
              }
              throw new DemovieError(
                "E_AUTH",
                `${job.path} redirects to ${landed} even after logging in`,
                "run `npx demovie auth test`, or check auth.successPath and the test user's permissions",
              );
            }
            if (response && response.status() >= 400) {
              throw new DemovieError(
                "E_CAPTURE",
                `${job.path} answered HTTP ${response.status()}`,
                "check the route and its params in .demovie/routes.json / config.capture.routes.params",
              );
            }
            const settled = await settle(page, network, waitForSelector(config, job.route.path));
            state = await snapshotState(page, {
              id,
              kind: "route",
              config,
              viewportName: job.viewport,
              colorScheme: job.scheme,
              route: job.route.path,
              flow: null,
              step: null,
              fullPage: job.fullPage,
              gitSha,
              baseUrl: app.url,
              warnings: settled.warnings,
              settled: true,
            });
          } finally {
            network.dispose();
            await page.close();
          }
        }
        if (!state) throw new DemovieError("E_CAPTURE", `could not capture ${job.path}`, "re-run with --verbose");
        const dir = await writeState(project.paths.capturesDir, state);
        collectLabels(state.elements, glossaryLabels);
        const h1 = state.elements.elements.find((e) => e.role === "heading" && e.level === 1)?.name;
        if (!titles.has(job.route.path)) titles.set(job.route.path, h1 ?? state.meta.title ?? "");
        indexEntries.push({
          id,
          kind: "route",
          route: job.route.path,
          flow: null,
          step: null,
          path: job.path,
          viewport: job.viewport,
          colorScheme: job.scheme,
          capturedAt: state.meta.capturedAt,
          gitSha,
          configHash: cHash,
          sourceHashes: await hashFiles(
            project.paths.root,
            layoutChain(project.paths.root, job.route.file, routerRoot),
          ),
        });
        report.states.push({
          id,
          kind: "route",
          path: job.path,
          viewport: job.viewport,
          colorScheme: job.scheme,
          dir: toPosix(path.relative(project.paths.root, dir)),
          warnings: state.meta.warnings,
          redactions: state.meta.redactions,
          elements: state.elements.elements.length,
          ms: Date.now() - t0,
        });
        logger.step(`captured ${id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(config.capture.concurrency, Math.max(1, jobs.length)) }, worker));

    // Flows run after routes, one at a time (they change demo data).
    for (const file of flowsToRun) {
      const def: TsFlowDefinition | ReturnType<typeof parseFlowYaml> =
        file.kind === "yaml"
          ? parseFlowYaml(await readFile(file.file, "utf8"), file.file)
          : await loadTsFlow(project, file.file);
      // A flow runs at its declared viewport unless `--flow` and `--viewport` are both given explicitly.
      const flowViewports =
        request.flows?.length && request.viewports?.length
          ? request.viewports
          : [def.viewport ?? config.capture.defaultViewports[0]!];
      for (const viewport of flowViewports) {
        for (const scheme of schemes(project, request.dark)) {
          const t0 = Date.now();
          const context = await contextFor(viewport, scheme, config.auth.strategy !== "none");
          const page = await context.newPage();
          try {
            await freezeClock(page, config.demo.now);
            const result = await runFlow(def, {
              project,
              page,
              baseUrl: app.url,
              viewportName: viewport,
              colorScheme: scheme,
              gitSha,
            });
            const startRoute = allRoutes.find((r) => r.path === def.start) ?? null;
            const sources = [
              toPosix(path.relative(project.paths.root, file.file)),
              ...layoutChain(project.paths.root, startRoute?.file ?? null, routerRoot),
            ];
            const hashes = await hashFiles(project.paths.root, sources);
            for (const state of result.states) {
              collectLabels(state.elements, glossaryLabels);
              indexEntries.push({
                id: state.id,
                kind: "flow",
                route: null,
                flow: def.name,
                step: state.meta.step,
                path: state.meta.path,
                viewport,
                colorScheme: scheme,
                capturedAt: state.meta.capturedAt,
                gitSha,
                configHash: cHash,
                sourceHashes: hashes,
              });
              report.states.push({
                id: state.id,
                kind: "flow",
                path: state.meta.path,
                viewport,
                colorScheme: scheme,
                dir: toPosix(path.relative(project.paths.root, path.join(result.dir, state.meta.step!))),
                warnings: state.meta.warnings,
                redactions: state.meta.redactions,
                elements: state.elements.elements.length,
                ms: 0,
              });
            }
            report.flows.push({ name: def.name, viewport, states: result.run.states, steps: result.run.steps.length });
            logger.step(
              `flow ${def.name}@${viewport}: ${result.run.states.length} states (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
            );
          } finally {
            await page.close();
          }
        }
      }
    }
    for (const c of contexts.values()) await c.close();
  } finally {
    await browser.close();
    if (app.started) await app.stop();
  }

  // Bookkeeping: index, routes.json titles/protection, glossary "Discovered".
  if (indexEntries.length) await updateCaptureIndex(project, indexEntries);
  if (existsSync(project.paths.routes) && (titles.size || protectionUpdates.size)) {
    const routes: Routes = await readJson(project.paths.routes, RoutesSchema);
    for (const r of routes.routes) {
      const t = titles.get(r.path);
      if (t) r.title = t;
      if (protectionUpdates.has(r.path)) {
        r.protected = protectionUpdates.get(r.path)!;
        r.protectedReason = "redirected to login at capture time";
      } else if (r.protected === null && !r.dynamic) {
        const probe = await probeProtection(config.app.url, r.path, config.auth.loginPath, config.app.headers).catch(
          () => null,
        );
        if (probe !== null) r.protected = probe;
      }
    }
    await writeJson(project.paths.routes, routes);
  }
  if (existsSync(project.paths.glossaryMd) && glossaryLabels.length) {
    const md = await readFile(project.paths.glossaryMd, "utf8");
    const { md: next, added } = appendDiscovered(md, glossaryLabels);
    if (added.length) {
      await writeFileAtomic(project.paths.glossaryMd, next);
      await writeJson(project.paths.glossaryJson, parseGlossaryMd(next));
      report.glossaryAdded = added;
    }
  }
  report.durationMs = Date.now() - started;
  return report;
}

/** UI text worth adding to the glossary: nav links, h1–h3, buttons, tabs (SPEC §8.4). */
export function collectLabels(map: ElementMap, out: string[]): void {
  for (const el of map.elements) {
    if (!el.visible || !el.name) continue;
    const navLink =
      el.role === "link" &&
      (el.landmark === "nav" ||
        el.landmark === "navigation" ||
        el.landmark === "aside" ||
        el.landmark === "complementary");
    const heading = el.role === "heading" && (el.level ?? 6) <= 3;
    if (navLink || heading || el.role === "button" || el.role === "tab") out.push(el.name);
  }
}

export type { Browser };
