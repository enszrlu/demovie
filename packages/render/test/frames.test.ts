import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadProject } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { markFrames, pruneFrames, renderId } from "../src/frames.ts";
import { resolveVideo } from "../src/video-dir.ts";
import { syntheticProject } from "./synthetic.ts";

const OPTS = { format: "16:9", scale: 0.5, fps: 30, type: "jpeg" } as const;

describe("frame cache", () => {
  it("changes the render id when a logo, an asset or a capture the composition names changes", async () => {
    const p = syntheticProject("unit-frames-id", `const id = "routes/demo@desktop";`);
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const base = await renderId(project, video, OPTS);
    expect(await renderId(project, video, OPTS)).toBe(base);

    writeFileSync(path.join(p.root, ".demovie/brand/logo.svg"), "<svg viewBox='0 0 1 1'/>");
    const withLogo = await renderId(project, video, OPTS);
    expect(withLogo).not.toBe(base);

    mkdirSync(path.join(p.root, ".demovie/assets"), { recursive: true });
    writeFileSync(path.join(p.root, ".demovie/assets/hero.png"), "x");
    const withAsset = await renderId(project, video, OPTS);
    expect(withAsset).not.toBe(withLogo);

    // the composition names routes/demo@desktop, so its screenshot is part of the id
    writeFileSync(path.join(p.root, ".demovie/captures/routes/demo@desktop/screen.png"), "changed");
    expect(await renderId(project, video, OPTS)).not.toBe(withAsset);
  });

  it("prunes only this video's earlier frame sets", async () => {
    const p = syntheticProject("unit-frames-prune", "");
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const frames = path.join(p.root, ".demovie/.cache/frames");
    await markFrames(project, video, "old");
    await markFrames(project, video, "new");
    mkdirSync(path.join(frames, "other-video"), { recursive: true });
    writeFileSync(path.join(frames, "other-video/video.txt"), "videos/other\n");
    expect(await pruneFrames(project, video, new Set(["new"]))).toBe(1);
    expect(existsSync(path.join(frames, "old"))).toBe(false);
    expect(existsSync(path.join(frames, "new"))).toBe(true);
    expect(existsSync(path.join(frames, "other-video"))).toBe(true);
  });
});
