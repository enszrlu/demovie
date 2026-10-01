/** Process exit codes (SPEC §7). */
export const ExitCode = {
  ok: 0,
  failed: 1,
  usage: 2,
  prerequisite: 3,
  app: 4,
} as const;
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export type ErrorCode =
  | "E_FAILED"
  | "E_USAGE"
  | "E_CONFIG"
  | "E_NOT_INITIALIZED"
  | "E_NOT_FOUND"
  | "E_PREREQ_NODE"
  | "E_PREREQ_FFMPEG"
  | "E_PREREQ_CHROMIUM"
  | "E_PREREQ"
  | "E_APP_UNREACHABLE"
  | "E_APP_START"
  | "E_AUTH"
  | "E_CAPTURE"
  | "E_RENDER"
  | "E_QA"
  | "E_AUDIO"
  | "E_PROVIDER"
  | "E_AGENT"
  | "E_GIT"
  | "E_UNSAFE_URL";

const exitCodeFor: Record<ErrorCode, ExitCodeValue> = {
  E_FAILED: ExitCode.failed,
  E_USAGE: ExitCode.usage,
  E_CONFIG: ExitCode.usage,
  E_NOT_INITIALIZED: ExitCode.usage,
  E_NOT_FOUND: ExitCode.usage,
  E_PREREQ_NODE: ExitCode.prerequisite,
  E_PREREQ_FFMPEG: ExitCode.prerequisite,
  E_PREREQ_CHROMIUM: ExitCode.prerequisite,
  E_PREREQ: ExitCode.prerequisite,
  E_APP_UNREACHABLE: ExitCode.app,
  E_APP_START: ExitCode.app,
  E_AUTH: ExitCode.app,
  E_CAPTURE: ExitCode.failed,
  E_RENDER: ExitCode.failed,
  E_QA: ExitCode.failed,
  E_AUDIO: ExitCode.failed,
  E_PROVIDER: ExitCode.failed,
  E_AGENT: ExitCode.failed,
  E_GIT: ExitCode.failed,
  E_UNSAFE_URL: ExitCode.usage,
};

/**
 * Every user-facing failure says what failed, why, and how to fix it (SPEC §7).
 */
export class DemovieError extends Error {
  readonly code: ErrorCode;
  readonly fix: string;
  readonly exitCode: ExitCodeValue;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, fix: string, options?: { details?: unknown; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DemovieError";
    this.code = code;
    this.fix = fix;
    this.exitCode = exitCodeFor[code];
    this.details = options?.details;
  }

  toJSON(): { code: ErrorCode; message: string; fix: string; details?: unknown } {
    return {
      code: this.code,
      message: this.message,
      fix: this.fix,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function isDemovieError(error: unknown): error is DemovieError {
  return error instanceof DemovieError;
}

/** Wrap any thrown value into a DemovieError with a generic fix hint. */
export function toDemovieError(error: unknown, fallbackFix = "re-run with --verbose for details"): DemovieError {
  if (isDemovieError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new DemovieError("E_FAILED", message, fallbackFix, { cause: error });
}
