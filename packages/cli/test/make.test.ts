import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { which } from "@demovie/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import {
  ADAPTERS,
  CLAUDE_ALLOWED_TOOLS,
  claudeDeniedTools,
  customAdapter,
  splitCommand,
} from "../src/adapters/index.ts";
import { run as make, makePrompt, shellQuote } from "../src/commands/make.ts";
import { createContext } from "../src/context.ts";

const PROMPT = "Use the demovie skill to make a launch video.";
const REPO = path.resolve(import.meta.dirname, "../../..");
const originalPath = process.env.PATH;
afterEach(() => {
  process.env.PATH = originalPath;
});

describe("agent adapters (argument construction)", () => {
  it("claude: interactive first message; headless print mode with stream-json and scoped tools", () => {
    expect(ADAPTERS.claude.interactive(PROMPT, {})).toEqual([PROMPT]);
    expect(ADAPTERS.claude.interactive(PROMPT, { model: "opus" })).toEqual(["--model", "opus", PROMPT]);
    expect(ADAPTERS.claude.headless(PROMPT, { model: "sonnet" })).toEqual([
      "-p",
      PROMPT,
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "acceptEdits",
      "--model",
      "sonnet",
      "--allowedTools",
      CLAUDE_ALLOWED_TOOLS,
      "--disallowedTools",
      claudeDeniedTools(),
    ]);
    // deny rules win over the allow list: no nested agent, no app start, no setup, no paid voice without --voice
    const denied = claudeDeniedTools().split(",");
    for (const rule of ["Bash(npx demovie make:*)", "Bash(npx -y demovie up:*)", "Bash(npx demovie audio voice:*)"])
      expect(denied).toContain(rule);
    expect(denied).toContain("Edit(./.demovie/config.json)");
    expect(claudeDeniedTools({ voice: true })).not.toContain("audio voice");
  });

  it("codex: `codex <prompt>` interactive; `codex exec --json` in a networked workspace-write sandbox", () => {
    expect(ADAPTERS.codex.interactive(PROMPT, { model: "gpt-5" })).toEqual(["-m", "gpt-5", PROMPT]);
    expect(ADAPTERS.codex.headless(PROMPT, {})).toEqual([
      "exec",
      "--json",
      "--sandbox",
      "workspace-write",
      "-c",
      "sandbox_workspace_write.network_access=true",
      PROMPT,
    ]);
  });

  it("cursor: cursor-agent (or agent) with print mode, stream-json, --force and --trust", () => {
    expect(ADAPTERS.cursor.binaries).toEqual(["cursor-agent", "agent"]);
    expect(ADAPTERS.cursor.interactive(PROMPT, {})).toEqual([PROMPT]);
    expect(ADAPTERS.cursor.headless(PROMPT, { model: "gpt-5" })).toEqual([
      "-p",
      "--output-format",
      "stream-json",
      "--force",
      "--trust",
      "--model",
      "gpt-5",
      PROMPT,
    ]);
  });

  it("custom: splits the template like a shell and substitutes {prompt} / {model}", () => {
    expect(splitCommand(`mytool run --name "a b" 'c d' e\\ f`)).toEqual([
      "mytool",
      "run",
      "--name",
      "a b",
      "c d",
      "e f",
    ]);
    expect(() => splitCommand('mytool "open')).toThrow(/unterminated/);
    const a = customAdapter("mytool run --model={model} {prompt}");
    expect(a.binaries).toEqual(["mytool"]);
    expect(a.headless(PROMPT, { model: "m1" })).toEqual(["run", "--model=m1", PROMPT]);
    expect(customAdapter("mytool go").interactive(PROMPT, {})).toEqual(["go", PROMPT]);
  });

  it("matches the installed CLIs' --help where available", () => {
    for (const adapter of Object.values(ADAPTERS)) {
      const bin = adapter.binaries.find((b) => which(b));
      if (!bin || !adapter.verify) continue;
      const help = adapter.verify.helpArgs
        .map((args) => {
          try {
            return execFileSync(bin, args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
          } catch (error) {
            return String((error as { stdout?: string }).stdout ?? "");
          }
        })
        .join("\n");
      for (const flag of adapter.verify.flags) expect(help, `${bin} --help mentions ${flag}`).toContain(flag);
    }
  });
});

describe("demovie make", () => {
  it("builds the SPEC prompt for review and autonomous runs", () => {
    const base = {
      type: "launch" as const,
      duration: 35,
      formats: ["16:9", "9:16"],
      about: "Projects board",
      voice: false,
    };
    expect(makePrompt({ ...base, resources: ["notes.md"], review: true })).toBe(
      "Use the demovie skill to make a launch video (35s, 16:9, 9:16) about: Projects board. Resources: notes.md. Voiceover: off. Review the brief and storyboard with me before animating.",
    );
    expect(makePrompt({ ...base, resources: [], voice: true, review: false })).toContain(
      "Resources: none. Voiceover: on. Work autonomously; do not ask questions.",
    );
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  it("--dry-run prints the exact headless command for a detected agent", async () => {
    const p = syntheticProject("unit-make", "");
    const bin = path.join(p.root, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(path.join(bin, "codex"), "#!/bin/sh\nexit 0\n");
    chmodSync(path.join(bin, "codex"), 0o755);
    process.env.PATH = bin;
    const ctx = createContext({ cwd: p.root, yes: true, json: true });
    const result = await make(ctx, { dryRun: true, about: "Shapes", type: "teaser" });
    const data = result.data as { agent: string; mode: string; command: string; installsSkill: string[] };
    expect(data).toMatchObject({ agent: "codex", available: ["codex"], mode: "headless", installsSkill: ["codex"] });
    expect(data.command).toBe(
      "codex exec --json --sandbox workspace-write -c sandbox_workspace_write.network_access=true 'Use the demovie skill to make a teaser video (12s, 9:16, 1:1) about: Shapes. Resources: none. Voiceover: off. Work autonomously; do not ask questions.'",
    );
    await expect(make(ctx, { agent: "claude", dryRun: true })).rejects.toMatchObject({ code: "E_PREREQ" });
    await expect(make(ctx, { agent: "custom", dryRun: true })).rejects.toMatchObject({
      code: "E_USAGE",
      fix: expect.stringContaining("--agent-cmd"),
    });
  });

  it("launches the agent from the project root and exits with its exit code", async () => {
    const p = syntheticProject("unit-make-run", "");
    const script = path.join(p.root, "fake-agent.mjs");
    writeFileSync(
      script,
      `import { writeFileSync } from "node:fs";\nwriteFileSync("args.json", JSON.stringify(process.argv.slice(2)));\nwriteFileSync("session.txt", process.env.DEMOVIE_MAKE_SESSION ?? "");\nprocess.exit(3);\n`,
    );
    const ctx = createContext({ cwd: path.join(p.root, "video"), yes: true, json: true });
    const result = await make(ctx, { agentCmd: `${process.execPath} ${script} --task {prompt}`, about: "Shapes" });
    expect(result.exitCode).toBe(3);
    const args = JSON.parse(readFileSync(path.join(p.root, "args.json"), "utf8"));
    expect(args[0]).toBe("--task");
    expect(args[1]).toMatch(/^Use the demovie skill to make a launch video \(35s, 16:9, 9:16\) about: Shapes\./);
    // the agent knows it runs under make, and make refuses to start another agent from inside it
    expect(readFileSync(path.join(p.root, "session.txt"), "utf8")).toBe("1");
    process.env.DEMOVIE_MAKE_SESSION = "1";
    try {
      await expect(make(ctx, { agentCmd: "curl https://example.invalid" })).rejects.toMatchObject({ code: "E_USAGE" });
    } finally {
      delete process.env.DEMOVIE_MAKE_SESSION;
    }
  });

  it("headless: prints readable progress, keeps the raw log and lists the new videos", async () => {
    const p = syntheticProject("unit-make-headless", "");
    const bin = path.join(p.root, "bin");
    mkdirSync(bin, { recursive: true });
    const script = path.join(bin, "fake-claude.mjs");
    writeFileSync(
      script,
      [
        `import { mkdirSync, writeFileSync } from "node:fs";`,
        `const ev = (e) => console.log(JSON.stringify(e));`,
        `ev({ type: "system", subtype: "init" });`,
        `ev({ type: "assistant", message: { content: [{ type: "text", text: "Capturing the board." }, { type: "tool_use", name: "Bash", input: { command: "npx demovie capture" } }] } });`,
        `mkdirSync(".demovie/videos/shapes/out", { recursive: true });`,
        `writeFileSync(".demovie/videos/shapes/out/shapes-16x9.mp4", "");`,
        `ev({ type: "result", subtype: "success", duration_ms: 65000, num_turns: 7, total_cost_usd: 0.42, result: "Rendered." });`,
      ].join("\n"),
    );
    writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
    chmodSync(path.join(bin, "claude"), 0o755);
    process.env.PATH = `${bin}${path.delimiter}${originalPath}`;
    const written: string[] = [];
    const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    let result: Awaited<ReturnType<typeof make>>;
    try {
      result = await make(createContext({ cwd: p.root, yes: true, json: true }), { agent: "claude", about: "Shapes" });
    } finally {
      spy.mockRestore();
    }
    const data = result.data as { turns: number; costUsd: number; durationMs: number; videos: string[]; log: string };
    expect(result.exitCode).toBe(0);
    expect(data).toMatchObject({
      turns: 7,
      costUsd: 0.42,
      durationMs: 65000,
      videos: [".demovie/videos/shapes/out/shapes-16x9.mp4"],
    });
    const progress = written.join("");
    expect(progress).toContain("Capturing the board.");
    expect(progress).toContain("→ Bash npx demovie capture");
    expect(progress).not.toContain('"type":"system"');
    expect(readFileSync(path.join(p.root, data.log), "utf8").trim().split("\n")).toHaveLength(3);
    expect(result.human).toContain("Claude Code finished · 1m 05s · 7 turns · $0.42 (as reported by Claude Code)");
  });

  it("runs init first in a repo without .demovie/", async () => {
    const tmp = path.join(REPO, ".tmp", "unit-make-init");
    rmSync(tmp, { recursive: true, force: true });
    cpSync(path.join(REPO, "examples/pages-minimal"), tmp, { recursive: true });
    const agent = path.join(tmp, "fake-agent.mjs");
    writeFileSync(agent, "process.exit(0);\n");
    try {
      const ctx = createContext({ cwd: tmp, yes: true, json: true });
      const result = await make(ctx, { agentCmd: `${process.execPath} ${agent} {prompt}`, about: "Pages" });
      expect(result.exitCode).toBe(0);
      expect(existsSync(path.join(tmp, ".demovie/config.json"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
