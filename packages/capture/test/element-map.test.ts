import type { ElementMap } from "@demovie/core";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "../src/browser.ts";
import { ELEMENT_MAP_SCRIPT } from "../src/element-map.ts";
import { REDACT_SCRIPT, serializePatterns } from "../src/redact.ts";

const HTML = `<!doctype html><html><head><style>body{font-family:Arial;margin:0} .hidden{display:none}</style></head><body>
<header><nav aria-label="Main"><a href="/app">Dashboard</a><a href="/app/projects">Projects</a></nav></header>
<main>
  <h1>Projects board</h1>
  <a href="/app/projects/new" data-testid="new-project" style="background:rgb(21,93,252);color:#fff;border-radius:8px;padding:8px 12px">New project</a>
  <button>Filter</button><button>Filter</button>
  <div data-demovie="projects-board" style="width:600px;height:200px"><section data-testid="project-card">Q3 Launch</section></div>
  <label for="email">Email</label><input id="email" value="maya.chen@acme-rockets.example">
  <input aria-label="API key" value="sk\u005flive_51HbX9qLmT4vR2cK8nWd3pZ7" readonly>
  <p>Owner: demo@harborly.demo · +1 (415) 555-0132</p>
  <button class="hidden">Ghost</button>
  <div data-testid="velocity-chart" style="width:300px;height:120px"></div>
  <table><tr><td>Maya Chen</td><td>Head of Product</td></tr></table>
  <img alt="Acme Rockets logo" width="40" height="20" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
</main></body></html>`;

describe("element map + in-page redaction (real Chromium)", () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => {
    browser = await launchChromium();
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  });
  afterAll(async () => browser?.close());

  const map = async () =>
    (await page.evaluate(`(${ELEMENT_MAP_SCRIPT})()`)) as Pick<ElementMap, "elements" | "viewport" | "document">;

  it("builds stable ids from roles, names, test ids and data-demovie", async () => {
    await page.setContent(HTML);
    const first = await map();
    const ids = first.elements.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "banner",
        "navigation:main",
        "link:dashboard",
        "link:projects",
        "main",
        "heading:projects-board",
        "link:new-project",
        "button:filter",
        "button:filter#2",
        "dm:projects-board",
        "generic:project-card",
        "textbox:email",
        "textbox:api-key",
        "generic:velocity-chart",
        "row:maya-chen-head-of-product",
        "img:acme-rockets-logo",
      ]),
    );
    expect(ids).not.toContain("button:ghost");
    const newProject = first.elements.find((e) => e.id === "link:new-project")!;
    expect(newProject).toMatchObject({
      role: "link",
      name: "New project",
      testId: "new-project",
      selector: '[data-testid="new-project"]',
      interactive: true,
      inViewport: true,
      landmark: "main",
    });
    expect(newProject.style.background).toBe("#155dfc");
    expect(newProject.style.radius).toBe(8);
    expect(first.elements.find((e) => e.id === "heading:projects-board")?.level).toBe(1);
    // Same page, captured again: identical ids and boxes.
    await page.setContent(HTML);
    const second = await map();
    expect(second.elements.map((e) => [e.id, e.bbox])).toEqual(first.elements.map((e) => [e.id, e.bbox]));
  });

  it("redacts text nodes and input values before the map is built", async () => {
    await page.setContent(HTML);
    const counts = (await page.evaluate(
      `(${REDACT_SCRIPT})(${JSON.stringify({ patterns: serializePatterns(["email", "phone", "secret"]), allow: ["^.*@harborly\\.demo$"], mode: "fictional", selectors: ["[data-testid=velocity-chart]"] })})`,
    )) as Record<string, number>;
    expect(counts).toEqual({ email: 1, phone: 1, secret: 1, selector: 1 });
    const after = await map();
    expect(after.elements.find((e) => e.id === "textbox:email")?.value).not.toContain("acme-rockets");
    expect(after.elements.find((e) => e.id === "textbox:api-key")?.value).toMatch(/^sk_live_•+$/);
    const text = await page.textContent("p");
    expect(text).toContain("demo@harborly.demo");
    expect(text).not.toContain("415");
  });
});
