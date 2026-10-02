import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { ACTION_REF, run as ciInit } from "../src/commands/ci-init.ts";
import { createContext } from "../src/context.ts";

describe("demovie ci init", () => {
  it("writes the workflow at the git root with the app's working directory, after confirmation", async () => {
    const p = syntheticProject("unit-ci-init", "");
    const repo = path.dirname(p.root);
    execFileSync("git", ["init", "-q", p.root]);
    const savedCi = process.env.CI;
    process.env.CI = "";
    const noYes = createContext({ cwd: p.root, json: true });
    process.env.CI = savedCi;
    if (!noYes.yes)
      await expect(ciInit(noYes, {})).rejects.toMatchObject({ code: "E_USAGE", fix: expect.stringContaining("--yes") });
    const ctx = createContext({ cwd: path.join(p.root, "video"), yes: true, json: true });
    const result = await ciInit(ctx, {});
    expect(result.data).toMatchObject({ written: true, workingDirectory: ".", agent: "claude" });
    const file = path.join(p.root, ".github/workflows/demovie.yml");
    const wf = parse(readFileSync(file, "utf8"));
    expect(Object.keys(wf.on)).toEqual(["release", "workflow_dispatch"]);
    const step = wf.jobs.video.steps[1];
    expect(step.uses).toBe(ACTION_REF);
    expect(step.with).toMatchObject({ agent: "claude", type: "changelog", "working-directory": "." });
    expect(Object.keys(step.env)).toEqual(["ANTHROPIC_API_KEY", "DEMOVIE_USER", "DEMOVIE_PASSWORD"]);
    expect(wf.jobs.video.steps[0].with["fetch-depth"]).toBe(0);
    expect((await ciInit(ctx, {})).data).toMatchObject({ written: false });
    await expect(ciInit(ctx, { provider: "gitlab" })).rejects.toMatchObject({ code: "E_USAGE" });
    expect(repo).toBeTruthy();
  });
});
