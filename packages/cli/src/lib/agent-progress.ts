/**
 * Readable progress for `make` in headless mode. Agent CLIs stream JSON events (Claude Code and Cursor `stream-json`,
 * Codex `exec --json`); this turns each into at most a line or two: what the agent says and which tool it runs.
 * Lines that aren't JSON pass through unchanged; events it doesn't know are skipped.
 */
export interface AgentRunSummary {
  durationMs: number | null;
  turns: number | null;
  costUsd: number | null;
  /** The agent's final message, when the stream reports one. */
  result: string | null;
  failed: boolean;
}

type Json = Record<string, unknown>;

const short = (value: unknown, n = 160): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

const record = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});

/** The most telling argument of a tool call: its command, file, pattern, URL or query. */
function toolDetail(input: unknown): string {
  const i = record(input);
  return short(i.command ?? i.file_path ?? i.path ?? i.pattern ?? i.url ?? i.query ?? i.skill ?? i.description, 120);
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export class AgentProgress {
  private readonly started = Date.now();
  private readonly data: AgentRunSummary = {
    durationMs: null,
    turns: null,
    costUsd: null,
    result: null,
    failed: false,
  };
  private codexTurns = 0;

  /** `root`: the project folder; paths inside it are shown relative to it. */
  constructor(
    private readonly write: (line: string) => void,
    private readonly root?: string,
  ) {}

  /** Feed one line of the agent's stdout. */
  line(raw: string): void {
    const text = raw.trim();
    if (!text) return;
    let event: unknown;
    try {
      event = JSON.parse(text);
    } catch {
      this.write(text);
      return;
    }
    const clock = `[${formatDuration(Date.now() - this.started).padStart(7)}]`;
    for (const line of this.describe(record(event))) this.write(`${clock} ${this.relative(line)}`);
  }

  private relative(line: string): string {
    if (!this.root) return line;
    const root = this.root.replace(/\/+$/, "");
    return line.split(`cd ${root} && `).join("").split(`${root}/`).join("");
  }

  summary(): AgentRunSummary {
    return { ...this.data, turns: this.data.turns ?? (this.codexTurns || null) };
  }

  /** Lines for one event (exported through `line`; separate so tests can read it directly). */
  describe(e: Json): string[] {
    switch (e.type) {
      // Claude Code and Cursor: an assistant message with text and tool calls
      case "assistant": {
        const out: string[] = [];
        for (const part of (record(e.message).content as unknown[] | undefined) ?? []) {
          const p = record(part);
          if (p.type === "text" && short(p.text)) out.push(short(p.text, 200));
          if (p.type === "tool_use") out.push(`→ ${String(p.name)} ${toolDetail(p.input)}`.trimEnd());
        }
        return out;
      }
      // Cursor: { type: "tool_call", subtype: "started", tool_call: { shellToolCall: { args: {...} } } }
      case "tool_call": {
        if (e.subtype !== "started") return [];
        const [kind, call] = Object.entries(record(e.tool_call))[0] ?? [];
        return kind ? [`→ ${kind.replace(/ToolCall$/, "")} ${toolDetail(record(call).args)}`.trimEnd()] : [];
      }
      // Claude Code and Cursor: the run's last event
      case "result": {
        this.data.durationMs = typeof e.duration_ms === "number" ? e.duration_ms : null;
        this.data.turns = typeof e.num_turns === "number" ? e.num_turns : null;
        this.data.costUsd = typeof e.total_cost_usd === "number" ? e.total_cost_usd : null;
        this.data.result = typeof e.result === "string" ? e.result : null;
        this.data.failed = e.is_error === true || String(e.subtype ?? "").startsWith("error");
        return [];
      }
      // Codex exec --json
      case "item.started": {
        const item = record(e.item);
        return item.type === "command_execution" ? [`→ shell ${short(item.command, 120)}`] : [];
      }
      case "item.completed": {
        const item = record(e.item);
        if (item.type === "agent_message" && short(item.text)) return [short(item.text, 200)];
        if (item.type === "file_change") {
          const paths = ((item.changes as unknown[] | undefined) ?? []).map((c) => String(record(c).path ?? ""));
          return [`→ edit ${short(paths.join(", "), 120)}`];
        }
        if (item.type === "web_search") return [`→ web search ${short(item.query, 120)}`];
        if (item.type === "mcp_tool_call") return [`→ ${String(item.server ?? "mcp")}.${String(item.tool ?? "")}`];
        return [];
      }
      case "turn.completed":
        this.codexTurns++;
        return [];
      case "turn.failed":
      case "error": {
        this.data.failed = true;
        const message = short(record(e.error).message ?? e.message, 200);
        return message ? [`error: ${message}`] : [];
      }
      default:
        return [];
    }
  }
}
