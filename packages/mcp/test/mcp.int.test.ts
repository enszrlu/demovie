import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../../../scripts/lib/repo.ts";
import { BASIC_COMPOSITION, syntheticProject } from "../../render/test/synthetic.ts";
import { EXPECTED_TOOLS, runMcpSmoke } from "./smoke.ts";

describe("demovie mcp (stdio)", () => {
  it("lists every tool, answers status and returns stills as images with progress", async () => {
    const p = syntheticProject("int-mcp", BASIC_COMPOSITION);
    const result = await runMcpSmoke({
      command: process.execPath,
      args: ["--import", "tsx", path.join(repoRoot, "packages/cli/src/index.ts"), "mcp"],
      cwd: p.root,
      stillsSlug: p.videoDir,
      format: "16:9",
    });
    expect(result.tools).toEqual(EXPECTED_TOOLS);
    expect(result.status).toMatchObject({ ok: true, initialized: true });
    expect(result.stills).toMatchObject({ ok: true, stills: [expect.objectContaining({ t: 1, format: "16:9" })] });
    expect(result.image?.mimeType).toBe("image/png");
    expect(result.image!.bytes).toBeGreaterThan(5_000);
    expect(result.progress).toBeGreaterThanOrEqual(1);
  });
});
