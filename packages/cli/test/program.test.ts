import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProgram } from "../src/program.ts";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

describe("CLI program", () => {
  it("registers every command from SPEC §7", () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    for (const name of [
      "init",
      "doctor",
      "status",
      "up",
      "down",
      "auth",
      "extract",
      "glossary",
      "capture",
      "flow",
      "changes",
      "add",
      "new",
      "preview",
      "stills",
      "qa",
      "audio",
      "render",
      "make",
      "mcp",
      "skill",
      "ci",
    ]) {
      expect(names).toContain(name);
    }
    const sub = (parent: string) =>
      program.commands
        .find((c) => c.name() === parent)!
        .commands.map((c) => c.name())
        .sort();
    expect(sub("auth")).toEqual(["record", "test"]);
    expect(sub("audio")).toEqual(["mix", "music", "sfx", "voice"]);
    expect(sub("flow")).toEqual(["new", "run"]);
    expect(sub("glossary")).toEqual(["sync"]);
    expect(sub("skill")).toEqual(["install"]);
    expect(sub("ci")).toEqual(["init"]);
  });

  it("exposes the global flags", () => {
    const flags = buildProgram().options.map((o) => o.long);
    expect(flags).toEqual(expect.arrayContaining(["--cwd", "--json", "--verbose", "--yes", "--no-color", "--version"]));
  });

  it("uses the package version", () => {
    expect(buildProgram().version()).toBe(pkg.version);
  });
});
