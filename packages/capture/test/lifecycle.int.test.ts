import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkUrl } from "@demovie/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "../../../scripts/lib/repo.ts";
import { run as down } from "../../cli/src/commands/down.ts";
import { run as up } from "../../cli/src/commands/up.ts";
import { createContext } from "../../cli/src/context.ts";

const PORT = 3404;

describe("up / down", () => {
  const dir = path.join(repoRoot, ".tmp", "it-lifecycle");
  beforeAll(() => {
    rmSync(dir, { recursive: true, force: true });
    cpSync(path.join(repoRoot, "examples", "static-site"), dir, { recursive: true });
    mkdirSync(path.join(dir, ".demovie"), { recursive: true });
    writeFileSync(
      path.join(dir, ".demovie", "config.json"),
      JSON.stringify({
        version: 1,
        project: { name: "Ember Bakery", framework: "generic" },
        app: { url: `http://localhost:${PORT}`, start: { command: `node server.mjs ${PORT}`, timeoutMs: 20_000 } },
        demo: { seed: "node -e \"require('fs').writeFileSync('seeded.txt', 'ok')\"" },
      }),
    );
  });
  afterAll(async () => {
    await down(createContext({ cwd: dir, yes: true, json: true })).catch(() => {});
  });

  it("seeds, starts, waits for the app, then stops the whole process tree", async () => {
    const ctx = createContext({ cwd: dir, yes: true, json: true });
    const started = (await up(ctx)).data as { started: boolean; pid: number; seeded: boolean };
    expect(started).toMatchObject({ started: true, seeded: true });
    expect(existsSync(path.join(dir, "seeded.txt"))).toBe(true);
    expect((await checkUrl(`http://localhost:${PORT}/`)).ok).toBe(true);
    expect(existsSync(path.join(dir, ".demovie", ".cache", "app.json"))).toBe(true);
    const again = (await up(ctx)).data as { reused: boolean };
    expect(again.reused).toBe(true);
    const stopped = (await down(ctx)).data as { stopped: boolean; pid: number };
    expect(stopped).toMatchObject({ stopped: true, pid: started.pid });
    await new Promise((r) => setTimeout(r, 300));
    expect((await checkUrl(`http://localhost:${PORT}/`)).ok).toBe(false);
    expect(((await down(ctx)).data as { pid: number | null }).pid).toBeNull();
  });

  it("explains how to fix a start command that never answers", async () => {
    const bad = path.join(dir, "..", "it-lifecycle-bad");
    rmSync(bad, { recursive: true, force: true });
    mkdirSync(path.join(bad, ".demovie"), { recursive: true });
    writeFileSync(
      path.join(bad, ".demovie", "config.json"),
      JSON.stringify({
        version: 1,
        project: { name: "X", framework: "generic" },
        app: {
          url: "http://localhost:3405",
          start: { command: "node -e \"console.log('boom'); process.exit(3)\"", timeoutMs: 10_000 },
        },
      }),
    );
    await expect(up(createContext({ cwd: bad, yes: true, json: true }))).rejects.toMatchObject({
      code: "E_APP_START",
      message: expect.stringContaining("boom"),
    });
  });
});
