import { describe, expect, it } from "vitest";
import { DemovieError, ExitCode, isDemovieError, toDemovieError } from "../src/errors.ts";
import { Logger } from "../src/logger.ts";
import { VERSION } from "../src/version.ts";

describe("DemovieError", () => {
  it("maps codes to exit codes and serializes with a fix hint", () => {
    const err = new DemovieError("E_PREREQ_FFMPEG", "ffmpeg not found", "brew install ffmpeg");
    expect(err.exitCode).toBe(ExitCode.prerequisite);
    expect(err.toJSON()).toEqual({ code: "E_PREREQ_FFMPEG", message: "ffmpeg not found", fix: "brew install ffmpeg" });
    expect(new DemovieError("E_APP_UNREACHABLE", "x", "y").exitCode).toBe(4);
    expect(new DemovieError("E_CONFIG", "x", "y").exitCode).toBe(2);
  });

  it("wraps unknown errors", () => {
    const err = toDemovieError(new Error("boom"));
    expect(isDemovieError(err)).toBe(true);
    expect(err.code).toBe("E_FAILED");
    expect(err.fix).toMatch(/--verbose/);
  });
});

describe("Logger", () => {
  it("writes through the configured sink and masks secrets", () => {
    const lines: string[] = [];
    const log = new Logger({ color: false, write: (l) => lines.push(l), secrets: ["sk_live_secret123"] });
    log.info("key is sk_live_secret123");
    log.debug("hidden at info level");
    log.warn("careful");
    expect(lines).toEqual(["key is ***", "warn careful"]);
  });

  it("respects the level", () => {
    const lines: string[] = [];
    const log = new Logger({ color: false, level: "debug", write: (l) => lines.push(l) });
    log.debug("visible");
    expect(lines).toEqual(["debug visible"]);
  });
});

describe("VERSION", () => {
  it("is defined from the CLI package version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
