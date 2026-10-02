import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { writeJson } from "../src/util/fs.ts";

const dir = path.join(import.meta.dirname, "../../../.tmp/unit-core-fs");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("writeJson", () => {
  it("writes 2-space JSON, but leaves a file that already holds the same data untouched", async () => {
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "routes.json");
    await writeJson(file, { routes: [{ path: "/a", params: ["x"] }] });
    expect(readFileSync(file, "utf8")).toBe(
      '{\n  "routes": [\n    {\n      "path": "/a",\n      "params": [\n        "x"\n      ]\n    }\n  ]\n}\n',
    );

    // a project formatter reflowed it: same data, different text → not rewritten
    const formatted = '{\n  "routes": [{ "path": "/a", "params": ["x"] }]\n}\n';
    writeFileSync(file, formatted);
    await writeJson(file, { routes: [{ path: "/a", params: ["x"] }] });
    expect(readFileSync(file, "utf8")).toBe(formatted);

    // different data, or an unparsable file → written
    await writeJson(file, { routes: [] });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ routes: [] });
    writeFileSync(file, "{ broken");
    await writeJson(file, { ok: true });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ok: true });
  });
});

describe("upsertDotEnv", () => {
  it("creates the secrets file owner-only and keeps a mode the user chose", async () => {
    const { statSync, chmodSync } = await import("node:fs");
    const { upsertDotEnv } = await import("../src/util/env.ts");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, ".env");
    rmSync(file, { force: true });
    await upsertDotEnv(file, { DEMOVIE_PASSWORD: "fixture-pass" });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    chmodSync(file, 0o640);
    await upsertDotEnv(file, { DEMOVIE_USER: "demo@example.com" });
    expect(statSync(file).mode & 0o777).toBe(0o640);
    expect(readFileSync(file, "utf8")).toContain("DEMOVIE_USER=demo@example.com");
  });
});
