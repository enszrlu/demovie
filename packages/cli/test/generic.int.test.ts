import { type ChildProcess, spawn } from "node:child_process";
import { cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "../../../scripts/lib/repo.ts";
import { run as init } from "../src/commands/init.ts";
import { createContext } from "../src/context.ts";

const PORT = 3402;

describe("generic mode: static-site fixture", () => {
  let server: ChildProcess;
  const dir = path.join(repoRoot, ".tmp", "it-static");
  beforeAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    cpSync(path.join(repoRoot, "examples", "static-site"), dir, { recursive: true });
    server = spawn(process.execPath, ["server.mjs", String(PORT)], { cwd: dir, stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
      const ok = await fetch(`http://127.0.0.1:${PORT}/`)
        .then((r) => r.ok)
        .catch(() => false);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  afterAll(() => server?.kill());

  it("crawls routes, extracts runtime brand and never follows logout/destructive links", async () => {
    const result = await init(createContext({ cwd: dir, yes: true, json: true }), {
      url: `http://127.0.0.1:${PORT}`,
      skill: false,
    });
    expect((result.data as { detection: { framework: string } }).detection.framework).toBe("generic");
    const demovie = path.join(dir, ".demovie");
    const routes = JSON.parse(readFileSync(path.join(demovie, "routes.json"), "utf8")).routes as {
      path: string;
      source: string;
      title: string;
    }[];
    expect(routes.map((r) => r.path).sort()).toEqual(["/", "/about", "/menu.html"]);
    expect(routes.every((r) => r.source === "crawl")).toBe(true);
    expect(routes.find((r) => r.path === "/")?.title).toBe("Fresh bread every morning");
    const brand = JSON.parse(readFileSync(path.join(demovie, "brand/brand.json"), "utf8"));
    expect(brand.colors.light).toMatchObject({ background: "#fffdf7", foreground: "#1c1917", primary: "#ea580c" });
    expect(brand.logo.wordmark).toBe("brand/logo.svg");
    const glossary = JSON.parse(readFileSync(path.join(demovie, "glossary.json"), "utf8"));
    expect(glossary.uiLabels).toEqual(expect.arrayContaining(["Fresh bread every morning", "About"]));
  });
});
