import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DemovieError,
  type ElementInfo,
  type ElementMap,
  type Flow,
  type FlowRun,
  FlowSchema,
  type FlowStep,
  formatIssues,
  type Project,
  type Rect,
  stableJson,
  stepAction,
  type Target,
} from "@demovie/core";
import { build } from "esbuild";
import type { Locator, Page } from "playwright-core";
import { parse as parseYaml } from "yaml";
import {
  type CaptureStateOptions,
  type StateCapture,
  settle,
  snapshotState,
  trackNetwork,
  writeState,
} from "./capture-state.ts";
import { appUrl } from "./crawl.ts";

/** Targets that look destructive are refused unless the flow sets `allowDestructive: true` (SPEC §9.7). */
export const DESTRUCTIVE_TARGET =
  /\b(delete|remove|destroy|log\s?-?out|sign\s?-?out|billing|cancel|unsubscribe|deactivate)\b/i;

export interface TsFlowDefinition {
  name: string;
  start: string;
  viewport?: string;
  allowDestructive?: boolean;
  description?: string;
  run: (helpers: {
    page: Page;
    capture: (name: string, options?: { fullPage?: boolean }) => Promise<void>;
    step: (
      action: string,
      target: Locator,
      perform: (target: Locator) => Promise<unknown>,
      value?: string,
    ) => Promise<void>;
  }) => Promise<void>;
}

export interface FlowFile {
  name: string;
  file: string;
  kind: "yaml" | "ts";
}

