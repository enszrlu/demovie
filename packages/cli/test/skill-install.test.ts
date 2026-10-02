import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { VERSION } from "@demovie/core";
import { afterEach, describe, expect, it } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { run as skillInstall } from "../src/commands/skill-install.ts";
import { createContext } from "../src/context.ts";
import { installedSkillVersion } from "../src/lib/skill.ts";

const home = process.env.HOME;
afterEach(() => {
  process.env.HOME = home;
});

describe("demovie skill install", () => {
  it("installs project-level for Claude Code and the Agent Skills folder by default, with a version stamp", async () => {
    const p = syntheticProject("unit-skill", "");
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const result = await skillInstall(ctx, {});
    expect(result.data).toMatchObject({
      installed: [".claude/skills/demovie", ".agents/skills/demovie"],
      global: false,
    });
    for (const dir of [".claude/skills/demovie", ".agents/skills/demovie"]) {
      expect(existsSync(path.join(p.root, dir, "references/runtime-api.md")), dir).toBe(true);
      expect(installedSkillVersion(path.join(p.root, dir))).toBe(
        /^\d/.test(VERSION) && VERSION !== "0.0.0-dev" ? VERSION : expect.any(String),
      );
    }
    expect(readFileSync(path.join(p.root, ".claude/skills/demovie/SKILL.md"), "utf8")).toMatch(/^---\nname: demovie\n/);
    await expect(skillInstall(ctx, { agent: ["vscode"] })).rejects.toMatchObject({ code: "E_USAGE" });
  });

  it("writes to the user's folders only with --global", async () => {
    const p = syntheticProject("unit-skill-global", "");
    process.env.HOME = path.join(p.root, "home");
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const result = await skillInstall(ctx, { agent: ["cursor"], global: true });
    expect(result.data).toMatchObject({ installed: [path.join("~", ".cursor/skills/demovie")], global: true });
    expect(existsSync(path.join(p.root, "home/.cursor/skills/demovie/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(p.root, ".agents"))).toBe(false);
  });
});
