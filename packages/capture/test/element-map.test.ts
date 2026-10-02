import type { ElementMap } from "@demovie/core";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "../src/browser.ts";
import { INNER_SCROLL_SCRIPT } from "../src/capture-state.ts";
import { DECODE_SCRIPT, ELEMENT_MAP_SCRIPT } from "../src/element-map.ts";
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

  it("waits for on-screen images only, so a lazy image below the fold can't hang a capture", async () => {
    await page.setContent(
      `<p>hi</p><img alt="far" loading="lazy" src="http://127.0.0.1:9/never.png" style="display:block;margin-top:5000px;width:10px;height:10px">`,
    );
    const started = Date.now();
    expect(await page.evaluate(`(${DECODE_SCRIPT})()`)).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("measures how much an app shell's scrolling main overflows, for full-page shots", async () => {
    await page.setContent(
      `<body style="margin:0"><div style="height:100vh;display:flex;flex-direction:column"><main style="flex:1;overflow-y:auto"><div style="height:2000px"></div></main><nav style="height:64px"></nav></div></body>`,
    );
    // 2000px of content in a main that is 800 - 64 = 736px tall
    expect(await page.evaluate(`(${INNER_SCROLL_SCRIPT})()`)).toBe(2000 - 736);
    await page.setContent(`<body style="margin:0"><div style="height:3000px"></div></body>`);
    expect(await page.evaluate(`(${INNER_SCROLL_SCRIPT})()`)).toBe(0);
  });

  it("redacts inside shadow roots and same-origin iframes, the title and mailto links", async () => {
    await page.setContent(`<title>Invite pat.doe@corp.test</title>
      <p>light: lee@corp.test</p><div id="host"></div>
      <a href="mailto:kim@corp.test">Email us</a>
      <iframe srcdoc="<p>frame: ann@corp.test</p>"></iframe>`);
    await page.evaluate(() => {
      const root = document.getElementById("host")!.attachShadow({ mode: "open" });
      root.innerHTML = "<span>shadow: max@corp.test</span>";
    });
    await page.waitForFunction(() =>
      document.querySelector("iframe")?.contentDocument?.body?.textContent?.includes("ann"),
    );
    const counts = (await page.evaluate(
      `(${REDACT_SCRIPT})(${JSON.stringify({ patterns: serializePatterns(["email"]), allow: ["^lee@corp\\.test$"], mode: "fictional", selectors: [] })})`,
    )) as Record<string, number>;
    const seen = await page.evaluate(() => ({
      title: document.title,
      href: document.querySelector("a")!.getAttribute("href"),
      shadow: document.getElementById("host")!.shadowRoot!.textContent,
      frame: document.querySelector("iframe")!.contentDocument!.body.textContent,
      light: document.querySelector("p")!.textContent,
    }));
    expect(JSON.stringify(seen)).not.toMatch(/pat\.doe@|kim@|max@|ann@/);
    expect(seen.light).toContain("lee@corp.test"); // allow-listed
    expect(counts.email).toBe(4);
  });

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
