import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanTitle, detectProject, portFromScript } from "../src/detect/framework.ts";
import {
  concretePaths,
  discoverRoutes,
  fillParams,
  matcherToRegExp,
  routePatternToRegExp,
} from "../src/detect/routes.ts";

const fixtures = path.join(import.meta.dirname, "fixtures");
const examples = path.join(import.meta.dirname, "../../../examples");

describe("framework detection", () => {
  it("finds the single Next.js app inside a pnpm monorepo", () => {
    const d = detectProject(path.join(fixtures, "monorepo"));
    expect(d.framework).toBe("nextjs");
    expect(path.relative(fixtures, d.appRoot)).toBe(path.join("monorepo", "apps", "web"));
    expect(d.packageManager).toBe("pnpm");
    expect(d.startCommand).toBe("pnpm dev");
    expect(d.port).toBe(3100);
    expect(d.url).toBe("http://localhost:3100");
    expect(d.nextjs?.router).toBe("app");
  });

  it("asks for --app when a workspace has several Next.js apps", () => {
    const d = detectProject(path.join(fixtures, "monorepo-two"));
    expect(d.candidates.sort()).toEqual(["apps/admin", "apps/web"]);
    expect(() => detectProject(path.join(fixtures, "monorepo-two"), { framework: "nextjs" })).toThrow(
      /found 2 Next.js apps/,
    );
    const picked = detectProject(path.join(fixtures, "monorepo-two"), { app: "apps/admin" });
    expect(picked.framework).toBe("nextjs");
    expect(picked.packageManager).toBe("npm");
  });

  it("reads next.config statically: basePath, i18n, output", () => {
    const d = detectProject(path.join(fixtures, "basepath"));
    expect(d.nextjs).toMatchObject({
      basePath: "/docs",
      output: "standalone",
      i18n: { locales: ["en", "de"], defaultLocale: "en" },
    });
    expect(d.url).toBe("http://localhost:4000/docs");
  });

  it("detects the Pages Router fixture with Tailwind v3", () => {
    const d = detectProject(path.join(examples, "pages-minimal"));
    expect(d.framework).toBe("nextjs");
    expect(d.nextjs).toMatchObject({ router: "pages", pagesDir: "pages", appDir: null });
    expect(d.tailwind).toBe(3);
    expect(d.port).toBe(3001);
  });

  it("falls back to generic mode for the static site", () => {
    const d = detectProject(path.join(examples, "static-site"));
    expect(d.framework).toBe("generic");
    expect(d.nextjs).toBeNull();
    const withUrl = detectProject(path.join(examples, "static-site"), { url: "http://127.0.0.1:3002" });
    expect(withUrl.url).toBe("http://127.0.0.1:3002");
  });

  it("uses the yarn lockfile", () => {
    expect(detectProject(path.join(fixtures, "route-groups")).packageManager).toBe("yarn");
  });

  it("parses ports and titles", () => {
    expect(portFromScript("next dev -p 4321")).toBe(4321);
    expect(portFromScript("next dev --port=5000")).toBe(5000);
    expect(portFromScript("next dev", { PORT: "8080" })).toBe(8080);
    expect(portFromScript(undefined, {})).toBe(3000);
    expect(cleanTitle("Dashboard | Harborly")).toBe("Harborly");
    expect(cleanTitle("Harborly")).toBe("Harborly");
  });
});

describe("route discovery", () => {
  const d = detectProject(path.join(fixtures, "route-groups"));
  const routes = discoverRoutes(d.appRoot, d.nextjs!, { params: { "/photo/[id]": ["42"] } });
  const byPath = (p: string, slot?: string) => routes.find((r) => r.path === p && r.slot === slot);

  it("strips route groups and skips private, intercepting and api folders", () => {
    expect(routes.map((r) => r.path).sort()).toEqual(
      [
        "/",
        "/about",
        "/blog/[...slug]",
        "/dashboard",
        "/dashboard",
        "/dashboard/settings",
        "/docs/[[...slug]]",
        "/login",
        "/photo/[id]",
      ].sort(),
    );
    expect(routes.some((r) => r.file?.includes("_components"))).toBe(false);
    expect(routes.some((r) => r.file?.includes("(.)"))).toBe(false);
    expect(routes.some((r) => r.path.startsWith("/api"))).toBe(false);
  });

  it("treats parallel slots as separate routes", () => {
    expect(byPath("/dashboard", "analytics")?.file).toBe("app/(dashboard)/dashboard/@analytics/page.tsx");
    expect(byPath("/dashboard")?.file).toBe("app/(dashboard)/dashboard/page.tsx");
  });

  it("marks dynamic, catch-all and optional catch-all segments and params", () => {
    expect(byPath("/photo/[id]")).toMatchObject({ dynamic: true, params: ["42"] });
    expect(byPath("/blog/[...slug]")).toMatchObject({ dynamic: true, needsParams: true });
    expect(byPath("/docs/[[...slug]]")).toMatchObject({ dynamic: true, needsParams: true });
    expect(byPath("/about")?.dynamic).toBe(false);
  });

  it("derives protection from the middleware matcher and never protects the login page", () => {
    expect(byPath("/dashboard")?.protected).toBe(true);
    expect(byPath("/dashboard/settings")?.protected).toBe(true);
    expect(byPath("/about")?.protected).toBe(false);
    expect(byPath("/login")).toMatchObject({ protected: false, protectedReason: "auth page" });
  });

  it("discovers Pages Router routes without _app, _document, 404 or api", () => {
    const pm = detectProject(path.join(examples, "pages-minimal"));
    const pages = discoverRoutes(pm.appRoot, pm.nextjs!);
    expect(pages.map((r) => r.path)).toEqual(["/", "/about", "/blog", "/blog/[slug]", "/pricing"]);
    expect(pages.every((r) => r.router === "pages")).toBe(true);
  });

  it("converts matchers and fills params", () => {
    const re = matcherToRegExp("/app/:path*");
    expect(re.test("/app")).toBe(true);
    expect(re.test("/app/projects/x")).toBe(true);
    expect(re.test("/apple")).toBe(false);
    expect(matcherToRegExp("/((?!api|_next/static|favicon.ico).*)").test("/dashboard")).toBe(true);
    expect(matcherToRegExp("/((?!api|_next/static|favicon.ico).*)").test("/api/x")).toBe(false);
    expect(matcherToRegExp("/blog/:slug").test("/blog/hello")).toBe(true);
    expect(fillParams("/app/projects/[id]", "prj_launch")).toBe("/app/projects/prj_launch");
    expect(fillParams("/docs/[[...slug]]", "a/b")).toBe("/docs/a/b");
    expect(
      concretePaths({ path: "/p/[id]", file: null, dynamic: true, params: ["1", "2"], protected: null, source: "fs" }),
    ).toEqual(["/p/1", "/p/2"]);
    expect(routePatternToRegExp("/app/projects/[id]").test("/app/projects/prj_launch")).toBe(true);
    expect(routePatternToRegExp("/docs/[[...slug]]").test("/docs")).toBe(true);
  });
});
