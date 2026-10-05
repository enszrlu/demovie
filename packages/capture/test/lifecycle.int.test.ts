import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
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

  it("waits for a server that outlives its parent, so the port is free when down returns", async () => {
    const slow = path.join(dir, "..", "it-lifecycle-slow");
    rmSync(slow, { recursive: true, force: true });
    mkdirSync(path.join(slow, ".demovie"), { recursive: true });
    // Like `next dev`: the parent leaves at once, and its server child takes a moment to shut down.
    writeFileSync(
      path.join(slow, "parent.mjs"),
      'import { fork } from "node:child_process";\nfork("server.mjs", [process.argv[2]]);\nprocess.on("SIGTERM", () => process.exit(0));\n',
    );
    writeFileSync(
      path.join(slow, "server.mjs"),
      'import http from "node:http";\nhttp.createServer((_, res) => res.end("ok")).listen(Number(process.argv[2]));\nprocess.on("SIGTERM", () => setTimeout(() => process.exit(0), 1500));\n',
    );
    writeFileSync(
      path.join(slow, ".demovie", "config.json"),
      JSON.stringify({
        version: 1,
        project: { name: "X", framework: "generic" },
        app: { url: "http://localhost:3406", start: { command: "node parent.mjs 3406", timeoutMs: 20_000 } },
      }),
    );
    const ctx = createContext({ cwd: slow, yes: true, json: true });
    await up(ctx);
    expect((await checkUrl("http://localhost:3406/")).ok).toBe(true);
    expect(((await down(ctx)).data as { stopped: boolean }).stopped).toBe(true);
    expect((await checkUrl("http://localhost:3406/")).status).toBeNull();
  });

  it("refuses to start next to another server on the app's port instead of waiting for it", async () => {
    const taken = path.join(dir, "..", "it-lifecycle-taken");
    rmSync(taken, { recursive: true, force: true });
    mkdirSync(path.join(taken, ".demovie"), { recursive: true });
    writeFileSync(
      path.join(taken, ".demovie", "config.json"),
      JSON.stringify({
        version: 1,
        project: { name: "X", framework: "generic" },
        app: {
          url: "http://localhost:3407",
          start: { command: 'node -e "setInterval(() => {}, 1000)"', timeoutMs: 20_000 },
        },
      }),
    );
    const other = http.createServer((_, res) => res.writeHead(404).end()).listen(3407);
    try {
      const startedAt = Date.now();
      await expect(up(createContext({ cwd: taken, yes: true, json: true }))).rejects.toMatchObject({
        code: "E_APP_START",
        message: expect.stringContaining("something already answers at http://localhost:3407/ (HTTP 404)"),
      });
      expect(Date.now() - startedAt).toBeLessThan(5000);
    } finally {
      other.close();
    }
  });
});
