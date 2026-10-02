import { type DemovieError, ExitCode, logger, toDemovieError } from "@demovie/core";
import type { CommandContext } from "./context.ts";

export interface CommandResult<T extends object = object> {
  /** Machine-readable payload, printed as JSON with `--json`. */
  data: T;
  /** Human-readable rendering (printed to stdout without `--json`). */
  human?: string | string[];
  /** Non-zero for "completed but failed" outcomes such as QA errors. */
  exitCode?: number;
  /** The command already wrote its output (e.g. a long-running server's `--json` document): don't print again. */
  emitted?: boolean;
}

// Every result and error is masked: secrets from .demovie/.env and `$env:` references never reach stdout (SPEC §17).
export function emitResult(ctx: CommandContext, result: CommandResult): void {
  const exitCode = result.exitCode ?? ExitCode.ok;
  if (result.emitted) {
    process.exitCode = exitCode;
    return;
  }
  if (ctx.json) {
    const data = logger.maskDeep({ ok: exitCode === ExitCode.ok, ...result.data });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  } else if (result.human !== undefined) {
    const lines = Array.isArray(result.human) ? result.human : [result.human];
    if (lines.length > 0) process.stdout.write(`${logger.mask(lines.join("\n"))}\n`);
  }
  process.exitCode = exitCode;
}

export function emitError(ctx: CommandContext | undefined, error: unknown): void {
  const err: DemovieError = toDemovieError(error);
  if (ctx?.json) {
    process.stdout.write(`${JSON.stringify(logger.maskDeep({ ok: false, error: err.toJSON() }), null, 2)}\n`);
  } else {
    process.stderr.write(`error: ${logger.mask(err.message)}\nfix: ${logger.mask(err.fix)}\n`);
    if (ctx?.verbose && err.cause instanceof Error && err.cause.stack)
      process.stderr.write(`${logger.mask(err.cause.stack)}\n`);
  }
  process.exitCode = err.exitCode;
}
