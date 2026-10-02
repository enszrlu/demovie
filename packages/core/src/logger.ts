import { createColors } from "picocolors";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface LoggerOptions {
  level?: LogLevel;
  color?: boolean;
  /** Secret values that must never be printed; they are replaced by `***`. */
  secrets?: string[];
  write?: (line: string) => void;
}

export type LogKind = "debug" | "info" | "step" | "success" | "warn" | "error";
export type LogListener = (event: { kind: LogKind; text: string }) => void;

/**
 * The shared logger. It always writes to stderr so that `--json` output on stdout stays clean.
 */
export class Logger {
  level: LogLevel;
  private colors: ReturnType<typeof createColors>;
  private secrets: Set<string>;
  private write: (line: string) => void;
  private listeners = new Set<LogListener>();

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.colors = createColors(options.color ?? defaultColor());
    this.secrets = new Set((options.secrets ?? []).filter((s) => s.length >= 4));
    this.write = options.write ?? ((line) => process.stderr.write(`${line}\n`));
  }

  configure(options: LoggerOptions): void {
    if (options.level) this.level = options.level;
    if (options.color !== undefined) this.colors = createColors(options.color);
    if (options.secrets) for (const s of options.secrets) if (s.length >= 4) this.secrets.add(s);
    if (options.write) this.write = options.write;
  }

  addSecret(value: string | undefined | null): void {
    if (value && value.length >= 4) this.secrets.add(value);
  }

  get c(): ReturnType<typeof createColors> {
    return this.colors;
  }

  mask(text: string): string {
    let out = text;
    for (const secret of this.secrets) out = out.split(secret).join("***");
    return out;
  }

  /** Observe every message (masked, uncolored), whatever the level; e.g. to forward progress over MCP. */
  listen(fn: LogListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(level: LogLevel, kind: LogKind, prefix: string, parts: unknown[]): void {
    const text = parts.map((p) => (typeof p === "string" ? p : formatValue(p))).join(" ");
    if (this.listeners.size) {
      const masked = this.mask(text);
      for (const fn of this.listeners) fn({ kind, text: masked });
    }
    if (order[level] < order[this.level]) return;
    this.write(this.mask(prefix ? `${prefix} ${text}` : text));
  }

  debug(...parts: unknown[]): void {
    this.emit("debug", "debug", this.colors.dim("debug"), parts);
  }
  info(...parts: unknown[]): void {
    this.emit("info", "info", "", parts);
  }
  step(...parts: unknown[]): void {
    this.emit("info", "step", this.colors.cyan("◇"), parts);
  }
  success(...parts: unknown[]): void {
    this.emit("info", "success", this.colors.green("✓"), parts);
  }
  warn(...parts: unknown[]): void {
    this.emit("warn", "warn", this.colors.yellow("warn"), parts);
  }
  error(...parts: unknown[]): void {
    this.emit("error", "error", this.colors.red("error"), parts);
  }
}

function defaultColor(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0") return true;
  return Boolean(process.stderr.isTTY);
}

function formatValue(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Process-wide logger used by all library packages. */
export const logger = new Logger();
