import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildImportGraph,
  createResolver,
  layoutChain,
  parseCommit,
  parseJsonc,
  RoutesSchema,
  reachTargets,
  storyLine,
} from "../src/index.ts";

const HARBORLY = path.resolve(import.meta.dirname, "../../../examples/harborly");

describe("commit parsing", () => {
  it("reads conventional commits, PR numbers, breaking changes and visibility", () => {
    expect(parseCommit("a1", "feat(projects): show health trends (#42)", "")).toMatchObject({
      type: "feat",
      scope: "projects",
      subject: "show health trends",
      prs: [42],
      breaking: false,
      userVisible: true,
    });
    expect(parseCommit("a2", "fix!: drop the legacy board", "BREAKING CHANGE: removed")).toMatchObject({
      type: "fix",
      breaking: true,
      userVisible: true,
    });
    expect(parseCommit("a3", "chore(deps): bump next", "").userVisible).toBe(false);
    expect(parseCommit("a4", "docs: readme", "").userVisible).toBe(false);
    expect(parseCommit("a5", "Merge pull request #7 from acme/cards", "Cards show owners\n\nmore")).toMatchObject({
      prs: [7],
      subject: "Cards show owners",
      userVisible: true,
    });
    expect(parseCommit("a6", "Refactor the sidebar", "").userVisible).toBe(false);
  });

  it("writes a story line from user-visible commits only", () => {
    const commits = [
      parseCommit("1", "feat: one", ""),
      parseCommit("2", "test: x", ""),
      parseCommit("3", "fix: two", ""),
      parseCommit("4", "perf: three", ""),
      parseCommit("5", "feat: four", ""),
    ];
    expect(storyLine(commits)).toBe("4 user-visible changes: one; two; three; and 1 more.");
    expect(storyLine([parseCommit("x", "chore: y", "")])).toMatch(/^No user-visible changes/);
  });
});

describe("module resolution and the import graph", () => {
  it("parses tsconfig JSONC without breaking glob strings", () => {
    expect(parseJsonc('{ "include": ["**/*.ts"], // c\n "a": [1, 2,], /* b */ "url": "http://x" }')).toEqual({
      include: ["**/*.ts"],
      a: [1, 2],
      url: "http://x",
    });
  });

  it("resolves relative imports and tsconfig paths aliases", () => {
    const resolve = createResolver(HARBORLY);
    const from = path.join(HARBORLY, "src/app/app/page.tsx");
    expect(path.relative(HARBORLY, resolve(from, "@/components/ui/progress")!)).toBe("src/components/ui/progress.tsx");
    expect(path.relative(HARBORLY, resolve(from, "./_components/badges")!)).toBe("src/app/app/_components/badges.tsx");
    expect(resolve(from, "next/link")).toBeNull();
  });

  it("maps a shared component to the routes that render it", () => {
    const { routes } = RoutesSchema.parse(
      JSON.parse(readFileSync(path.join(HARBORLY, ".demovie/routes.json"), "utf8")),
    );
    const chains = new Map(routes.map((r) => [r.path, layoutChain(HARBORLY, r.file ?? null, "src/app")]));
    const graph = buildImportGraph(HARBORLY);
    const affected = (file: string) => {
      const reached = reachTargets(graph, [file], new Set([...chains.values()].flat()));
      return routes.filter((r) => chains.get(r.path)!.some((f) => reached.has(f))).map((r) => r.path);
    };
    expect(affected("src/app/app/_components/badges.tsx")).toEqual([
      "/app",
      "/app/projects",
      "/app/projects/[id]",
      "/app/projects/new",
    ]);
    // the sidebar (in the /app layout) uses Progress, so every /app route is affected
    expect(affected("src/components/ui/progress.tsx")).toEqual(
      routes.map((r) => r.path).filter((p) => p.startsWith("/app")),
    );
    const via = reachTargets(
      graph,
      ["src/app/app/_components/project-card.tsx"],
      new Set(["src/app/app/projects/page.tsx"]),
    );
    expect(via.get("src/app/app/projects/page.tsx")).toEqual([
      "src/app/app/_components/project-card.tsx",
      "src/app/app/_components/projects-board.tsx",
      "src/app/app/projects/page.tsx",
    ]);
  });
});

describe("defaultSince", () => {
  it("compares with the previous tag when HEAD is the release tag itself", async () => {
    const { execFileSync } = await import("node:child_process");
    const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { defaultSince } = await import("../src/changes/index.ts");
    const dir = path.join(import.meta.dirname, "../../../.tmp/unit-default-since");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], {
        cwd: dir,
        stdio: "ignore",
      });
    git("init", "-q");
    const commit = (n: number) => {
      writeFileSync(path.join(dir, "f.txt"), String(n));
      git("add", "-A");
      git("commit", "-q", "-m", `feat: ${n}`);
    };
    commit(1);
    git("tag", "v1");
    commit(2);
    git("tag", "v2");
    expect(await defaultSince(dir)).toBe("v1");
    commit(3);
    expect(await defaultSince(dir)).toBe("v2");
    rmSync(dir, { recursive: true, force: true });
  });
});
