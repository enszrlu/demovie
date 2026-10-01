import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  output: string;
  timedOut: boolean;
}

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv | undefined;
  timeoutMs?: number | undefined;
  logFile?: string | undefined;
  input?: string | undefined;
}

/** Spawn a command, capture stdout/stderr, and append both to an optional log file. */
export function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    if (options.logFile) appendFileSync(options.logFile, `\n$ ${command} ${args.join(" ")}\n`);
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let output = "";
    let timedOut = false;
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      output += text;
      if (options.logFile) appendFileSync(options.logFile, text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      output += text;
      if (options.logFile) appendFileSync(options.logFile, text);
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    else child.stdin.end();
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, output, timedOut });
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({
        code: 127,
        stdout,
        stderr: `${stderr}${error.message}`,
        output: `${output}${error.message}`,
        timedOut,
      });
    });
  });
}
