import { describe, expect, it } from "vitest";
import { isAllowedLicense, isForbiddenLicense } from "../check-licenses.ts";

describe("license policy", () => {
  it("accepts permissive SPDX expressions", () => {
    expect(isAllowedLicense("MIT")).toBe(true);
    expect(isAllowedLicense("(MIT OR Apache-2.0)")).toBe(true);
    expect(isAllowedLicense("MIT AND ISC")).toBe(true);
    expect(isAllowedLicense("OFL-1.1")).toBe(true);
  });

  it("rejects unknown or copyleft licenses", () => {
    expect(isAllowedLicense("GPL-3.0")).toBe(false);
    expect(isAllowedLicense("MIT AND GPL-2.0")).toBe(false);
    expect(isAllowedLicense("CC-BY-4.0")).toBe(false);
  });

  it("flags the GPL family unless an alternative is offered", () => {
    expect(isForbiddenLicense("LGPL-3.0-or-later")).toBe(true);
    expect(isForbiddenLicense("AGPL-3.0")).toBe(true);
    expect(isForbiddenLicense("GPL-2.0 OR MIT")).toBe(false);
    expect(isForbiddenLicense("MIT")).toBe(false);
  });
});
