import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { FORMATS, type FormatId, loadProject } from "@demovie/core";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "../../../scripts/lib/repo.ts";
import { ensureHarborlyCaptures, HARBORLY_DIR } from "../../../scripts/test/harborly.ts";
import { probe } from "../src/encode.ts";
import { startPreview } from "../src/preview.ts";
import { render } from "../src/render.ts";
import { startServer } from "../src/server.ts";
import { launchRenderer, openComposition, screenshot, seek } from "../src/session.ts";
import { renderStills } from "../src/stills.ts";
import { resolveVideo } from "../src/video-dir.ts";
import { BASIC_COMPOSITION, syntheticProject } from "./synthetic.ts";

describe("renderer (synthetic project)", () => {
  const p = syntheticProject("it-render", BASIC_COMPOSITION);

  for (const quality of ["draft", "final"] as const) {
    it(`renders ${quality} MP4s for 16:9 and 9:16 that pass the ffprobe assertions`, async () => {
      const project = await loadProject(p.root);
      const video = await resolveVideo(project, p.videoDir, p.root);
      const report = await render(project, video, { formats: ["16:9", "9:16"], quality, gif: quality === "final" });
      const scale = quality === "draft" ? 0.5 : 1;
      const fps = quality === "draft" ? 15 : 30;
      expect(report.outputs).toHaveLength(2);
      for (const out of report.outputs) {
        const info = await probe(out.file);
        const size = FORMATS[out.format as FormatId];
        expect(info).toMatchObject({
          codec: "h264",
          profile: "High",
          pixFmt: "yuv420p",
          width: size.width * scale,
          height: size.height * scale,
          colorPrimaries: "bt709",
          colorTransfer: "bt709",
          colorSpace: "bt709",
        });
        expect(info.fps).toBe(fps);
        expect(Math.abs(info.duration - 4)).toBeLessThanOrEqual(1 / fps);
        expect(info.audio).toMatchObject({ codec: "aac", sampleRate: 48000, channels: 2 });
        expect(existsSync(out.poster)).toBe(true);
      }
      if (quality === "final") expect(report.gif && statSync(report.gif).size).toBeGreaterThan(1000);
      // A second render reuses every cached frame.
      const again = await render(project, video, { formats: ["16:9"], quality });
      expect(again.outputs[0]).toMatchObject({ reusedFrames: again.outputs[0]!.frames, renderedFrames: 0 });
    });
  }

  it("writes stills and a contact sheet", async () => {
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const report = await renderStills(project, video, { formats: ["16:9", "9:16"], times: [0.5, 2, 3.5], sheet: true });
    expect(report.stills).toHaveLength(6);
    expect(report.stills.find((s) => s.t === 2 && s.format === "16:9")?.shots).toEqual(["product"]);
    for (const s of report.stills) {
      const png = PNG.sync.read(readFileSync(s.file));
      expect([png.width, png.height]).toEqual(s.format === "16:9" ? [960, 540] : [540, 960]);
    }
    expect(report.sheets).toHaveLength(2);
    for (const sheet of report.sheets) expect(PNG.sync.read(readFileSync(sheet.file)).width).toBeGreaterThan(800);
  });

  it("serves the preview player and hot-reloads on changes", async () => {
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const preview = await startPreview(project, video);
    try {
      const page = await fetch(preview.url);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("demovie preview");
      expect((await fetch(`${preview.origin}/main.js`)).status).toBe(200);
      expect((await fetch(`${preview.origin}/__demovie/runtime.js`)).status).toBe(200);
      expect((await fetch(`${preview.origin}/../../etc/passwd`)).status).not.toBe(200);
      const events = await fetch(`${preview.origin}/__preview/events`);
      const reader = events.body!.getReader();
      await reader.read(); // ": connected"
      await appendFile(path.join(p.videoDir, "composition", "styles.css"), "\n/* touched */\n");
      const chunk = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
      expect(chunk && new TextDecoder().decode(chunk.value)).toContain("event: reload");
      await reader.cancel();
    } finally {
      await preview.close();
    }
  });
});

describe("clean-launch reference composition (Harborly captures)", () => {
  const dir = path.join(repoRoot, "examples", "compositions", "clean-launch");
  const goldensDir = path.join(dir, "goldens");
  const times = [2, 7.5, 12.5, 16, 24, 33];
  beforeAll(async () => {
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")) as { captures: string[] };
    await ensureHarborlyCaptures(video.captures);
  });

  it("is deterministic: the same frame twice and in different seek orders", async () => {
    const project = await loadProject(HARBORLY_DIR);
    const video = await resolveVideo(project, dir, HARBORLY_DIR);
    const server = await startServer({ project, video });
    const browser = await launchRenderer();
    try {
      const a = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
      const b = await openComposition(browser, server, { format: "16:9", scale: 0.5 });
      for (const t of [6.9, 11.8, 14.6, 31.2]) {
        await seek(a.page, t);
        const first = await screenshot(a.cdp, "png");
        await seek(a.page, t);
        const repeat = await screenshot(a.cdp, "png");
        await seek(b.page, 34);
        await seek(b.page, 0.5);
        await seek(b.page, t);
        const shuffled = await screenshot(b.cdp, "png");
        expect(first.equals(repeat), `repeat t=${t}`).toBe(true);
        expect(first.equals(shuffled), `order t=${t}`).toBe(true);
      }
      await a.close();
      await b.close();
    } finally {
      await browser.close();
      await server.close();
    }
  });

  it("matches the golden stills on this platform (pnpm test:update-goldens refreshes them)", async () => {
    const project = await loadProject(HARBORLY_DIR);
    const video = await resolveVideo(project, dir, HARBORLY_DIR);
    const report = await renderStills(project, video, { formats: ["16:9", "9:16"], times, scale: 0.5 });
    const manifestFile = path.join(goldensDir, "manifest.json");
    const platform = `${process.platform}-${process.arch}`;
    if (process.env.DEMOVIE_UPDATE_GOLDENS === "1") {
      mkdirSync(goldensDir, { recursive: true });
      for (const s of report.stills)
        writeFileSync(path.join(goldensDir, `${s.format.replace(":", "x")}-t${s.t}.png`), readFileSync(s.file));
      writeFileSync(
        manifestFile,
        `${JSON.stringify({ platform, times, scale: 0.5, threshold: 0.1, maxDiffRatio: 0.002 }, null, 2)}\n`,
      );
    }
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
      platform: string;
      maxDiffRatio: number;
      threshold: number;
    };
    if (manifest.platform !== platform) {
      console.warn(`goldens were recorded on ${manifest.platform}; skipping the pixel comparison on ${platform}`);
      return;
    }
    expect(readdirSync(goldensDir).filter((f) => f.endsWith(".png"))).toHaveLength(report.stills.length);
    for (const s of report.stills) {
      const golden = PNG.sync.read(readFileSync(path.join(goldensDir, `${s.format.replace(":", "x")}-t${s.t}.png`)));
      const actual = PNG.sync.read(readFileSync(s.file));
      expect([actual.width, actual.height]).toEqual([golden.width, golden.height]);
      const diff = pixelmatch(golden.data, actual.data, undefined, golden.width, golden.height, {
        threshold: manifest.threshold,
      });
      expect(diff / (golden.width * golden.height), `${s.format} t=${s.t}`).toBeLessThanOrEqual(manifest.maxDiffRatio);
    }
  });
});
