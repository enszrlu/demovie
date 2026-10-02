import { loadProject } from "@demovie/core";
import type { Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type StaticServer, startServer } from "../src/server.ts";
import { launchRenderer, openComposition, screenshot, seek } from "../src/session.ts";
import { resolveVideo } from "../src/video-dir.ts";
import { BASIC_COMPOSITION, syntheticProject } from "./synthetic.ts";

const EPOCH = Date.parse("2026-09-15T10:30:00.000Z");

async function serve(name: string, mainJs: string) {
  const p = syntheticProject(name, mainJs);
  const project = await loadProject(p.root);
  const video = await resolveVideo(project, p.videoDir, p.root);
  return { project, video, server: await startServer({ project, video }) };
}

describe("runtime in real Chromium (synthetic project)", () => {
  let browser: Browser;
  let server: StaticServer;
  beforeAll(async () => {
    browser = await launchRenderer();
    server = (await serve("rt-basic", BASIC_COMPOSITION)).server;
  });
  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("drives performance.now, Date, rAF and onSeek from the virtual clock", async () => {
    const comp = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
    try {
      await seek(comp.page, 2);
      const values = (await comp.page.evaluate(
        "[performance.now(), Date.now(), new Date().getTime(), window.__lastSeek, window.__seenRaf.length]",
      )) as number[];
      expect(values.slice(0, 4)).toEqual([2000, EPOCH + 2000, EPOCH + 2000, 2]);
      expect(values[4]).toBe(1); // the setup rAF ran once, during ready()'s seek(0)
      expect(await comp.page.evaluate("window.__seenRaf[0]")).toBe(0);
      expect(await comp.page.evaluate("setTimeout(() => {}, 10)")).toBe(0);
      const inspect = (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as { timersAfterReady: number };
      expect(inspect.timersAfterReady).toBe(1);
      const r1 = (await comp.page.evaluate("Math.random()")) as number;
      const comp2 = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
      await seek(comp2.page, 2);
      expect(await comp2.page.evaluate("Math.random()")).toBe(r1);
      await comp2.close();
    } finally {
      await comp.close();
    }
  });

  it("renders identical pixels regardless of seek order", async () => {
    const a = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
    const b = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
    try {
      for (const t of [0.6, 2.4, 3.4]) {
        await seek(a.page, t);
        const first = await screenshot(a.cdp, "png");
        await seek(b.page, 3.9);
        await seek(b.page, 0.1);
        await seek(b.page, t);
        const second = await screenshot(b.cdp, "png");
        expect(first.equals(second), `t=${t}`).toBe(true);
        await seek(a.page, t);
        expect((await screenshot(a.cdp, "png")).equals(first), `re-render t=${t}`).toBe(true);
      }
    } finally {
      await a.close();
      await b.close();
    }
  });

  it("inspect() reports text, shots, screens and truthful clicks", async () => {
    const comp = await openComposition(browser, server, { format: "16:9", scale: 1 });
    try {
      await seek(comp.page, 1);
      const early = (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as any;
      const title = early.texts.find((t: any) => t.text === "Shapes, measured.");
      expect(title).toMatchObject({ words: 2, ui: false, fontSize: 64, fontWeight: 600 });
      expect(early.shots.filter((s: any) => s.active).map((s: any) => s.id)).toEqual(["title"]);
      await seek(comp.page, 3);
      const late = (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as any;
      expect(late.shots.find((s: any) => s.id === "product")).toMatchObject({
        active: true,
        kind: "product",
        screens: 1,
      });
      expect(late.screens[0]).toMatchObject({ capture: "routes/demo@desktop", visible: true });
      expect(late.screens[0].cameraScale).toBeCloseTo(1.4, 2);
      const click = late.clicks[0];
      expect(click.elementId).toBe("button:create-shape");
      expect(click.point.x).toBeGreaterThanOrEqual(click.rect.x);
      expect(click.point.x).toBeLessThanOrEqual(click.rect.x + click.rect.width);
      expect(click.point.y).toBeGreaterThanOrEqual(click.rect.y);
      expect(click.point.y).toBeLessThanOrEqual(click.rect.y + click.rect.height);
      expect(late.fonts.loaded).toEqual(expect.arrayContaining(["Inter", "Geist"]));
      expect(late.strayTweens).toEqual([]);
      await seek(comp.page, 3.6);
      const typed = (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as any;
      expect(typed.texts.find((t: any) => t.text === "Circle")).toMatchObject({ ui: true });
    } finally {
      await comp.close();
    }
  });

  it("explains unknown element ids with the nearest valid ones", async () => {
    const bad = await serve(
      "rt-bad-id",
      `import { createVideo, screen } from "/__demovie/runtime.js";
const v = await createVideo();
const shot = v.shot("p", 0, 4, { kind: "product" });
const s = screen(v, { capture: "routes/demo@desktop", parent: shot.el });
s.focus("button:create-shap", { at: 1 });
v.ready();`,
    );
    try {
      await expect(
        openComposition(browser, bad.server, { format: "16:9", scale: 0.5, timeoutMs: 10_000 }),
      ).rejects.toThrow(/unknown element id "button:create-shap".*Nearest ids: button:create-shape/s);
    } finally {
      await bad.server.close();
    }
  });

  it("rect() with several ids returns the box around all of them", async () => {
    const multi = await serve(
      "rt-rect",
      `import { createVideo, screen } from "/__demovie/runtime.js";
const v = await createVideo();
const shot = v.shot("p", 0, 4, { kind: "product" });
const s = screen(v, { capture: "routes/demo@desktop", parent: shot.el });
window.__rects = [s.rect("button:create-shape"), s.rect("textbox:shape-name"), s.rect("button:create-shape", "textbox:shape-name")];
v.ready();`,
    );
    const comp = await openComposition(browser, multi.server, { format: "16:9", scale: 0.5 });
    try {
      type R = { x: number; y: number; width: number; height: number };
      const [button, textbox, both] = (await comp.page.evaluate("window.__rects")) as [R, R, R];
      const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
      near(both.x, Math.min(button.x, textbox.x));
      near(both.y, Math.min(button.y, textbox.y));
      near(both.x + both.width, Math.max(button.x + button.width, textbox.x + textbox.width));
      near(both.y + both.height, Math.max(button.y + button.height, textbox.y + textbox.height));
    } finally {
      await comp.close();
      await multi.server.close();
    }
  });

  it("flags stray GSAP tweens outside v.timeline", async () => {
    const stray = await serve(
      "rt-stray",
      `import { createVideo } from "/__demovie/runtime.js";
const v = await createVideo();
const shot = v.shot("t", 0, 4, { kind: "title" });
shot.el.innerHTML = "<p class='big'>Stray</p>";
v.gsap.to(shot.el.firstChild, { x: 100, duration: 1 });
v.ready();`,
    );
    const comp = await openComposition(browser, stray.server, { format: "16:9", scale: 0.5 });
    try {
      const result = (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as any;
      expect(result.strayTweens.length).toBe(1);
      expect(result.strayTweens[0].targets).toContain("p.big");
    } finally {
      await comp.close();
      await stray.server.close();
    }
  });
});

describe("inspect(): what a viewer can actually see", () => {
  it("does not report text that a mask reveal still hides", async () => {
    const { server } = await serve(
      "rt-mask",
      `import { createVideo, text } from "/__demovie/runtime.js";
const v = await createVideo();
const s = v.shot("t", 0, 4, { kind: "title" });
s.el.innerHTML = '<h1 class="big" id="h">Shapes — measured.</h1>';
text.reveal(s.el.querySelector("#h"), { at: 2, by: "line", from: "mask", duration: 0.6 });
v.ready();`,
    );
    const browser = await launchRenderer();
    try {
      const comp = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
      const visible = async (t: number) => {
        await seek(comp.page, t);
        const r = (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as {
          texts: { text: string; words: number }[];
        };
        return r.texts.map((x) => `${x.text} (${x.words})`);
      };
      expect(await visible(1)).toEqual([]);
      // a lone dash is not a word: no extra reading time
      expect(await visible(3)).toEqual(["Shapes — measured. (2)"]);
      await comp.close();
    } finally {
      await browser.close();
      await server.close();
    }
  });
});

describe("runtime helpers: callout, counter, captions, transitions", () => {
  it("renders every helper without errors and reports them through inspect()", async () => {
    const p = syntheticProject(
      "rt-helpers",
      `import { createVideo, screen, callout, captions, text, transition, logo } from "/__demovie/runtime.js";
const v = await createVideo();
const shots = ["a", "b", "c", "d", "e", "f"].map((id, i) => v.shot(id, i * 0.66, (i + 1) * 0.66 + (i === 5 ? 0.04 : 0), { kind: i === 1 ? "product" : "text" }));
shots[0].el.innerHTML = '<p class="big" id="n">0</p>';
text.counter(shots[0].el.querySelector("#n"), { at: 0, from: 0, to: 128, duration: 0.5 });
const s = screen(v, { capture: "routes/demo@desktop", parent: shots[1].el, device: "laptop" });
callout(s, "button:create-shape", { label: "Create shape", at: 0.7, duration: 0.5 });
shots[2].el.innerHTML = '<p class="big">Wipe</p>';
shots[3].el.innerHTML = '<p class="big">Push</p>';
shots[4].el.innerHTML = '<p class="big">Zoom</p>';
shots[5].el.innerHTML = '<p class="big">Flash</p>';
transition.crossfade(shots[0], shots[1], { at: 0.6, duration: 0.1 });
transition.wipe(shots[1], shots[2], { at: 1.26, duration: 0.1, direction: "left" });
transition.push(shots[2], shots[3], { at: 1.92, duration: 0.1, direction: "up" });
transition.zoomThrough(shots[3], shots[4], { at: 2.58, duration: 0.1 });
transition.colorFlash(shots[4], shots[5], { at: 3.24, duration: 0.2 });
logo(v, { at: 3.5, variant: "mark", parent: shots[5].el });
captions(v, { style: "karaoke" });
v.ready();`,
      {
        duration: 4,
        formats: ["9:16"],
        audio: { voice: { manifest: "audio/voice.json" } },
        captions: { enabled: true, burnIn: ["9:16"] },
      },
    );
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const path = await import("node:path");
    mkdirSync(path.join(p.videoDir, "audio"), { recursive: true });
    writeFileSync(
      path.join(p.videoDir, "audio", "voice.json"),
      JSON.stringify({
        provider: "openai",
        voice: "marin",
        lines: [
          {
            id: "l1",
            text: "Shapes, measured.",
            start: 0.2,
            duration: 1.2,
            file: "voice/l1.mp3",
            words: [
              { text: "Shapes,", start: 0, end: 0.5 },
              { text: "measured.", start: 0.5, end: 1.1 },
            ],
          },
        ],
      }),
    );
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const server = await startServer({ project, video });
    const browser = await launchRenderer();
    try {
      const comp = await openComposition(browser, server, { format: "9:16", scale: 0.5 });
      const at = async (t: number) => {
        await seek(comp.page, t);
        return (await comp.page.evaluate("window.__DEMOVIE__.inspect()")) as any;
      };
      expect((await at(0.6)).texts.find((x: any) => x.counter)?.text).toBe("128");
      const callout = (await at(0.9)).texts.find((x: any) => x.text === "Create shape");
      expect(callout).toMatchObject({ ui: false });
      const caption = (await at(0.8)).texts.find((x: any) => x.caption);
      expect(caption?.text).toContain("Shapes,");
      for (const [t, id] of [
        [1.5, "c"],
        [2.2, "d"],
        [2.9, "e"],
        [3.6, "f"],
      ] as const) {
        expect(
          (await at(t)).shots.filter((s: any) => s.active).map((s: any) => s.id),
          `t=${t}`,
        ).toContain(id);
      }
      // the wipe interpolates its clip-path (shot "c" enters from the right between 1.26 and 1.36)
      await seek(comp.page, 1.31);
      const clip = String(
        await comp.page.evaluate(`getComputedStyle(document.querySelector('[data-shot="c"]')).clipPath`),
      );
      const left = Number.parseFloat(clip.replace(/^inset\(/, "").split(" ")[3] ?? "NaN");
      expect(left, clip).toBeGreaterThan(5);
      expect(left, clip).toBeLessThan(95);
      const end = await at(3.9);
      expect(end.transitions.length).toBe(5);
      expect(end.logos[0].visible).toBe(true);
      expect(comp.console.filter((m) => m.type !== "warning")).toEqual([]);
      await comp.close();
    } finally {
      await browser.close();
      await server.close();
    }
  });
});
