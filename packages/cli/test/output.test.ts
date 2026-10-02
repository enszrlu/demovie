import { writeFileSync } from "node:fs";
import path from "node:path";
import { DemovieError, loadProject, logger } from "@demovie/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { createContext } from "../src/context.ts";
import { emitError, emitResult } from "../src/output.ts";

function stdout(fn: () => void): string {
  let out = "";
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return out;
}

afterEach(() => {
  process.exitCode = 0;
});

describe("output masking", () => {
  it("masks secrets in --json results and errors without touching the JSON structure", () => {
    logger.addSecret("fixture-secret-9f3a7c");
    const ctx = createContext({ json: true });
    const result = JSON.parse(
      stdout(() =>
        emitResult(ctx, {
          data: { log: "password=fixture-secret-9f3a7c", lines: [{ text: "x fixture-secret-9f3a7c" }], n: 3 },
        }),
      ),
    );
    expect(result).toEqual({ ok: true, log: "password=***", lines: [{ text: "x ***" }], n: 3 });
    const error = JSON.parse(
      stdout(() =>
        emitError(
          ctx,
          new DemovieError("E_APP_START", "seed failed: fixture-secret-9f3a7c", "unset fixture-secret-9f3a7c"),
        ),
      ),
    );
    expect(error.ok).toBe(false);
    expect(JSON.stringify(error)).not.toContain("fixture-secret-9f3a7c");
    expect(error.error.fix).toBe("unset ***");
  });

  it("registers $env: values as secrets, but not plain URLs", async () => {
    const p = syntheticProject("unit-output-env", "");
    writeFileSync(
      path.join(p.root, ".demovie/config.json"),
      JSON.stringify({
        version: 1,
        project: { name: "Synthetica", framework: "generic" },
        app: {
          url: "http://localhost:9",
          start: { command: "node server.js", env: { API_URL: "$env:SYN_APP_URL" } },
          headers: { "x-bypass": "$env:SYN_BYPASS" },
        },
      }),
    );
    process.env.SYN_APP_URL = "http://localhost:4123";
    process.env.SYN_BYPASS = "bypass-token-77aa";
    try {
      await loadProject(p.root);
      expect(logger.mask("header bypass-token-77aa at http://localhost:4123")).toBe(
        "header *** at http://localhost:4123",
      );
    } finally {
      delete process.env.SYN_APP_URL;
      delete process.env.SYN_BYPASS;
    }
  });
});
