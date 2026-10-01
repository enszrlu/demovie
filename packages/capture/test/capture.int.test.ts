import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { loadProject } from "@demovie/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FIXTURE_ENV, harborlyProject } from "../../../scripts/test/harborly.ts";
import { run as flowNew } from "../../cli/src/commands/flow-new.ts";
import { run as flowRun } from "../../cli/src/commands/flow-run.ts";
import { run as status } from "../../cli/src/commands/status.ts";
import { createContext } from "../../cli/src/context.ts";
import { type CaptureReport, runCapture } from "../src/capture.ts";

const ROUTE_IDS = [
  "routes/index@desktop",
  "routes/pricing@desktop",
  "routes/changelog@desktop",
  "routes/customers@desktop",
  "routes/login@desktop",
  "routes/app@desktop",
  "routes/app-projects@desktop",
  "routes/app-projects-new@desktop",
  "routes/app-projects-prj_launch@desktop",
  "routes/app-team@desktop",
  "routes/app-reports@desktop",
  "routes/app-settings@desktop",
];
const FLOW_IDS = ["board", "dialog", "dialog-filled", "created", "checklist-hover", "board-after"].map(
  (s) => `flows/create-project@desktop/${s}`,
);

describe("capture on Harborly (real Chromium)", () => {
  let dir: string;
  let first: CaptureReport;
  const saved = { ...process.env };
  const captures = () => path.join(dir, ".demovie", "captures");
  const elements = (id: string) =>
    JSON.parse(readFileSync(path.join(captures(), id, "elements.json"), "utf8")) as {
      elements: { id: string; value?: string; bbox: object }[];
    };

  beforeAll(async () => {
    dir = harborlyProject("capture");
    Object.assign(process.env, FIXTURE_ENV);
    first = await runCapture(await loadProject(dir), {});
  });
  afterAll(() => {
    process.env = saved;
  });

  it("captures every static route, [id] with params and the create-project flow within budget", () => {
    const ids = first.states.map((s) => s.id).sort();
    expect(ids).toEqual([...ROUTE_IDS, ...FLOW_IDS].sort());
    for (const id of ids) {
      for (const f of ["screen.png", "elements.json", "meta.json"])
        expect(existsSync(path.join(captures(), id, f)), `${id}/${f}`).toBe(true);
    }
    expect(existsSync(path.join(captures(), "routes/index@desktop/full.png"))).toBe(true);
    const meta = JSON.parse(readFileSync(path.join(captures(), "routes/app-projects@desktop/meta.json"), "utf8"));
    expect(meta).toMatchObject({
      kind: "route",
      path: "/app/projects",
      dpr: 2,
      image: { width: 2880, height: 1800 },
      colorScheme: "light",
    });
    expect(meta.warnings).toEqual([]);
    expect(first.durationMs).toBeLessThan(60_000);
    const index = JSON.parse(readFileSync(path.join(captures(), "index.json"), "utf8"));
    expect(index.states).toHaveLength(ids.length);
    expect(index.states.find((s: { id: string }) => s.id === "routes/app-team@desktop").sourceHashes).toHaveProperty([
      "src/app/app/team/page.tsx",
    ]);
  });

  it("records flow targets in the coordinate space of the latest captured state", () => {
    const flow = JSON.parse(readFileSync(path.join(captures(), "flows/create-project@desktop/flow.json"), "utf8"));
    expect(flow.states).toEqual(["board", "dialog", "dialog-filled", "created", "checklist-hover", "board-after"]);
    const click = flow.steps.find((s: { action: string }) => s.action === "click");
    expect(click).toMatchObject({ state: "board", target: { elementId: "link:new-project" } });
    const board = elements("flows/create-project@desktop/board").elements.find((e) => e.id === "link:new-project");
    expect(click.target.bbox).toEqual(board?.bbox);
    const fill = flow.steps.find((s: { action: string }) => s.action === "fill");
    expect(fill).toMatchObject({ state: "dialog", value: "Q4 Launch", target: { elementId: "textbox:project-name" } });
    expect(elements("flows/create-project@desktop/created").elements.some((e) => e.id === "heading:q4-launch")).toBe(
      true,
    );
  });

  it("redacts the settings email and API key", () => {
    const map = elements("routes/app-settings@desktop").elements;
    const values = map.map((e) => e.value ?? "").join(" ");
    expect(values).not.toContain("maya.chen@acme-rockets.example");
    expect(values).not.toContain("sk\u005flive_51HbX9qLmT4vR2cK8nWd3pZ7");
    expect(values).toMatch(/sk_live_•+/);
    const meta = JSON.parse(readFileSync(path.join(captures(), "routes/app-settings@desktop/meta.json"), "utf8"));
    expect(meta.redactions).toMatchObject({ email: 1, secret: 1 });
  });

  it("keeps element ids stable across a second capture", async () => {
    const before = Object.fromEntries(
      [...ROUTE_IDS, ...FLOW_IDS].map((id) => [id, elements(id).elements.map((e) => e.id)]),
    );
    const second = await runCapture(await loadProject(dir), {});
    expect(second.states).toHaveLength(first.states.length);
    for (const id of [...ROUTE_IDS, ...FLOW_IDS])
      expect(
        elements(id).elements.map((e) => e.id),
        id,
      ).toEqual(before[id]);
  });

  it("captures mobile for two routes only", async () => {
    const report = await runCapture(await loadProject(dir), { viewports: ["mobile"], routes: ["/", "/app/projects"] });
    expect(report.states.map((s) => s.id).sort()).toEqual(["routes/app-projects@mobile", "routes/index@mobile"]);
    const meta = JSON.parse(readFileSync(path.join(captures(), "routes/index@mobile/meta.json"), "utf8"));
    expect(meta.image).toEqual({ width: 1170, height: 2532 });
  });

  it("marks changed sources stale and re-captures only those with --changed", async () => {
    const ctx = createContext({ cwd: dir, yes: true, json: true });
    expect(((await status(ctx)).data as { captures: { stale: number } }).captures.stale).toBe(0);
    await appendFile(path.join(dir, "src/app/app/team/page.tsx"), "\n// touched by the freshness test\n");
    const st = (await status(ctx)).data as { captures: { stale: number; staleIds: string[] } };
    expect(st.captures.staleIds).toEqual(["routes/app-team@desktop"]);
    const report = await runCapture(await loadProject(dir), { changed: true });
    expect(report.states.map((s) => s.id)).toEqual(["routes/app-team@desktop"]);
    expect(report.skipped.filter((s) => s.reason === "fresh").length).toBeGreaterThan(10);
    expect(((await status(ctx)).data as { captures: { stale: number } }).captures.stale).toBe(0);
  });

  it("runs TypeScript flows and scaffolds new ones", async () => {
    const ctx = createContext({ cwd: dir, yes: true, json: true });
    writeFileSync(
      path.join(dir, ".demovie/flows/open-team.flow.ts"),
      `import { defineFlow } from "demovie/flow";

export default defineFlow({
  name: "open-team",
  start: "/app",
  run: async ({ page, capture, step }) => {
    await capture("dashboard");
    await step("click", page.getByRole("link", { name: "Team" }).first(), (target) => target.click());
    await page.waitForURL("**/app/team");
    await capture("team");
  },
});
`,
    );
    const result = await flowRun(ctx, "open-team");
    const report = result.data as CaptureReport;
    expect(report.states.map((s) => s.id)).toEqual([
      "flows/open-team@desktop/dashboard",
      "flows/open-team@desktop/team",
    ]);
    const flow = JSON.parse(readFileSync(path.join(captures(), "flows/open-team@desktop/flow.json"), "utf8"));
    expect(flow.steps[0]).toMatchObject({ action: "click", state: "dashboard", target: { elementId: "link:team" } });
    const scaffold = await flowNew(ctx, "checkout", {});
    expect((scaffold.data as { file: string }).file).toMatch(/checkout\.flow\.yaml$/);
    expect(readFileSync(path.join(dir, ".demovie/flows/checkout.flow.yaml"), "utf8")).toContain("name: checkout");
  });
});
