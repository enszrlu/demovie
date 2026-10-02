import { describe, expect, it } from "vitest";
import { launchFailure } from "../src/browser.ts";

describe("launchFailure", () => {
  it("points a missing browser at doctor --fix", () => {
    const e = launchFailure(
      new Error("browserType.launch: Executable doesn't exist at /x/chrome-headless-shell\n╔═══╗"),
    );
    expect(e.message).toMatch(/is not installed/);
    expect(e.fix).toContain("doctor --fix");
  });

  it("points missing Linux libraries at install-deps", () => {
    const e = launchFailure(
      new Error(
        "browserType.launch: \n╔══╗\n║ Host system is missing dependencies to run browsers. ║\n║ Please install them with the following command: ║",
      ),
    );
    expect(e.message).toMatch(/missing libraries/);
    expect(e.fix).toMatch(/sudo npx -y playwright-core@\d+\.\d+\.\d+ install-deps chromium/);
  });

  it("reports the first meaningful line of anything else", () => {
    const e = launchFailure(new Error("browserType.launch: \nTarget page, context or browser has been closed\nmore"));
    expect(e.message).toBe("could not launch Chromium: Target page, context or browser has been closed");
    expect(e.fix).toContain("doctor");
  });
});
