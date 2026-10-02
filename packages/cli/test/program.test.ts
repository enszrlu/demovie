import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "../src/help-examples.ts";
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

  it("gives every command --help examples that only use its own and the global options", () => {
    const program = buildProgram();
    const flags = (cmd: Command) =>
      new Set(cmd.options.flatMap((o) => [o.long, o.short]).filter((f): f is string => Boolean(f)));
    const globals = flags(program);
    const leaves: [string, Command][] = [];
    const walk = (cmd: Command, prefix: string[]) => {
      for (const sub of cmd.commands) {
        if (sub.name() === "help") continue;
        const path = [...prefix, sub.name()];
        if (sub.commands.length === 0) leaves.push([path.join(" "), sub]);
        walk(sub, path);
      }
    };
    walk(program, []);
    for (const [key, cmd] of leaves) {
      const examples = EXAMPLES[key];
      expect(examples?.length, `examples for "${key}"`).toBeGreaterThan(0);
      const own = flags(cmd);
      for (const [, line] of examples ?? []) {
        expect(line.startsWith(`npx demovie ${key}`), line).toBe(true);
        for (const flag of line.match(/(?<=\s)--?[a-z][a-z-]*/g) ?? [])
          expect(own.has(flag) || globals.has(flag), `${line}: ${flag}`).toBe(true);
      }
    }
    expect(Object.keys(EXAMPLES).filter((key) => !leaves.some(([leaf]) => leaf === key))).toEqual([]);
  });
});
