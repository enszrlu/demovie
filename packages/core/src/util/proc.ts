import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/** Locate an executable on PATH (no shell). */
export function which(binary: string, envPath = process.env.PATH ?? ""): string | null {
  const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run a binary without a shell and capture its output. Never throws. */
export function execCapture(
  file: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {},
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 60_000,
        env: options.env ?? process.env,
        maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        const code = error
          ? typeof (error as { code?: unknown }).code === "number"
            ? (error as { code: number }).code
            : 1
          : 0;
        resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
  });
}
