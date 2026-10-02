import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run as glossarySync } from "../src/commands/glossary-sync.ts";
import { run as init } from "../src/commands/init.ts";
import { run as status } from "../src/commands/status.ts";
import { createContext } from "../src/context.ts";

const repo = path.resolve(import.meta.dirname, "../../..");
const tmp = path.join(repo, ".tmp", "unit-init");

describe("init --yes (static, app not running)", () => {
  beforeAll(() => {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(path.dirname(tmp), { recursive: true });
    cpSync(path.join(repo, "examples/pages-minimal"), tmp, { recursive: true });
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("writes config, brand, glossary, routes and a .gitignore", async () => {
    const ctx = createContext({ cwd: tmp, yes: true, json: true });
    const result = await init(ctx, { extract: true, skill: false });
    expect(result.exitCode ?? 0).toBe(0);
    const dir = path.join(tmp, ".demovie");
    for (const f of [
      "config.json",
      "brand/brand.json",
      "glossary.md",
      "glossary.json",
      "routes.json",
      ".gitignore",
      "assets.json",
    ]) {
      expect(existsSync(path.join(dir, f)), f).toBe(true);
    }
    const config = JSON.parse(readFileSync(path.join(dir, "config.json"), "utf8"));
    // demovie isn't installed in the fixture, so the schema comes from unpkg (SPEC §6.1)
    expect(config.$schema).toMatch(/^https:\/\/unpkg\.com\/demovie@[\w.-]+\/schema\/config\.schema\.json$/);
    expect(config.project.framework).toBe("nextjs");
    expect(config.app.start.command).toBe("pnpm dev");
    const brand = JSON.parse(readFileSync(path.join(dir, "brand/brand.json"), "utf8"));
    expect(brand.colors.light.primary).toBe("#10b77f");
    const routes = JSON.parse(readFileSync(path.join(dir, "routes.json"), "utf8"));
    expect(routes.routes.map((r: { path: string }) => r.path)).toEqual([
      "/",
      "/about",
      "/blog",
      "/blog/[slug]",
      "/pricing",
    ]);
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toContain(".env");
  });

  it("keeps user edits in glossary.md and syncs json from it", async () => {
    const md = path.join(tmp, ".demovie", "glossary.md");
    const edited = readFileSync(md, "utf8").replace(
      "## Avoid\n<!-- Words the product does NOT use. Agents must not put these on screen. -->\n",
      "## Avoid\n<!-- Words the product does NOT use. Agents must not put these on screen. -->\n- tasks\n",
    );
    await import("node:fs/promises").then((fs) => fs.writeFile(md, edited));
    const ctx = createContext({ cwd: tmp, yes: true, json: true });
    const result = await glossarySync(ctx);
    expect((result.data as { glossary: { avoid: string[] } }).glossary.avoid).toEqual(["tasks"]);
    await init(ctx, { extract: true, skill: false });
    expect(readFileSync(md, "utf8")).toContain("- tasks");
  });

  it("reports status with a next step", async () => {
    const ctx = createContext({ cwd: tmp, yes: true, json: true });
    const result = await status(ctx);
    const data = result.data as { initialized: boolean; next: string; app: { reachable: boolean } };
    expect(data.initialized).toBe(true);
    expect(data.app.reachable).toBe(false);
    expect(data.next).toContain("capture");
  });
});
