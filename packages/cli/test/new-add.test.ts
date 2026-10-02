import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { run as add } from "../src/commands/add.ts";
import { run as newVideo } from "../src/commands/new.ts";
import { createContext } from "../src/context.ts";

describe("new + add", () => {
  it("scaffolds a video folder from the type preset and style template", async () => {
    const p = syntheticProject("unit-new", "");
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const result = await newVideo(ctx, "launch", { type: "launch", style: "bold", about: "Shapes" });
    const dir = path.join(p.root, ".demovie", "videos", "launch");
    for (const f of [
      "brief.md",
      "storyboard.md",
      "video.json",
      "composition/index.html",
      "composition/main.js",
      "composition/styles.css",
    ]) {
      expect(existsSync(path.join(dir, f)), f).toBe(true);
    }
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(video).toMatchObject({
      slug: "launch",
      type: "launch",
      duration: 35,
      formats: ["16:9", "9:16"],
      style: "bold",
      status: "brief",
    });
    expect((result.data as { capture: string | null }).capture).toBe("routes/demo@desktop");
    const main = readFileSync(path.join(dir, "composition/main.js"), "utf8");
    expect(main).toContain('capture: "routes/demo@desktop"');
    expect(main).toContain('"power4.out"');
    expect(main).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(readFileSync(path.join(dir, "brief.md"), "utf8")).toMatch(/^---\ntype: launch\nduration: 35/);
    await expect(newVideo(ctx, "launch", { type: "launch" })).rejects.toMatchObject({ code: "E_USAGE" });
    await expect(newVideo(ctx, "short", { type: "launch", duration: 5 })).rejects.toThrow(/25–50/);
  });

  it("starts from the capture that matches --about, and points $schema at unpkg when demovie isn't installed", async () => {
    const p = syntheticProject("unit-new-about", "");
    const routes = path.join(p.root, ".demovie/captures/routes");
    const billing = path.join(routes, "settings-billing@desktop");
    cpSync(path.join(routes, "demo@desktop"), billing, { recursive: true });
    const edit = (file: string, change: (json: Record<string, unknown>) => void) => {
      const json = JSON.parse(readFileSync(path.join(billing, file), "utf8"));
      change(json);
      writeFileSync(path.join(billing, file), JSON.stringify(json));
    };
    edit("meta.json", (m) => Object.assign(m, { id: "routes/settings-billing@desktop", path: "/settings/billing" }));
    edit("elements.json", (m) => {
      m.captureId = "routes/settings-billing@desktop";
      (m.elements as { id: string; role: string; name: string }[])[0]!.role = "heading";
      (m.elements as { id: string; role: string; name: string }[])[0]!.name = "Plans and invoices";
    });
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const capture = async (slug: string, about?: string) =>
      ((await newVideo(ctx, slug, { type: "launch", about })).data as { capture: string | null }).capture;
    // the shallower page wins by default; --about steers the pick by path or heading
    expect(await capture("plain")).toBe("routes/demo@desktop");
    expect(await capture("billing", "New billing settings")).toBe("routes/settings-billing@desktop");
    expect(await capture("invoices", "Invoices")).toBe("routes/settings-billing@desktop");
    const video = JSON.parse(readFileSync(path.join(p.root, ".demovie/videos/billing/video.json"), "utf8"));
    expect(video.$schema).toMatch(/^https:\/\/unpkg\.com\/demovie@[\w.-]+\/schema\/video\.schema\.json$/);
  });

  it("imports images, transcodes video to WebM and requires --licensed for audio", async () => {
    const p = syntheticProject("unit-add", "");
    const src = path.join(p.root, "src");
    mkdirSync(src, { recursive: true });
    writeFileSync(
      path.join(src, "Hero Shot.png"),
      readFileSync(path.join(p.root, ".demovie/captures/routes/demo@desktop/screen.png")),
    );
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x180:rate=10",
      "-t",
      "1",
      "-pix_fmt",
      "yuv420p",
      path.join(src, "clip.mp4"),
    ]);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      path.join(src, "jingle.wav"),
    ]);
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    await expect(add(ctx, ["src/jingle.wav"], {})).rejects.toMatchObject({
      code: "E_USAGE",
      fix: expect.stringContaining("--licensed"),
    });
    const result = await add(ctx, ["src/Hero Shot.png", "src/clip.mp4", "src/jingle.wav"], {
      licensed: true,
      describe: "Fixture media",
    });
    const added = (result.data as { added: { file: string; kind: string; width?: number; duration?: number }[] }).added;
    expect(added.map((a) => [a.file, a.kind])).toEqual([
      ["hero-shot.png", "image"],
      ["clip.webm", "video"],
      ["jingle.wav", "audio"],
    ]);
    expect(added[0]?.width).toBe(1600);
    expect(added[1]?.duration).toBeCloseTo(1, 0);
    const provenance = JSON.parse(readFileSync(path.join(p.root, ".demovie/assets/provenance.json"), "utf8"));
    expect(provenance.files).toEqual([
      expect.objectContaining({ file: "jingle.wav", generator: "user-licensed", kind: "import" }),
    ]);
    const assets = JSON.parse(readFileSync(path.join(p.root, ".demovie/assets.json"), "utf8"));
    expect(assets.assets).toHaveLength(3);
  });
});
