import { existsSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  appendDiscovered,
  type Brand,
  BrandSchema,
  buildGlossary,
  type Config,
  checkUrl,
  DemovieError,
  type Detection,
  detectProject,
  discoverRoutes,
  ensureDir,
  extractSeedData,
  extractStaticBrand,
  type Glossary,
  logger,
  normalizeSvg,
  type Project,
  type ProjectPaths,
  parseGlossaryMd,
  type Route,
  type Routes,
  RoutesSchema,
  readPackageJson,
  readReadme,
  renderGlossaryMd,
  seedFileFromCommand,
  type UiText,
  writeFileAtomic,
  writeJson,
} from "@demovie/core";

export type ExtractTarget = "brand" | "glossary" | "routes" | "all";

export interface ExtractSummary {
  brand: { colors: number; fonts: string[]; logo: string | null; primary: string | null; warnings: string[] } | null;
  routes: { total: number; protected: number; dynamic: number; needsParams: number } | null;
  glossary: {
    terms: number;
    uiLabels: number;
    features: number;
    people: number;
    entities: number;
    discovered: number;
  } | null;
  runtime: { reachable: boolean; loggedIn: boolean; pages: number; note: string | null };
}

export interface ExtractOptions {
  project: Pick<Project, "paths" | "resolved" | "env" | "missingEnv"> & { config: Config };
  target: ExtractTarget;
  detection?: Detection;
  /** Product description from `--about`, used when seeding a new glossary.md. */
  about?: string | undefined;
  /** Skip the browser pass even if the app is reachable. */
  staticOnly?: boolean;
}

function countColors(brand: Brand): number {
  const light = brand.colors.light;
  return Object.entries(light).filter(([k, v]) => k !== "chart" && v).length + light.chart.length;
}

