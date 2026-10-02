import { describe, expect, it } from "vitest";
import { sameSite } from "../src/auth.ts";

describe("sameSite (which cookies a saved session keeps)", () => {
  it("keeps the app's host, its parent domain and sibling subdomains, and drops other sites", () => {
    expect(sameSite("localhost", "localhost")).toBe(true);
    expect(sameSite("app.example.com", "app.example.com")).toBe(true);
    expect(sameSite(".example.com", "app.example.com")).toBe(true);
    expect(sameSite("auth.example.com", "app.example.com")).toBe(true);
    expect(sameSite("accounts.google.com", "app.example.com")).toBe(false);
    expect(sameSite(".github.com", "localhost")).toBe(false);
    expect(sameSite("127.0.0.1", "localhost")).toBe(false);
  });
});
