import { describe, expect, it } from "vitest";
import { AgentProgress, formatDuration } from "../src/lib/agent-progress.ts";

function feed(events: unknown[]) {
  const lines: string[] = [];
  const progress = new AgentProgress((line) => lines.push(line.replace(/^\[[^\]]*\] /, "")));
  for (const e of events) progress.line(typeof e === "string" ? e : JSON.stringify(e));
  return { lines, summary: progress.summary() };
}

describe("AgentProgress", () => {
  it("reads Claude Code's stream-json: messages, tool calls and the final result", () => {
    const { lines, summary } = feed([
      { type: "system", subtype: "init", session_id: "s" },
      { type: "system", subtype: "thinking_tokens", estimated_tokens: 900 },
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Planning the storyboard.\n\nThen capturing." },
            { type: "tool_use", name: "Bash", input: { command: "npx demovie capture --route /app" } },
            { type: "tool_use", name: "Write", input: { file_path: ".demovie/videos/x/brief.md", content: "…" } },
          ],
        },
      },
      { type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } },
      {
        type: "result",
        subtype: "success",
        duration_ms: 125_000,
        num_turns: 12,
        total_cost_usd: 1.234,
        result: "Done.",
      },
    ]);
    expect(lines).toEqual([
      "Planning the storyboard. Then capturing.",
      "→ Bash npx demovie capture --route /app",
      "→ Write .demovie/videos/x/brief.md",
    ]);
    expect(summary).toEqual({ durationMs: 125_000, turns: 12, costUsd: 1.234, result: "Done.", failed: false });
  });

  it("reads Cursor's tool_call events and Codex's exec --json items", () => {
    expect(
      feed([
        {
          type: "tool_call",
          subtype: "started",
          tool_call: { shellToolCall: { args: { command: "npx demovie qa x" } } },
        },
        {
          type: "tool_call",
          subtype: "completed",
          tool_call: { shellToolCall: { args: { command: "npx demovie qa x" } } },
        },
      ]).lines,
    ).toEqual(["→ shell npx demovie qa x"]);

    const codex = feed([
      { type: "thread.started", thread_id: "t" },
      { type: "item.started", item: { type: "command_execution", command: "npx demovie render x" } },
      { type: "item.completed", item: { type: "file_change", changes: [{ path: "a.js" }, { path: "b.css" }] } },
      { type: "item.completed", item: { type: "agent_message", text: "Rendered both formats." } },
      { type: "turn.completed", usage: { input_tokens: 10 } },
      { type: "turn.failed", error: { message: "rate limited" } },
    ]);
    expect(codex.lines).toEqual([
      "→ shell npx demovie render x",
      "→ edit a.js, b.css",
      "Rendered both formats.",
      "error: rate limited",
    ]);
    expect(codex.summary).toMatchObject({ turns: 1, failed: true, costUsd: null });
  });

  it("passes plain text through and skips blank lines", () => {
    expect(feed(["", "warning: something", "  "]).lines).toEqual(["warning: something"]);
  });

  it("prefixes lines with the elapsed time and formats durations", () => {
    const lines: string[] = [];
    new AgentProgress((l) => lines.push(l)).line(
      JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hi" } }),
    );
    expect(lines[0]).toMatch(/^\[\s*0s\] hi$/);
    expect(formatDuration(42_000)).toBe("42s");
    expect(formatDuration(125_000)).toBe("2m 05s");
  });
});

describe("AgentProgress paths", () => {
  it("shows paths inside the project relative to it", () => {
    const lines: string[] = [];
    const progress = new AgentProgress((l) => lines.push(l.replace(/^\[[^\]]*\] /, "")), "/work/app");
    progress.line(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Read", input: { file_path: "/work/app/.demovie/videos/x/brief.md" } },
            { type: "tool_use", name: "Bash", input: { command: "cd /work/app && npx demovie qa x" } },
          ],
        },
      }),
    );
    expect(lines).toEqual(["→ Read .demovie/videos/x/brief.md", "→ Bash npx demovie qa x"]);
  });
});
