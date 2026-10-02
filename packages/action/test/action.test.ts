import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ActionMetadataSchema } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { commentMarkdown } from "../scripts/demovie-action.mjs";

const ACTION_DIR = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ACTION_DIR, "scripts/demovie-action.mjs");
const HARBORLY = path.resolve(ACTION_DIR, "../../examples/harborly");

describe("action.yml", () => {
  const action = ActionMetadataSchema.parse(parse(readFileSync(path.join(ACTION_DIR, "action.yml"), "utf8")));

  it("is a valid composite action with the inputs of SPEC §15.2", () => {
    expect(Object.keys(action.inputs)).toEqual(
      expect.arrayContaining([
        "agent",
        "agent-version",
        "type",
        "formats",
        "since",
        "app-url",
        "start",
        "working-directory",
        "comment",
        "upload-release-asset",
      ]),
    );
    expect(action.inputs.agent!.default).toBe("claude");
    expect(action.inputs.type!.default).toBe("changelog");
  });

  it("only references declared inputs, pinned actions and existing scripts", () => {
    const text = readFileSync(path.join(ACTION_DIR, "action.yml"), "utf8");
    for (const m of text.matchAll(/inputs\.([a-z-]+)/g)) expect(Object.keys(action.inputs)).toContain(m[1]);
    for (const step of action.runs.steps) if (step.uses) expect(step.uses).toMatch(/^[\w-]+\/[\w-]+@v\d+$/);
    for (const m of text.matchAll(/github\.action_path \}\}\/([\w./-]+)/g))
      expect(() => readFileSync(path.join(ACTION_DIR, m[1]!))).not.toThrow();
  });
});

describe("action scripts", () => {
  it("dry-run plans doctor → capture --changed → changes → make --yes", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "run", "--dry-run"], {
      cwd: HARBORLY,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_ACTIONS: "",
        GITHUB_OUTPUT: "",
        DEMOVIE_ACTION_SINCE: "v0.1.0",
        DEMOVIE_BIN: "demovie",
      },
    });
    expect(r.status, r.stderr).toBe(0);
    const planned = r.stdout.split("\n").filter((l) => l.startsWith("[dry-run]"));
    expect(planned).toEqual([
      "[dry-run] demovie doctor",
      "[dry-run] demovie capture --changed --since v0.1.0",
      "[dry-run] demovie --json changes --since v0.1.0",
      "[dry-run] demovie make --agent claude --type changelog --yes",
    ]);
  });

  it("writes a comment with the files and the QA summary", () => {
    const md = commentMarkdown(
      {
        since: "v0.1.0",
        story: "1 user-visible change: health badges.",
        run: "https://github.com/acme/app/actions/runs/1",
        videos: [
          {
            title: "Harborly changelog",
            type: "changelog",
            duration: 15,
            mp4s: ["out/changelog-16x9.mp4"],
            posters: ["out/poster-16x9.png"],
            qa: { errors: 0, warnings: 1, waived: 0 },
          },
        ],
      },
      "https://github.com/acme/app/releases/download/v0.2.0",
    );
    expect(md).toContain("Changes since `v0.1.0`: 1 user-visible change: health badges.");
    expect(md).toContain("![poster](https://github.com/acme/app/releases/download/v0.2.0/poster-16x9.png)");
    expect(md).toContain("QA: 0 error(s), 1 warning(s), 0 waived.");
    expect(md).toContain("[workflow run](https://github.com/acme/app/actions/runs/1)");
  });
});
