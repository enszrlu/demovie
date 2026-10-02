import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ChangesSchema } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../../../scripts/lib/repo.ts";
import { run as changes } from "../src/commands/changes.ts";
import { createContext } from "../src/context.ts";

const HARBORLY = path.join(repoRoot, "examples/harborly");
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=demovie test", "-c", "user.email=test@example.invalid", ...args], {
    cwd,
    encoding: "utf8",
  });

describe("demovie changes on a Harborly test branch", () => {
  it("maps a commit to a shared component onto the routes that render it", async () => {
    // a monorepo: the app lives in apps/web below the git root
    const repo = path.join(repoRoot, ".tmp", "int-changes");
    const dir = path.join(repo, "apps", "web");
    rmSync(repo, { recursive: true, force: true });
    for (const f of [
      "src",
      "tsconfig.json",
      "package.json",
      "next.config.ts",
      ".demovie/config.json",
      ".demovie/routes.json",
      ".demovie/flows",
    ])
      cpSync(path.join(HARBORLY, f), path.join(dir, f), { recursive: true });
    // main: Harborly before the change; the test branch: the shared HealthBadge gains an icon per health
    const badges = path.join(dir, "src/app/app/_components/badges.tsx");
    const after = readFileSync(badges, "utf8");
    writeFileSync(badges, readFileSync(path.join(import.meta.dirname, "fixtures/badges.before.tsx"), "utf8"));
    writeFileSync(path.join(repo, "README.md"), "# monorepo\n");
    git(repo, "init", "-q", "-b", "main");
    git(repo, "add", "-A");
    git(dir, "commit", "-q", "-m", "chore: initial import");
    git(dir, "tag", "v0.1.0");
    git(dir, "checkout", "-q", "-b", "feat/health-icons");
    writeFileSync(badges, after);
    git(dir, "commit", "-q", "-am", "feat(projects): health badges show an icon (#42)");
    appendFileSync(path.join(dir, "package.json"), "\n");
    git(dir, "commit", "-q", "-am", "chore: tidy package.json");
    // a commit outside the app is not part of its changelog
    appendFileSync(path.join(repo, "README.md"), "more\n");
    git(repo, "commit", "-q", "-am", "docs: another package");

    const ctx = createContext({ cwd: dir, yes: true, json: true });
    const result = await changes(ctx, {});
    const data = ChangesSchema.parse(result.data);
    expect(data.since).toBe("v0.1.0");
    expect(data.commits.map((c) => [c.type, c.subject, c.userVisible])).toEqual([
      ["chore", "tidy package.json", false],
      ["feat", "health badges show an icon", true],
    ]);
    expect(data.commits[1]!.prs).toEqual([42]);
    expect(data.files.map((f) => f.path).sort()).toEqual(["package.json", "src/app/app/_components/badges.tsx"]);
    expect(data.routes.map((r) => [r.path, r.reason])).toEqual([
      ["/app", "import"],
      ["/app/projects", "import"],
      ["/app/projects/[id]", "import"],
      ["/app/projects/new", "import"],
    ]);
    for (const r of data.routes) expect(r.via[0]).toBe("src/app/app/_components/badges.tsx");
    expect(data.suggestions).toMatchObject({
      captures: ["/app", "/app/projects", "/app/projects/[id]", "/app/projects/new"],
      flows: ["create-project"],
      story: "1 user-visible change: health badges show an icon.",
    });
    expect(JSON.parse(readFileSync(path.join(dir, ".demovie/.cache/changes.json"), "utf8")).head).toBe(data.head);

    // an explicit --since and a direct page change
    appendFileSync(path.join(dir, "src/app/(marketing)/pricing/page.tsx"), "\n");
    git(dir, "commit", "-q", "-am", "fix(pricing): copy");
    const direct = ChangesSchema.parse((await changes(ctx, { since: "HEAD~1" })).data);
    expect(direct.routes).toEqual([
      {
        path: "/pricing",
        file: "src/app/(marketing)/pricing/page.tsx",
        reason: "direct",
        via: ["src/app/(marketing)/pricing/page.tsx"],
      },
    ]);
    await expect(changes(ctx, { since: "no-such-ref" })).rejects.toMatchObject({ code: "E_GIT" });
  });
});
