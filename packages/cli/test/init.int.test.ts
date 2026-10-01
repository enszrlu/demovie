import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { FIXTURE_ENV, harborlyCopy } from "../../../scripts/test/harborly.ts";
import { run as doctor } from "../src/commands/doctor.ts";
import { run as extract } from "../src/commands/extract.ts";
import { run as init } from "../src/commands/init.ts";
import { run as status } from "../src/commands/status.ts";
import { createContext } from "../src/context.ts";

describe("init --yes on Harborly (real Chromium, app running)", () => {
  let dir: string;
  const saved = { ...process.env };
  beforeAll(() => {
    dir = harborlyCopy("init");
    Object.assign(process.env, FIXTURE_ENV);
  });
  afterAll(() => {
    process.env = saved;
  });

  it("writes a valid config, brand, glossary and routes", async () => {
    expect(inject("harborlyUrl")).toBe("http://localhost:3000");
    const result = await init(createContext({ cwd: dir, yes: true, json: true }), { skill: false });
    expect(result.exitCode ?? 0).toBe(0);
    const demovie = path.join(dir, ".demovie");
    const config = JSON.parse(readFileSync(path.join(demovie, "config.json"), "utf8"));
    expect(config.project).toMatchObject({
      name: "Harborly",
      framework: "nextjs",
      nextjs: { router: "app", appDir: "src/app" },
    });
    expect(config.app.url).toBe("http://localhost:3000");
    expect(config.auth).toMatchObject({ strategy: "form", loginPath: "/login", successPath: "/app" });
    expect(config.demo.seed).toBe("pnpm demo:seed");
    expect(config.demo.mask.allow).toEqual(["*@harborly.demo"]);

    const brand = JSON.parse(readFileSync(path.join(demovie, "brand/brand.json"), "utf8"));
    expect(brand.colors.light.primary).toBe("#155dfc");
    expect(brand.provenance["colors.light.primary"]).toMatch(
      /css-var --primary @ src\/app\/globals\.css:\d+ .*runtime-confirmed/,
    );
    expect(brand.fonts.heading.family).toBe("Geist");
    expect(brand.fonts.body.family).toBe("Geist");
    expect(brand.fonts.mono.family).toBe("Geist Mono");
    for (const f of brand.fonts.body.files) expect(existsSync(path.join(demovie, f))).toBe(true);
    expect(brand.logo.mark).toBe("brand/logo-mark.svg");
    expect(existsSync(path.join(demovie, brand.logo.mark))).toBe(true);
    expect(brand.url).toBe("https://harborly.example");

    const routes = JSON.parse(readFileSync(path.join(demovie, "routes.json"), "utf8")).routes as {
      path: string;
      protected: boolean;
      params?: string[];
    }[];
    expect(routes.length).toBeGreaterThanOrEqual(10);
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));
    for (const p of [
      "/app",
      "/app/projects",
      "/app/projects/[id]",
      "/app/projects/new",
      "/app/team",
      "/app/reports",
      "/app/settings",
    ]) {
      expect(byPath[p]?.protected, p).toBe(true);
    }
    for (const p of ["/", "/pricing", "/changelog", "/customers", "/login"])
      expect(byPath[p]?.protected, p).toBe(false);
    expect(byPath["/app/projects/[id]"]?.params?.[0]).toMatch(/^prj_/);

    const glossary = JSON.parse(readFileSync(path.join(demovie, "glossary.json"), "utf8"));
    expect(glossary.productName).toBe("Harborly");
    expect(glossary.ctaUrl).toBe("harborly.example");
    expect(glossary.people).toEqual(expect.arrayContaining(["Maya Chen", "Leo Park"]));
    expect(glossary.entities).toEqual(expect.arrayContaining(["Acme Rockets", "Northwind", "Q3 Launch"]));
    expect(glossary.uiLabels).toEqual(expect.arrayContaining(["New project", "Launch checklist", "Velocity"]));
    expect(glossary.features.map((f: { term: string }) => f.term)).toEqual(
      expect.arrayContaining(["Projects board", "Launch checklist"]),
    );
    expect(readFileSync(path.join(demovie, ".gitignore"), "utf8")).toMatch(/captures\//);
  });

  it("re-extracts without touching glossary edits, and reports status and doctor", async () => {
    const md = path.join(dir, ".demovie", "glossary.md");
    const edited = `${readFileSync(md, "utf8")}\n<!-- user note -->\n`;
    await import("node:fs/promises").then((fs) => fs.writeFile(md, edited));
    const ctx = createContext({ cwd: dir, yes: true, json: true });
    const ex = await extract(ctx, "all");
    expect((ex.data as { runtime: { reachable: boolean; loggedIn: boolean } }).runtime).toMatchObject({
      reachable: true,
      loggedIn: true,
    });
    expect(readFileSync(md, "utf8")).toContain("<!-- user note -->");
    const st = (await status(ctx)).data as { initialized: boolean; app: { reachable: boolean } };
    expect(st).toMatchObject({ initialized: true, app: { reachable: true } });
    const dr = await doctor(ctx, {});
    const checks = (dr.data as { checks: { id: string; status: string }[] }).checks;
    expect(checks.find((c) => c.id === "chromium")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "config")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "app")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "auth")?.status).toBe("ok");
  });
});