/** Run the extractors (SPEC §8): static always, runtime (crawl, computed styles) when the app answers. */
export async function runExtraction(options: ExtractOptions): Promise<ExtractSummary> {
  const { project, target } = options;
  const { paths } = project;
  const config = project.resolved;
  const detection =
    options.detection ??
    detectProject(paths.root, {
      framework: config.project.framework,
      url: config.project.framework === "generic" ? config.app.url : undefined,
    });
  const want = (t: Exclude<ExtractTarget, "all">) => target === "all" || target === t;
  const summary: ExtractSummary = {
    brand: null,
    routes: null,
    glossary: null,
    runtime: { reachable: false, loggedIn: false, pages: 0, note: null },
  };

  // Static passes
  const staticBrand = extractStaticBrand({
    appRoot: paths.root,
    nextjs: detection.nextjs,
    packageJson: detection.packageJson,
    productName: config.project.name,
  });
  const brand: Brand = BrandSchema.parse(staticBrand.brand);
  let routes: Route[] = detection.nextjs
    ? discoverRoutes(paths.root, detection.nextjs, { params: config.capture.routes.params })
    : [];

  // Runtime pass
  const uiTexts: UiText[] = [];
  const reach = options.staticOnly
    ? null
    : await checkUrl(config.app.url, { headers: config.app.headers, timeoutMs: 4000 });
  // Chromium may not be installed yet (a fresh machine): extract statically and say how to finish the runtime pass.
  const capture = reach?.ok ? await import("@demovie/capture") : null;
  const browser = capture
    ? await capture.launchChromium().catch((error: unknown) => {
        if (error instanceof DemovieError && error.code.startsWith("E_PREREQ")) return null;
        throw error;
      })
    : null;
  if (reach?.ok && !browser) {
    summary.runtime.note =
      "Chromium isn't installed yet: used static extraction only — run `npx demovie doctor --fix`, then `npx demovie extract`";
  }
  if (capture && browser) {
    summary.runtime.reachable = true;
    try {
      const base = config.app.url;
      const visited = new Set<string>();
      const publicCtx = await capture.createCaptureContext(browser, {
        config,
        viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
        colorScheme: "light",
      });
      const pub = await capture.crawl(publicCtx, {
        baseUrl: base,
        startPaths: ["/"],
        maxPages: config.capture.crawl.maxPages,
        maxDepth: config.capture.crawl.maxDepth,
        loggedIn: false,
        visited,
      });
      const samples = [...pub.samples];
      const pages = [...pub.pages];
      let statePath: string | undefined;
      if (config.auth.strategy !== "none") {
        try {
          const auth = await capture.ensureAuth(browser, project as Project, base);
          statePath = auth.statePath ?? undefined;
          summary.runtime.loggedIn = true;
        } catch (error) {
          summary.runtime.note = `login skipped: ${(error as Error).message}`;
          logger.warn(summary.runtime.note);
        }
      }
      if (statePath) {
        const authCtx = await capture.createCaptureContext(browser, {
          config,
          viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
          colorScheme: "light",
          storageState: statePath,
        });
        // Re-visit protected starting points with the session (the public crawl only saw the login redirect).
        for (const p of [...visited]) if (routes.find((r) => r.path === p)?.protected) visited.delete(p);
        const start = [
          config.auth.successPath ?? "/",
          ...routes.filter((r) => r.protected && !r.dynamic).map((r) => r.path),
        ];
        const priv = await capture.crawl(authCtx, {
          baseUrl: base,
          startPaths: [...new Set(start)],
          maxPages: config.capture.crawl.maxPages,
          maxDepth: config.capture.crawl.maxDepth,
          loggedIn: true,
          visited,
        });
        samples.push(...priv.samples);
        pages.push(...priv.pages);
        await authCtx.close();
      }
      summary.runtime.pages = pages.length;
      for (const s of samples) for (const t of s.uiTexts) uiTexts.push({ ...t, route: s.path });
      if (want("brand") && samples.length > 0) {
        const page = await publicCtx.newPage();
        await capture.mergeRuntimeBrand(brand, samples, { page, demovieDir: paths.dir, origin: new URL(base).origin });
        await page.close();
      }
      await publicCtx.close();
      routes = capture.mergeCrawl(routes, pages);
      if (detection.framework === "generic" || routes.some((r) => r.protected === null)) {
        for (const r of routes) {
          if (r.dynamic && !r.params?.length) continue;
          const probe = await capture.probeProtection(
            base,
            r.dynamic ? r.path.replace(/\[[^\]]+\]/g, r.params![0]!) : r.path,
            config.auth.loginPath,
            config.app.headers,
          );
          if (probe !== null && r.protected !== probe) {
            r.protected = probe;
            r.protectedReason = probe ? "redirects to login without a session" : "answers without a session";
          }
        }
      }
    } finally {
      await browser.close();
    }
  } else if (!options.staticOnly && !reach?.ok) {
    summary.runtime.note = `app not reachable at ${config.app.url}${reach?.error ? ` (${reach.error})` : ""}; used static extraction only — run \`npx demovie up\` then \`npx demovie extract\` to confirm tokens at runtime`;
  }

  // Write brand
  if (want("brand")) {
    await ensureDir(paths.brandDir);
    for (const copy of staticBrand.copies) {
      const dest = path.join(paths.dir, copy.to);
      await ensureDir(path.dirname(dest));
      // SVG logos are normalized so they scale (viewBox) and render as drawn (JSX attribute names fixed).
      if (dest.endsWith(".svg")) await writeFileAtomic(dest, normalizeSvg(await readFile(copy.from, "utf8")));
      else await copyFile(copy.from, dest);
    }
    await writeJson(paths.brandJson, brand);
    summary.brand = {
      colors: countColors(brand),
      fonts: [
        ...new Set(
          [brand.fonts.heading?.family, brand.fonts.body?.family, brand.fonts.mono?.family].filter((f): f is string =>
            Boolean(f),
          ),
        ),
      ],
      logo: brand.logo.wordmark ?? brand.logo.mark,
      primary: brand.colors.light.primary,
      warnings: brand.warnings,
    };
  }

  // Write routes
  if (want("routes")) {
    const data: Routes = RoutesSchema.parse({ generatedAt: new Date().toISOString(), routes });
    await writeJson(paths.routes, data);
    summary.routes = {
      total: routes.length,
      protected: routes.filter((r) => r.protected).length,
      dynamic: routes.filter((r) => r.dynamic).length,
      needsParams: routes.filter((r) => r.needsParams).length,
    };
  }

  // Write glossary (md is authoritative: create it once, afterwards only append to "Discovered")
  if (want("glossary")) {
    const pkg = readPackageJson(paths.root);
    const seed = extractSeedData(seedFileFromCommand(paths.root, config.demo.seed, pkg?.scripts));
    let discovered = 0;
    let glossary: Glossary;
    if (existsSync(paths.glossaryMd)) {
      const md = await readFile(paths.glossaryMd, "utf8");
      const { md: next, added } = appendDiscovered(
        md,
        uiTexts.map((t) => t.text),
      );
      discovered = added.length;
      if (added.length > 0) await writeFileAtomic(paths.glossaryMd, next);
      glossary = parseGlossaryMd(next);
    } else {
      const ctaHost = brand.url ? safeHost(brand.url) : null;
      glossary = buildGlossary({
        productName: config.project.name,
        tagline: brand.tagline ?? options.about ?? null,
        ctaUrl: ctaHost,
        readme: readReadme(paths.root, detection.workspaceRoot),
        uiTexts,
        people: seed.people,
        entities: seed.entities,
      });
      if (options.about && !glossary.tagline) glossary.tagline = options.about;
      await writeFileAtomic(paths.glossaryMd, renderGlossaryMd(glossary));
      glossary = parseGlossaryMd(await readFile(paths.glossaryMd, "utf8"));
    }
    await writeJson(paths.glossaryJson, glossary);
    summary.glossary = {
      terms: glossary.uiLabels.length + glossary.features.length + glossary.entities.length + glossary.people.length,
      uiLabels: glossary.uiLabels.length,
      features: glossary.features.length,
      people: glossary.people.length,
      entities: glossary.entities.length,
      discovered,
    };
  }
  return summary;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
  }
}

/** Sync glossary.json from glossary.md (SPEC §6.3). */
export async function syncGlossary(paths: ProjectPaths): Promise<Glossary> {
  const glossary = parseGlossaryMd(await readFile(paths.glossaryMd, "utf8"));
  await writeJson(paths.glossaryJson, glossary);
  return glossary;
}