export function listFlows(project: Pick<Project, "paths">): FlowFile[] {
  if (!existsSync(project.paths.flowsDir)) return [];
  return readdirSync(project.paths.flowsDir)
    .filter((f) => /\.flow\.(ya?ml|ts|mts|js|mjs)$/.test(f))
    .map((f) => ({
      name: f.replace(/\.flow\.(ya?ml|ts|mts|js|mjs)$/, ""),
      file: path.join(project.paths.flowsDir, f),
      kind: /\.ya?ml$/.test(f) ? ("yaml" as const) : ("ts" as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseFlowYaml(text: string, file: string): Flow {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    throw new DemovieError("E_CONFIG", `${file}: invalid YAML: ${(error as Error).message}`, "fix the YAML syntax");
  }
  const result = FlowSchema.safeParse(data);
  if (!result.success) {
    throw new DemovieError(
      "E_CONFIG",
      `${file}: ${formatIssues(result.error)}`,
      "see docs/capture-and-auth.md for the flow format",
    );
  }
  return result.data;
}

export async function loadTsFlow(project: Pick<Project, "paths">, file: string): Promise<TsFlowDefinition> {
  const out = path.join(
    project.paths.cacheDir,
    "flows",
    `${path.basename(file).replace(/\.[^.]+$/, "")}-${randomBytes(3).toString("hex")}.mjs`,
  );
  await mkdir(path.dirname(out), { recursive: true });
  await build({
    entryPoints: [file],
    outfile: out,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "demovie-flow-shim",
        setup(b) {
          b.onResolve({ filter: /^demovie(\/flow)?$/ }, () => ({ path: "demovie-flow", namespace: "demovie" }));
          b.onLoad({ filter: /.*/, namespace: "demovie" }, () => ({
            contents: "export const defineFlow = (flow) => flow;",
            loader: "js",
          }));
        },
      },
    ],
  });
  const mod = (await import(pathToFileURL(out).href)) as { default?: TsFlowDefinition };
  await rm(out, { force: true });
  const def = mod.default;
  if (!def || typeof def.run !== "function" || !def.name || !def.start) {
    throw new DemovieError(
      "E_CONFIG",
      `${file} must \`export default defineFlow({ name, start, run })\``,
      "see `npx demovie flow new <name> --ts` for a template",
    );
  }
  return def;
}

function describeTarget(t: Target): string {
  if (t.role) return `${t.role}${t.name ? ` "${t.name}"` : ""}`;
  if (t.label) return `label "${t.label}"`;
  if (t.text) return `text "${t.text}"`;
  if (t.testId) return `testId ${t.testId}`;
  if (t.placeholder) return `placeholder "${t.placeholder}"`;
  if (t.element) return `element ${t.element}`;
  return `css ${t.css}`;
}

export function resolveTarget(page: Page, t: Target, latest: ElementMap | null): Locator {
  let loc: Locator;
  if (t.role)
    loc = page.getByRole(t.role as Parameters<Page["getByRole"]>[0], {
      ...(t.name ? { name: t.name } : {}),
      exact: t.exact ?? false,
    });
  else if (t.label) loc = page.getByLabel(t.label, { exact: t.exact ?? false });
  else if (t.text) loc = page.getByText(t.text, { exact: t.exact ?? false });
  else if (t.testId) loc = page.getByTestId(t.testId);
  else if (t.placeholder) loc = page.getByPlaceholder(t.placeholder, { exact: t.exact ?? false });
  else if (t.element) {
    const el = latest?.elements.find((e) => e.id === t.element);
    if (!el) {
      throw new DemovieError(
        "E_CAPTURE",
        `element id "${t.element}" is not in the latest captured state`,
        "capture a state before this step, and use an id from its elements.json",
      );
    }
    loc = page.locator(el.selector);
  } else loc = page.locator(t.css!);
  return t.nth !== undefined ? loc.nth(t.nth) : loc.first();
}

function iou(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** Find the element map entry for a live element: same box (IoU ≥ 0.6), preferring interactive entries. */
export function matchElement(map: ElementMap | null, rect: Rect): ElementInfo | null {
  if (!map) return null;
  let best: { el: ElementInfo; score: number } | null = null;
  for (const el of map.elements) {
    const score = iou(el.bbox, rect) + (el.interactive ? 0.05 : 0);
    if (score >= 0.6 && (!best || score > best.score)) best = { el, score };
  }
  return best?.el ?? null;
}

export interface FlowRunOptions {
  project: Project;
  page: Page;
  baseUrl: string;
  viewportName: string;
  colorScheme: "light" | "dark";
  gitSha: string | null;
}

export interface FlowRunResult {
  run: FlowRun;
  states: StateCapture[];
  dir: string;
}

/** Run a YAML or TS flow, capturing its states and recording every action target (SPEC §9.7). */
export async function runFlow(def: Flow | TsFlowDefinition, options: FlowRunOptions): Promise<FlowRunResult> {
  const { project, page, baseUrl } = options;
  const config = project.resolved;
  const flowId = `flows/${def.name}@${options.viewportName}${options.colorScheme === "dark" ? ".dark" : ""}`;
  const tmpRoot = path.join(project.paths.capturesDir, "flows", `.tmp-${def.name}-${randomBytes(4).toString("hex")}`);
  const network = trackNetwork(page);
  const started = Date.now();
  const states: StateCapture[] = [];
  const stateNames: string[] = [];
  const steps: FlowRun["steps"] = [];
  let latest: StateCapture | null = null;
  const allowDestructive = Boolean(def.allowDestructive);

  const captureNamed = async (name: string, fullPage = false) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
      throw new DemovieError(
        "E_CONFIG",
        `capture name "${name}" must be lowercase letters, digits and dashes`,
        "rename the capture step",
      );
    // The mouse stays where the last click happened; park it unless the state is meant to show a hover.
    if (steps[steps.length - 1]?.action !== "hover") await page.mouse.move(0, 0);
    const settled = await settle(page, network, null);
    const stateOptions: CaptureStateOptions = {
      id: `${flowId}/${name}`,
      kind: "flow",
      config,
      viewportName: options.viewportName,
      colorScheme: options.colorScheme,
      route: null,
      flow: def.name,
      step: name,
      fullPage,
      gitSha: options.gitSha,
      baseUrl,
      warnings: settled.warnings,
      settled: true,
    };
    const state = await snapshotState(page, stateOptions);
    await writeState(path.dirname(tmpRoot), { ...state, id: path.join(path.basename(tmpRoot), name) });
    states.push(state);
    stateNames.push(name);
    latest = state;
  };

  const record = async (
    action: string,
    locator: Locator | null,
    description: string,
    perform: () => Promise<unknown>,
    value?: string,
  ) => {
    const t0 = Date.now();
    let target: FlowRun["steps"][number]["target"] = null;
    if (locator) {
      await locator.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {
        throw new DemovieError(
          "E_CAPTURE",
          `flow ${def.name}: ${description} not found on ${new URL(page.url()).pathname}`,
          "check the target in the flow file against the captured elements.json",
        );
      });
      const name = await locator
        .evaluate((el) =>
          (
            el.getAttribute("aria-label") ||
            (el as HTMLElement).innerText ||
            (el as HTMLInputElement).value ||
            el.textContent ||
            ""
          ).trim(),
        )
        .catch(() => "");
      if (!allowDestructive && (DESTRUCTIVE_TARGET.test(description) || DESTRUCTIVE_TARGET.test(name))) {
        throw new DemovieError(
          "E_CAPTURE",
          `flow ${def.name}: refusing destructive-looking step "${action} ${description}"${name ? ` ("${name.slice(0, 40)}")` : ""}`,
          "set `allowDestructive: true` in the flow if this really is safe on demo data",
        );
      }
      const rect: Rect = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
      });
      const latestState = latest as StateCapture | null;
      const match = matchElement(latestState?.elements ?? null, rect);
      target = { elementId: match?.id ?? null, bbox: match?.bbox ?? rect, description };
    }
    const latestName = stateNames[stateNames.length - 1] ?? null;
    await perform();
    steps.push({
      index: steps.length,
      action,
      description: locator ? `${action} ${description}` : description,
      state: latestName,
      target,
      ...(value !== undefined ? { value } : {}),
      url: page.url(),
      at: t0 - started,
      durationMs: Date.now() - t0,
    });
    if (action === "click" || action === "dblclick" || action === "press" || action === "goto") {
      await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
      await network.idle(300, 8000);
    }
  };

  try {
    await page.goto(appUrl(baseUrl, def.start), { waitUntil: "load", timeout: 60_000 });
    if ("steps" in def) {
      for (const step of def.steps) await runYamlStep(step, page, latest, captureNamed, record);
    } else {
      await def.run({
        page,
        capture: (name, o) => captureNamed(name, o?.fullPage ?? false),
        step: (action, locator, perform, value) =>
          record(action, locator, String(locator), () => perform(locator), value),
      });
    }
    const run: FlowRun = {
      name: def.name,
      viewport: options.viewportName,
      start: def.start,
      capturedAt: new Date().toISOString(),
      states: stateNames,
      steps,
    };
    await writeFile(path.join(tmpRoot, "flow.json"), stableJson(run));
    const finalDir = path.join(project.paths.capturesDir, flowId);
    await rm(finalDir, { recursive: true, force: true });
    await mkdir(path.dirname(finalDir), { recursive: true });
    await rename(tmpRoot, finalDir);
    return { run, states, dir: finalDir };
  } catch (error) {
    await rm(tmpRoot, { recursive: true, force: true });
    throw error;
  } finally {
    network.dispose();
  }
}

