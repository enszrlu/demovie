import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(import.meta.dirname, "../../..");
const HARBORLY = path.join(REPO, "examples/harborly");
const SCRIPT = path.join(REPO, "packages/action/scripts/demovie-action.mjs");
const SLUG = "action-e2e";

describe("GitHub Action scripts, end to end with a mocked agent", () => {
  it("captures changes, runs the agent, and produces a clip, a summary and a comment", () => {
    const videoDir = path.join(HARBORLY, ".demovie/videos", SLUG);
    rmSync(videoDir, { recursive: true, force: true });
    // `make` installs the project-level skill when it is missing; remove what this test added
    const created = [".claude", ".agents"].filter((d) => !existsSync(path.join(HARBORLY, d)));
    const env = {
      ...process.env,
      GITHUB_ACTIONS: "",
      GITHUB_OUTPUT: "",
      GITHUB_STEP_SUMMARY: "",
      DEMOVIE_BIN: `${process.execPath} ${path.join(REPO, "packages/cli/dist/index.js")}`,
      DEMOVIE_ACTION_AGENT_CMD: `${process.execPath} ${path.join(REPO, "packages/action/test/mock-agent.mjs")} {prompt}`,
      DEMOVIE_ACTION_SINCE: "HEAD",
      DEMOVIE_ACTION_TYPE: "changelog",
      MOCK_SLUG: SLUG,
      DEMOVIE_USER: "demo@harborly.demo",
      DEMOVIE_PASSWORD: "harborly-demo",
    };
    try {
      const run = spawnSync(process.execPath, [SCRIPT, "run"], { cwd: HARBORLY, env, encoding: "utf8" });
      expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
      expect(run.stdout).toContain("packages/cli/dist/index.js make --agent custom --agent-cmd");
      const summary = JSON.parse(readFileSync(path.join(HARBORLY, ".demovie/.cache/action-summary.json"), "utf8"));
      expect(summary.since).toBe("HEAD");
      expect(summary.videos).toHaveLength(1);
      const video = summary.videos[0];
      expect(video.slug).toBe(SLUG);
      expect(video.qa).toMatchObject({ errors: 0 });
      for (const f of video.mp4s) expect(existsSync(path.join(HARBORLY, f)), f).toBe(true);
      expect(readFileSync(path.join(videoDir, "prompt.txt"), "utf8")).toMatch(
        /^Use the demovie skill to make a changelog video \(15s, 16:9, 1:1\)/,
      );

      const report = spawnSync(process.execPath, [SCRIPT, "report"], { cwd: HARBORLY, env, encoding: "utf8" });
      expect(report.status, report.stderr).toBe(0);
      const comment = readFileSync(path.join(HARBORLY, ".demovie/.cache/action-comment.md"), "utf8");
      expect(comment).toContain("### demovie video");
      expect(comment).toContain("QA: 0 error(s)");
      expect(comment).toContain(path.basename(video.mp4s[0]));
    } finally {
      rmSync(videoDir, { recursive: true, force: true });
      for (const d of created) rmSync(path.join(HARBORLY, d), { recursive: true, force: true });
    }
  });
});
