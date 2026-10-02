import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { configHash, loadProject } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { run as status } from "../src/commands/status.ts";
import { createContext } from "../src/context.ts";

const state = (id: string, kind: "route" | "flow", route: string | null) => ({
  id,
  kind,
  route,
  flow: kind === "flow" ? "create" : null,
  step: kind === "flow" ? "done" : null,
  path: route ?? "/",
  viewport: "desktop",
  colorScheme: "light",
  capturedAt: "2026-09-15T10:30:00.000Z",
  gitSha: null,
  configHash: "x",
  sourceHashes: {},
});

describe("demovie status", () => {
  it("reports the grounding level, from brand-only to flows", async () => {
    const p = syntheticProject("unit-status", "");
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const level = async () => ((await status(ctx)).data as { grounding: { level: string | null } }).grounding.level;
    expect(await level()).toBe("L0");
    const demovie = path.join(p.root, ".demovie");
    writeFileSync(
      path.join(demovie, "routes.json"),
      JSON.stringify({
        generatedAt: "2026-09-15T10:30:00.000Z",
        routes: [
          { path: "/", file: null, dynamic: false, params: [], protected: false, source: "crawl" },
          { path: "/app", file: null, dynamic: false, params: [], protected: true, source: "crawl" },
        ],
      }),
    );
    const index = (states: unknown[]) =>
      writeFileSync(
        path.join(demovie, "captures", "index.json"),
        JSON.stringify({ version: 1, updatedAt: "2026-09-15T10:30:00.000Z", gitSha: null, configHash: "x", states }),
      );
    index([state("routes/index@desktop", "route", "/")]);
    expect(await level()).toBe("L1");
    index([state("routes/index@desktop", "route", "/"), state("routes/app@desktop", "route", "/app")]);
    expect(await level()).toBe("L2");
    index([state("flows/create@desktop/done", "flow", null)]);
    expect(await level()).toBe("L3");
  });

  it("warns when the configured agents have no skill in the project", async () => {
    const p = syntheticProject("unit-status-skill", "");
    const config = path.join(p.root, ".demovie/config.json");
    writeFileSync(
      config,
      JSON.stringify({
        version: 1,
        project: { name: "Synthetica", framework: "generic" },
        app: { url: "http://localhost:9", start: { command: "node server.js" } },
        agents: ["claude"],
      }),
    );
    // one fresh capture, so the next step is making a video
    const hash = configHash((await loadProject(p.root)).config);
    mkdirSync(path.join(p.root, ".demovie/captures/routes/index@desktop"), { recursive: true });
    writeFileSync(path.join(p.root, ".demovie/captures/routes/index@desktop/screen.png"), "");
    writeFileSync(
      path.join(p.root, ".demovie/captures/index.json"),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-09-15T10:30:00.000Z",
        gitSha: null,
        configHash: hash,
        states: [{ ...state("routes/index@desktop", "route", "/"), configHash: hash }],
      }),
    );
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const data = (await status(ctx)).data as { warnings: string[]; next: string };
    expect(data.warnings.join("\n")).toContain("no demovie skill in this project for claude");
    expect(data.next).toContain("npx demovie make --type launch");
  });

  it("reports a broken video.json as a warning instead of failing", async () => {
    const p = syntheticProject("unit-status-broken", "");
    const dir = path.join(p.root, ".demovie/videos/broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "video.json"), '{ "slug": "broken", ');
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const data = (await status(ctx)).data as { warnings: string[]; videos: unknown[] };
    expect(data.videos).toEqual([]);
    expect(data.warnings.join("\n")).toContain(".demovie/videos/broken/video.json is not valid JSON");
  });
});