type Recorder = (
  action: string,
  locator: Locator | null,
  description: string,
  perform: () => Promise<unknown>,
  value?: string,
) => Promise<void>;

async function runYamlStep(
  step: FlowStep,
  page: Page,
  latest: StateCapture | null,
  captureNamed: (name: string, fullPage?: boolean) => Promise<void>,
  record: Recorder,
): Promise<void> {
  const action = stepAction(step);
  const s = step as Record<string, any>;
  const map = latest?.elements ?? null;
  switch (action) {
    case "capture": {
      const c = s.capture;
      await captureNamed(typeof c === "string" ? c : c.name, typeof c === "string" ? false : Boolean(c.fullPage));
      return;
    }
    case "goto":
      await record("goto", null, `goto ${s.goto}`, () =>
        page.goto(new URL(s.goto, page.url()).toString(), { waitUntil: "load" }),
      );
      return;
    case "wait":
      await record("wait", null, `wait ${s.wait}ms`, () => page.waitForTimeout(s.wait));
      return;
    case "waitFor": {
      const w = s.waitFor;
      if (w.url)
        await record("waitFor", null, `waitFor url ${w.url}`, () =>
          page.waitForURL((u) => u.pathname.includes(w.url), { timeout: 30_000 }),
        );
      else if (w.hidden)
        await record("waitFor", null, `waitFor hidden ${describeTarget(w.hidden)}`, () =>
          resolveTarget(page, w.hidden, map).waitFor({ state: "hidden", timeout: 30_000 }),
        );
      else
        await record("waitFor", null, `waitFor ${describeTarget(w)}`, () =>
          resolveTarget(page, w, map).waitFor({ state: "visible", timeout: 30_000 }),
        );
      return;
    }
    case "press": {
      const p = s.press;
      const key = typeof p === "string" ? p : p.key;
      const target = typeof p === "string" || !p.target ? null : resolveTarget(page, p.target, map);
      await record(
        "press",
        target,
        target ? describeTarget(p.target) : `press ${key}`,
        () => (target ? target.press(key) : page.keyboard.press(key)),
        key,
      );
      return;
    }
    case "scroll": {
      const sc = s.scroll;
      if (typeof sc === "number")
        await record("scroll", null, `scroll to ${sc}`, () => page.evaluate(`window.scrollTo(0, ${Number(sc)})`));
      else if (sc.to) {
        const loc = resolveTarget(page, sc.to, map);
        await record("scroll", loc, describeTarget(sc.to), () => loc.scrollIntoViewIfNeeded());
      } else await record("scroll", null, `scroll by ${sc.y ?? 0}`, () => page.mouse.wheel(sc.x ?? 0, sc.y ?? 0));
      return;
    }
    default: {
      const target = s[action] as Target & { value?: string | string[] };
      const loc = resolveTarget(page, target, map);
      const desc = describeTarget(target);
      if (action === "click") await record("click", loc, desc, () => loc.click());
      else if (action === "dblclick") await record("dblclick", loc, desc, () => loc.dblclick());
      else if (action === "hover") await record("hover", loc, desc, () => loc.hover());
      else if (action === "check") await record("check", loc, desc, () => loc.check());
      else if (action === "uncheck") await record("uncheck", loc, desc, () => loc.uncheck());
      else if (action === "fill")
        await record("fill", loc, desc, () => loc.fill(String(target.value)), String(target.value));
      else if (action === "select")
        await record(
          "select",
          loc,
          desc,
          () => loc.selectOption(target.value as string | string[]),
          String(target.value),
        );
    }
  }
}

export const FLOW_YAML_TEMPLATE = (
  name: string,
  start: string,
) => `# ${name}: a user flow demovie can replay and capture (SPEC §9.7).
# Targets: { role, name } · { label } · { text } · { testId } · { placeholder } · { css } · { element: <id from elements.json> }
# Steps: goto, click, dblclick, fill, press, hover, select, check, uncheck, scroll, wait, waitFor, capture
name: ${name}
start: ${start}
steps:
  - capture: start
  # - click: { role: button, name: New project }
  # - capture: dialog
  # - fill: { label: Project name, value: Q3 Launch }
  # - click: { role: button, name: Create }
  # - waitFor: { text: Q3 Launch }
  # - capture: created
`;

export const FLOW_TS_TEMPLATE = (name: string, start: string) => `import { defineFlow } from "demovie/flow";

// ${name}: a user flow demovie can replay and capture (SPEC §9.7).
export default defineFlow({
  name: "${name}",
  start: "${start}",
  run: async ({ page, capture, step }) => {
    await capture("start");
    // await step("click", page.getByRole("button", { name: "New project" }), (target) => target.click());
    // await capture("dialog");
  },
});
`;
