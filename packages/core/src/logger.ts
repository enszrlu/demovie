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

/**
 * The shared logger. It always writes to stderr so that `--json` output on stdout stays clean.
 */
export class Logger {
  level: LogLevel;
  private colors: ReturnType<typeof createColors>;
  private secrets: Set<string>;
  private write: (line: string) => void;

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

  private emit(level: LogLevel, prefix: string, parts: unknown[]): void {
    if (order[level] < order[this.level]) return;
    const text = parts.map((p) => (typeof p === "string" ? p : formatValue(p))).join(" ");
    this.write(this.mask(prefix ? `${prefix} ${text}` : text));
  }

  debug(...parts: unknown[]): void {
    this.emit("debug", this.colors.dim("debug"), parts);
  }
  info(...parts: unknown[]): void {
    this.emit("info", "", parts);
  }
  step(...parts: unknown[]): void {
    this.emit("info", this.colors.cyan("◇"), parts);
  }
  success(...parts: unknown[]): void {
    this.emit("info", this.colors.green("✓"), parts);
  }
  warn(...parts: unknown[]): void {
    this.emit("warn", this.colors.yellow("warn"), parts);
  }
  error(...parts: unknown[]): void {
    this.emit("error", this.colors.red("error"), parts);
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
