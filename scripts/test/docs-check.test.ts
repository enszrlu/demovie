import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { brokenLinks, mentionedCommands } from "../lib/docs-check.ts";
import { repoRoot } from "../lib/repo.ts";

const dir = path.join(repoRoot, ".tmp", "unit-docs-check");

function doc(name: string, text: string): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, text);
  return file;
}

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("docs check", () => {
  it("reads command mentions from code only, with groups and their subcommands", () => {
    const file = doc(
      "a.md",
      [
        "demovie makes videos true; prose like demovie gives or demovie never isn't a command.",
        "Run `npx demovie capture --changed` and `demovie skill install`, or `bunx demovie qa launch`.",
        "```bash",
        "npx -y demovie mcp",
        "npx demovie audio music launch   # synth",
        "node packages/cli/dist/index.js --cwd x render launch",
        "```",
        "`@demovie/runtime`, `.demovie/videos/<slug>`, `demovie-action.mjs` and `npx demovie <command>` aren't either.",
        "```mermaid",
        "  D --> E[HTML + GSAP composition<br/>on the demovie runtime]",
        "```",
        "```js",
        "console.info(`demovie runtime 0.1.0`);",
        "```",
        "```bash",
        "$ demovie status",
        "```",
      ].join("\n"),
    );
    expect(mentionedCommands(file).sort()).toEqual(["audio music", "capture", "mcp", "qa", "skill install", "status"]);
  });

  it("reports relative links that don't resolve, ignoring URLs, anchors and code", () => {
    doc("there.md", "# there");
    const file = doc(
      "b.md",
      [
        "[ok](there.md) [anchor](there.md#x) [web](https://example.com) [mail](mailto:a@b.example)",
        "[missing](nope.md)",
        "```md",
        "[in code](also-missing.md)",
        "```",
      ].join("\n"),
    );
    expect(brokenLinks(file)).toEqual([".tmp/unit-docs-check/b.md → nope.md"]);
  });
});
