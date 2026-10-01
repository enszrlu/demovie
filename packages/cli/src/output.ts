import { type DemovieError, ExitCode, toDemovieError } from "@demovie/core";
import type { CommandContext } from "./context.ts";

export interface CommandResult<T extends object = object> {
  /** Machine-readable payload, printed as JSON with `--json`. */
  data: T;
  /** Human-readable rendering (printed to stdout without `--json`). */
  human?: string | string[];
  /** Non-zero for "completed but failed" outcomes such as QA errors. */
  exitCode?: number;
}

export function emitResult(ctx: CommandContext, result: CommandResult): void {
  const exitCode = result.exitCode ?? ExitCode.ok;
  if (ctx.json) {
    process.stdout.write(`${JSON.stringify({ ok: exitCode === ExitCode.ok, ...result.data }, null, 2)}\n`);
  } else if (result.human !== undefined) {
    const lines = Array.isArray(result.human) ? result.human : [result.human];
    if (lines.length > 0) process.stdout.write(`${lines.join("\n")}\n`);
  }
  process.exitCode = exitCode;
}

export function emitError(ctx: CommandContext | undefined, error: unknown): void {
  const err: DemovieError = toDemovieError(error);
  if (ctx?.json) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: err.toJSON() }, null, 2)}\n`);
  } else {
    const log = ctx?.logger;
    const message = log ? log.mask(err.message) : err.message;
    process.stderr.write(`error: ${message}\nfix: ${err.fix}\n`);
    if (ctx?.verbose && err.cause instanceof Error && err.cause.stack) process.stderr.write(`${err.cause.stack}\n`);
  }
  process.exitCode = err.exitCode;
}
