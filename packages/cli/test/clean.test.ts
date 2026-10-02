import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { run as clean, formatBytes } from "../src/commands/clean.ts";
import { createContext } from "../src/context.ts";

describe("demovie clean", () => {
  it("frees the frame cache, keeps the voiceover cache, and --all also clears logs", async () => {
    const p = syntheticProject("unit-clean", "");
    const cache = path.join(p.root, ".demovie", ".cache");
    const put = (rel: string, bytes: number) => {
      mkdirSync(path.dirname(path.join(cache, rel)), { recursive: true });
      writeFileSync(path.join(cache, rel), Buffer.alloc(bytes));
    };
    put("frames/abc123/16x9/000001.png", 4096);
    put("frames/abc123/16x9/000002.png", 4096);
    put("voice/line.mp3", 1000);
    put("make/2026-10-02.jsonl", 100);
    const ctx = createContext({ cwd: p.root, yes: true, json: true });

    const dry = await clean(ctx, { dryRun: true });
    expect(dry.data).toMatchObject({ dryRun: true, freedBytes: 8192 });
    expect(existsSync(path.join(cache, "frames"))).toBe(true);

    const result = await clean(ctx, {});
    expect(result.data).toMatchObject({ freedBytes: 8192, removed: [{ path: ".demovie/.cache/frames", bytes: 8192 }] });
    expect(existsSync(path.join(cache, "frames"))).toBe(false);
    expect(existsSync(path.join(cache, "make"))).toBe(true);

    await clean(ctx, { all: true });
    expect(existsSync(path.join(cache, "make"))).toBe(false);
    expect(existsSync(path.join(cache, "voice", "line.mp3"))).toBe(true);
    expect((await clean(ctx, {})).human).toEqual(["nothing to clean"]);
  });

  it("formats sizes for people", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(formatBytes(7.34 * 1024 ** 3)).toBe("7.3 GB");
  });
});
