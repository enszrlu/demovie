import { describe, expect, it } from "vitest";
import { sameProcess } from "../src/lifecycle.ts";

describe("sameProcess (down never kills a reused pid)", () => {
  it.skipIf(process.platform === "win32")("matches a pid only with its own start time", () => {
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
    expect(sameProcess(process.pid, startedAt)).toBe(true);
    expect(sameProcess(process.pid, "2020-01-01T00:00:00.000Z")).toBe(false);
  });
});
