import { afterEach, describe, expect, it } from "vitest";
import { createContext } from "../src/context.ts";
import { confirmCost } from "../src/lib/audio.ts";

const ci = process.env.CI;
afterEach(() => {
  if (ci === undefined) delete process.env.CI;
  else process.env.CI = ci;
});

describe("consent", () => {
  it("treats CI as --yes for prompts, but never as consent to a paid call", async () => {
    process.env.CI = "true";
    const ctx = createContext({ json: true });
    expect(ctx.yes).toBe(true);
    expect(ctx.confirmed).toBe(false);
    await expect(confirmCost(ctx, "ElevenLabs: 3 lines, ≈ $0.02")).rejects.toMatchObject({ code: "E_USAGE" });
    await expect(confirmCost(createContext({ json: true, yes: true }), "ElevenLabs")).resolves.toBeUndefined();
  });
});
