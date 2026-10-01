import path from "node:path";
import { type Logger, logger } from "@demovie/core";

export interface GlobalOptions {
  cwd?: string;
  json?: boolean;
  verbose?: boolean;
  yes?: boolean;
  color?: boolean;
}

export interface CommandContext {
  cwd: string;
  json: boolean;
  verbose: boolean;
  yes: boolean;
  color: boolean;
  interactive: boolean;
  logger: Logger;
}

export function createContext(options: GlobalOptions): CommandContext {
  const json = Boolean(options.json);
  const color = options.color !== false && !json && process.env.NO_COLOR === undefined;
  const verbose = Boolean(options.verbose);
  logger.configure({ level: verbose ? "debug" : "info", color: color && Boolean(process.stderr.isTTY) });
  const yes = Boolean(options.yes) || isCI();
  return {
    cwd: path.resolve(options.cwd ?? process.cwd()),
    json,
    verbose,
    yes,
    color,
    interactive: !yes && !json && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY),
    logger,
  };
}

export function isCI(): boolean {
  const ci = process.env.CI;
  return ci !== undefined && ci !== "" && ci !== "0" && ci.toLowerCase() !== "false";
}
