/** A tiny self-contained project for runtime/renderer tests: one synthetic capture and a composition. */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { repoRoot } from "../../../scripts/lib/repo.ts";

export interface SyntheticProject {
  root: string;
  videoDir: string;
}

function png(
  width: number,
  height: number,
  rects: { x: number; y: number; w: number; h: number; rgb: [number, number, number] }[],
): Buffer {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let rgb: [number, number, number] = [248, 250, 252];
      for (const r of rects) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) rgb = r.rgb;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(img);
}

const element = (
  id: string,
  role: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: object = {},
) => ({
  id,
  role,
  name,
  tag: role === "button" ? "button" : role === "textbox" ? "input" : "div",
  selector: `#${id.replace(/[^a-z0-9]/gi, "-")}`,
  bbox: { x, y, width, height },
  visible: true,
  interactive: role === "button" || role === "textbox",
  inViewport: true,
  style: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 500,
    color: "#0f172a",
    background: role === "button" ? "#155dfc" : "#ffffff",
    radius: 6,
    lineHeight: 20,
    paddingLeft: 10,
    paddingTop: 8,
  },
  ...extra,
});

/** Create `.tmp/<name>/` with `.demovie/` (config, brand, glossary, one capture) and `video/` with the given main.js. */
export function syntheticProject(name: string, mainJs: string, video: Record<string, unknown> = {}): SyntheticProject {
  const root = path.join(repoRoot, ".tmp", name);
  rmSync(root, { recursive: true, force: true });
  const demovie = path.join(root, ".demovie");
  const cap = path.join(demovie, "captures", "routes", "demo@desktop");
  mkdirSync(cap, { recursive: true });
  mkdirSync(path.join(demovie, "brand"), { recursive: true });
  writeFileSync(
    path.join(demovie, "config.json"),
    JSON.stringify({
      version: 1,
      project: { name: "Synthetica", framework: "generic" },
      app: { url: "http://localhost:9" },
      demo: { now: "2026-09-15T10:30:00.000Z" },
    }),
  );
  writeFileSync(
    path.join(demovie, "brand", "brand.json"),
    JSON.stringify({
      name: "Synthetica",
      tagline: "Shapes, measured.",
      url: "https://synthetica.example",
      colors: {
        light: {
          background: "#ffffff",
          foreground: "#0a0a0a",
          primary: "#155dfc",
          primaryForeground: "#ffffff",
          secondary: null,
          accent: null,
          muted: "#f4f4f5",
          mutedForeground: "#52525b",
          border: "#e4e4e7",
          ring: null,
          chart: [],
        },
        dark: null,
      },
      fonts: { heading: null, body: null, mono: null },
    }),
  );
  writeFileSync(
    path.join(demovie, "glossary.json"),
    JSON.stringify({
      productName: "Synthetica",
      tagline: "Shapes, measured.",
      features: [],
      uiLabels: ["Create shape"],
      entities: [],
      people: [],
      ctaUrl: "synthetica.example",
      avoid: [],
    }),
  );
  // Capture: 800×500 CSS px at dpr 2 → a 1600×1000 screenshot with a blue button and an input.
  writeFileSync(
    path.join(cap, "screen.png"),
    png(1600, 1000, [
      { x: 1200, y: 80, w: 320, h: 80, rgb: [21, 93, 252] },
      { x: 200, y: 400, w: 800, h: 90, rgb: [255, 255, 255] },
      { x: 200, y: 700, w: 1200, h: 200, rgb: [226, 232, 240] },
    ]),
  );
  writeFileSync(
    path.join(cap, "elements.json"),
    JSON.stringify({
      captureId: "routes/demo@desktop",
      url: "http://localhost:9/demo",
      viewport: { width: 800, height: 500, deviceScaleFactor: 2 },
      document: { width: 800, height: 500 },
      elements: [
        element("button:create-shape", "button", "Create shape", 600, 40, 160, 40),
        element("textbox:shape-name", "textbox", "Shape name", 100, 200, 400, 45),
        element("dm:canvas", "generic", "", 100, 350, 600, 100, { demovie: "canvas" }),
      ],
    }),
  );
  writeFileSync(
    path.join(cap, "meta.json"),
    JSON.stringify({
      id: "routes/demo@desktop",
      kind: "route",
      url: "http://localhost:9/demo",
      path: "/demo",
      route: "/demo",
      title: "Demo",
      viewport: { name: "desktop", width: 800, height: 500, deviceScaleFactor: 2, isMobile: false },
      dpr: 2,
      colorScheme: "light",
      capturedAt: "2026-09-15T10:30:00.000Z",
      gitSha: null,
      redactions: {},
      warnings: [],
      fullPage: null,
      image: { width: 1600, height: 1000 },
    }),
  );
  const videoDir = path.join(root, "video");
  mkdirSync(path.join(videoDir, "composition"), { recursive: true });
  writeFileSync(
    path.join(videoDir, "video.json"),
    JSON.stringify({
      slug: "synthetic",
      title: "Synthetic",
      type: "teaser",
      fps: 30,
      duration: 4,
      formats: ["16:9", "9:16"],
      style: "clean",
      captures: ["routes/demo@desktop"],
      ...video,
    }),
  );
  writeFileSync(
    path.join(videoDir, "composition", "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><script src="/__demovie/clock.js"></script><link rel="stylesheet" href="/__demovie/runtime.css"><link rel="stylesheet" href="./styles.css"></head><body><div id="stage"></div><script type="module" src="./main.js"></script></body></html>`,
  );
  writeFileSync(
    path.join(videoDir, "composition", "styles.css"),
    ".big{position:absolute;left:10%;top:12%;font:600 64px/1.1 var(--dm-font-heading);color:var(--dm-fg)}\n",
  );
  writeFileSync(path.join(videoDir, "composition", "main.js"), mainJs);
  return { root, videoDir };
}

export const BASIC_COMPOSITION = `
import { createVideo, screen, cursor, text, typeText } from "/__demovie/runtime.js";
const v = await createVideo();
const a = v.shot("title", 0, 1.5, { kind: "title" });
a.el.innerHTML = '<h1 class="big">Shapes, measured.</h1>';
text.reveal(a.el.querySelector("h1"), { at: 0.1, by: "word" });
const b = v.shot("product", 1.5, 4, { kind: "product" });
const s = screen(v, { capture: "routes/demo@desktop", parent: b.el });
s.focus("button:create-shape", { at: 2, duration: 0.6, scale: 1.4 });
const c = cursor(v);
c.moveTo(s, "button:create-shape", { at: 2.2, duration: 0.6 });
c.click({ at: 3 });
s.reset({ at: 3.05, duration: 0.05 });
typeText(s, "textbox:shape-name", "Circle", { at: 3.1, cps: 20 });
window.__seenRaf = [];
requestAnimationFrame((ts) => window.__seenRaf.push(ts));
v.onSeek((t) => { window.__lastSeek = t; });
v.ready();
`;
