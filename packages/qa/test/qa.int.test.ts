import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadProject, QaFileSchema } from "@demovie/core";
import { launchRenderer, resolveVideo, startPreview } from "@demovie/render";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../../../scripts/lib/repo.ts";
import { HARBORLY_DIR } from "../../../scripts/test/harborly.ts";
import { runQa } from "../src/engine.ts";

describe("qa end to end (bad-text fixture)", () => {
  const dir = path.join(repoRoot, "examples/compositions/bad-text");

  it("writes qa.json with fix hints and the intended failures, and the preview overlays them", async () => {
    const project = await loadProject(HARBORLY_DIR);
    const video = await resolveVideo(project, dir, HARBORLY_DIR);
    const qa = await runQa(project, video, { formats: ["16:9"] });
    const file = path.join(dir, "qa.json");
    expect(existsSync(file)).toBe(true);
    const saved = QaFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    expect(saved.reports[0]?.sampledFps).toBe(10);
    const failed = saved.reports[0]!.rules.filter((r) => r.status === "fail");
    expect(failed.map((r) => r.id)).toEqual(expect.arrayContaining(["DM-T01", "DM-T02", "DM-T03", "DM-T04", "DM-T05"]));
    for (const r of failed) expect(r.fix.length).toBeGreaterThan(20);
    expect(qa.summary.errors).toBeGreaterThan(0);

    const t02 = failed.find((r) => r.id === "DM-T02")!.occurrences[0]!;
    const preview = await startPreview(project, video);
    const browser = await launchRenderer();
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${preview.url}?t=${t02.t + 0.5}`);
      await page.waitForFunction("document.getElementById('status')?.textContent === 'ready'", undefined, {
        timeout: 60_000,
      });
      await page.waitForFunction("document.querySelectorAll('#qa .qa').length > 0", undefined, { timeout: 10_000 });
      const labels = await page.$$eval("#qa .qa span", (spans) => spans.map((s) => s.textContent ?? ""));
      expect(labels.some((l) => l.startsWith("DM-T02"))).toBe(true);
    } finally {
      await browser.close();
      await preview.close();
    }
  });
});
