import { describe, expect, it } from "vitest";
import { ConfigSchema, jsonSchemaFor, SCHEMAS, type SchemaName, VideoSchema } from "../src/schemas/index.ts";
import { parseDotEnv, resolveEnvRefs } from "../src/util/env.ts";
import { globToRegExp, matchesAny, simpleGlobToRegExp, urlPatternToRegExp } from "../src/util/glob.ts";
import { routeSlug, slugify, titleCase } from "../src/util/slug.ts";
import { defaultExportValue, literalValue, moduleImports, parseModule, UNKNOWN } from "../src/util/static-js.ts";

describe("schemas", () => {
  it("generates a JSON Schema for every .demovie file", () => {
    for (const name of Object.keys(SCHEMAS) as SchemaName[]) {
      const schema = jsonSchemaFor(name);
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(schema.type).toBe("object");
      expect(Object.keys((schema.properties as object) ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("fills config defaults (SPEC §6.1)", () => {
    const c = ConfigSchema.parse({
      version: 1,
      project: { name: "X", framework: "nextjs" },
      app: { url: "http://localhost:3000" },
    });
    expect(c.capture.viewports.desktop).toEqual({ width: 1440, height: 900, deviceScaleFactor: 2 });
    expect(c.capture.defaultViewports).toEqual(["desktop"]);
    expect(c.capture.routes.exclude).toEqual(["/api/**"]);
    expect(c.demo.mask.patterns).toEqual(["email", "phone", "secret"]);
    expect(c.video).toEqual({ fps: 30, formats: ["16:9", "9:16"], style: "clean" });
    expect(c.audio.music.provider).toBe("synth");
    expect(c.auth.strategy).toBe("none");
  });

  it("rejects invalid values with paths", () => {
    const r = ConfigSchema.safeParse({ version: 2, project: { name: "", framework: "rails" }, app: { url: "nope" } });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["version", "project.name", "project.framework", "app.url"]));
  });

  it("validates video.json with defaults", () => {
    const v = VideoSchema.parse({
      slug: "launch",
      title: "T",
      type: "launch",
      duration: 34,
      formats: ["16:9", "9:16"],
    });
    expect(v.audio.loudness).toEqual({ targetLufs: -16, truePeak: -1.5 });
    expect(v.captions.burnIn).toEqual(["9:16"]);
    expect(
      VideoSchema.safeParse({ slug: "Bad Slug", title: "T", type: "launch", duration: 1, formats: ["16:9"] }).success,
    ).toBe(false);
  });
});

describe("env", () => {
  it("parses dotenv files", () => {
    expect(parseDotEnv("A=1\n# c\nexport B=\"two words\"\nC=x # trailing\nD='q'")).toEqual({
      A: "1",
      B: "two words",
      C: "x",
      D: "q",
    });
  });
  it("resolves $env: references and reports missing ones", () => {
    const missing = new Set<string>();
    const out = resolveEnvRefs({ a: "$env:TOKEN", b: ["$env:NOPE", "plain"], c: { d: 1 } }, { TOKEN: "t" }, missing);
    expect(out).toEqual({ a: "t", b: ["", "plain"], c: { d: 1 } });
    expect([...missing]).toEqual(["NOPE"]);
  });
});

describe("globs and slugs", () => {
  it("matches route globs", () => {
    expect(matchesAny("/api/x", ["/api/**"])).toBe(true);
    expect(matchesAny("/app", ["/app/**"])).toBe(true);
    expect(globToRegExp("/app/*").test("/app/a/b")).toBe(false);
    expect(urlPatternToRegExp("*google-analytics.com*").test("https://www.google-analytics.com/g/collect?v=2")).toBe(
      true,
    );
    expect(simpleGlobToRegExp("*@harborly.demo").test("Maya@Harborly.demo")).toBe(true);
  });
  it("slugifies", () => {
    expect(slugify("New project")).toBe("new-project");
    expect(slugify("Ünïcode & Co.")).toBe("unicode-and-co");
    expect(routeSlug("/")).toBe("index");
    expect(routeSlug("/app/projects/prj_launch")).toBe("app-projects-prj_launch");
    expect(titleCase("@acme/my-app")).toBe("My App");
  });
});

describe("static JS analysis", () => {
  it("evaluates literal configs without executing them", () => {
    const ast = parseModule(
      "import type { X } from 'x';\nconst base = { a: 1 };\nexport default defineConfig({ basePath: '/docs', list: [1, 'two'], nested: { ok: true }, fn: () => 1, url: new URL('https://a.example') });",
      "next.config.ts",
    )!;
    const value = defaultExportValue(ast) as Record<string, unknown>;
    expect(value.basePath).toBe("/docs");
    expect(value.list).toEqual([1, "two"]);
    expect(value.nested).toEqual({ ok: true });
    expect(value.fn).toBe(UNKNOWN);
    expect(value.url).toBe("https://a.example");
  });
  it("lists imports, including JSX files and CommonJS", () => {
    const ast = parseModule(
      'import "./globals.css";\nimport { Inter as I } from "next/font/google";\nexport default function L() { return <html><body /></html>; }',
      "layout.tsx",
    )!;
    expect(moduleImports(ast)).toEqual([
      { source: "./globals.css", specifiers: [], sideEffect: true },
      { source: "next/font/google", specifiers: [{ imported: "Inter", local: "I" }], sideEffect: false },
    ]);
    const cjs = parseModule(
      "const x = require('./a'); module.exports = { theme: { colors: { primary: '#fff' } } };",
      "tailwind.config.cjs",
    )!;
    expect((defaultExportValue(cjs) as { theme: unknown }).theme).toEqual({ colors: { primary: "#fff" } });
    expect(literalValue(null)).toBe(UNKNOWN);
  });
});
