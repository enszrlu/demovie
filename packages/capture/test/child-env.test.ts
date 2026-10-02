import { afterEach, describe, expect, it } from "vitest";
import { childEnv } from "../src/lifecycle.ts";

const project = (env?: Record<string, string>) =>
  ({ resolved: { app: { start: { command: "next dev", env } } } }) as unknown as Parameters<typeof childEnv>[0];

describe("childEnv", () => {
  const saved = process.env.NODE_ENV;
  afterEach(() => {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  });

  it("drops a test runner's NODE_ENV=test, so `next dev` picks development", () => {
    process.env.NODE_ENV = "test";
    expect(childEnv(project())).not.toHaveProperty("NODE_ENV");
  });

  it("keeps any other inherited NODE_ENV, and app.start.env always wins", () => {
    process.env.NODE_ENV = "production";
    expect(childEnv(project()).NODE_ENV).toBe("production");
    process.env.NODE_ENV = "test";
    expect(childEnv(project({ NODE_ENV: "test", PORT: "3100" }))).toMatchObject({ NODE_ENV: "test", PORT: "3100" });
  });
});
