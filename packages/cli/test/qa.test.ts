import { describe, expect, it } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { run as newVideo } from "../src/commands/new.ts";
import { run as qa } from "../src/commands/qa.ts";
import { createContext } from "../src/context.ts";

describe("qa command", () => {
  it("rejects unknown videos, formats and sampling rates with a fix hint", async () => {
    const p = syntheticProject("unit-qa", "");
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    await expect(qa(ctx, "missing", {})).rejects.toMatchObject({
      code: "E_NOT_FOUND",
      fix: expect.stringContaining("demovie new missing"),
    });
    await newVideo(ctx, "launch", { type: "launch" });
    await expect(qa(ctx, "launch", { format: "1:1" })).rejects.toMatchObject({
      code: "E_USAGE",
      fix: expect.stringContaining("--format 16:9"),
    });
    await expect(qa(ctx, "launch", { fps: 0 })).rejects.toMatchObject({
      code: "E_USAGE",
      fix: expect.stringContaining("--fps between 1 and"),
    });
  });
});
