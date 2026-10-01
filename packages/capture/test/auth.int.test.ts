import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FIXTURE_ENV, harborlyProject } from "../../../scripts/test/harborly.ts";
import { run as authTest } from "../../cli/src/commands/auth-test.ts";
import { createContext } from "../../cli/src/context.ts";

function setStrategy(dir: string, patch: Record<string, unknown>): void {
  const file = path.join(dir, ".demovie", "config.json");
  const config = JSON.parse(readFileSync(file, "utf8"));
  Object.assign(config.auth, patch);
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

describe("auth strategies (real Chromium, Harborly)", () => {
  let dir: string;
  const saved = { ...process.env };
  beforeAll(() => {
    dir = harborlyProject("auth");
    Object.assign(process.env, FIXTURE_ENV);
  });
  afterAll(() => {
    process.env = saved;
  });

  it("form: logs in, saves the state and prints cookie names only", async () => {
    const result = await authTest(createContext({ cwd: dir, yes: true, json: true }));
    const data = result.data as { ok: boolean; strategy: string; landingUrl: string; cookieNames: string[] };
    expect(data).toMatchObject({ ok: true, strategy: "form" });
    expect(new URL(data.landingUrl).pathname).toBe("/app");
    expect(data.cookieNames).toContain("harborly_session");
    expect(JSON.stringify(result)).not.toMatch(/harborly-demo|\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  });

  it("storageState: reuses a saved state", async () => {
    const state = path.join(dir, ".demovie", ".auth", "state.json");
    copyFileSync(state, path.join(dir, ".demovie", ".auth", "recorded.json"));
    setStrategy(dir, { strategy: "storageState" });
    const data = (await authTest(createContext({ cwd: dir, yes: true, json: true }))).data as {
      ok: boolean;
      strategy: string;
    };
    expect(data).toMatchObject({ ok: true, strategy: "storageState" });
  });

  it("script: runs .demovie/auth.ts", async () => {
    mkdirSync(path.join(dir, ".demovie"), { recursive: true });
    writeFileSync(
      path.join(dir, ".demovie", "auth.ts"),
      `export default async ({ page, baseURL, env }: { page: any; baseURL: string; env: Record<string, string | undefined> }) => {
  await page.goto(new URL("/login", baseURL).toString());
  await page.getByLabel("Email").fill(env.DEMOVIE_USER ?? "");
  await page.getByLabel("Password").fill(env.DEMOVIE_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
};
`,
    );
    setStrategy(dir, { strategy: "script", script: ".demovie/auth.ts" });
    const data = (await authTest(createContext({ cwd: dir, yes: true, json: true }))).data as {
      ok: boolean;
      strategy: string;
      cookieNames: string[];
    };
    expect(data).toMatchObject({ ok: true, strategy: "script" });
    expect(data.cookieNames).toContain("harborly_session");
  });

  it("fails with a fix hint when credentials are wrong", async () => {
    setStrategy(dir, { strategy: "form", script: null });
    process.env.DEMOVIE_PASSWORD = "wrong-password";
    await expect(authTest(createContext({ cwd: dir, yes: true, json: true }))).rejects.toMatchObject({
      code: "E_AUTH",
      fix: expect.stringMatching(/DEMOVIE_USER\/DEMOVIE_PASSWORD/),
    });
    process.env.DEMOVIE_PASSWORD = FIXTURE_ENV.DEMOVIE_PASSWORD;
  });
});
