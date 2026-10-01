import { simpleGlobToRegExp } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { fictional, PATTERNS, redactText } from "../src/redact.ts";

const opts = {
  patterns: ["email", "phone", "secret"] as const,
  allow: [simpleGlobToRegExp("*@harborly.demo")],
  mode: "fictional" as const,
};

describe("redaction patterns", () => {
  it("replaces emails except allow-listed ones", () => {
    const counts: Record<string, number> = {};
    const out = redactText(
      "Contact maya.chen@acme-rockets.example or demo@harborly.demo",
      { ...opts, patterns: [...opts.patterns] },
      counts,
    );
    expect(out).not.toContain("acme-rockets");
    expect(out).toContain("demo@harborly.demo");
    expect(out).toMatch(/@example\.(com|org|net)/);
    expect(counts).toEqual({ email: 1 });
  });

  it("replaces secrets keeping a recognizable prefix", () => {
    const out = redactText("key sk\u005flive_51HbX9qLmT4vR2cK8nWd3pZ7 and ghp_0123456789abcdefghijABCDEFGHIJ", {
      ...opts,
      patterns: [...opts.patterns],
    });
    expect(out).toContain("sk_live_••••");
    expect(out).not.toContain("51HbX9");
    expect(out).toContain("ghp_••••");
    expect(redactText("AKIAABCDEFGHIJKLMNOP", { ...opts, patterns: ["secret"] })).toMatch(/^AKIA•+$/);
    expect(
      redactText("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", {
        ...opts,
        patterns: ["secret"],
      }),
    ).toMatch(/^eyJ•+$/);
  });

  it("replaces phone numbers but not dates or ids", () => {
    const out = redactText("Call +1 (415) 555-0132 or 415-555-0199. Due 2026-09-15, order 12345.", {
      ...opts,
      patterns: ["phone"],
    });
    expect(out).not.toContain("415");
    expect(out).toContain("2026-09-15");
    expect(out).toContain("12345");
  });

  it("is deterministic and length-similar", () => {
    expect(fictional("email", "maya.chen@acme-rockets.example")).toBe(
      fictional("email", "maya.chen@acme-rockets.example"),
    );
    expect(Math.abs(fictional("email", "a.b@c.io").length - 8)).toBeLessThan(15);
    expect(redactText("x@y.co", { patterns: ["email"], allow: [], mode: "dots" })).toBe("•••");
    expect(Object.keys(PATTERNS)).toEqual(["email", "phone", "secret"]);
  });
});
