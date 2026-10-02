import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "../src/browser.ts";
import { routeAppHeaders } from "../src/context.ts";

async function listen(
  handler: (headers: IncomingHttpHeaders, url: string) => string,
): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const body = handler(req.headers, req.url ?? "/");
    res.writeHead(200, { "content-type": req.url === "/" ? "text/html" : "image/svg+xml" }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe("app headers", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launchChromium();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("go to the app's origin only, never to third parties the page loads", async () => {
    const seen: { origin: string; bypass: string | undefined; cookie: string | undefined }[] = [];
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
    const third = await listen((h) => {
      seen.push({ origin: "third", bypass: h["x-bypass"] as string | undefined, cookie: h.cookie });
      return svg;
    });
    const app = await listen((h, url) => {
      seen.push({ origin: "app", bypass: h["x-bypass"] as string | undefined, cookie: h.cookie });
      return url === "/" ? `<html><body><img src="${third.origin}/pixel.svg"><img src="/logo.svg"></body></html>` : svg;
    });
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: "session", value: "abc", url: app.origin }]);
      await routeAppHeaders(context, `${app.origin}/`, { "x-bypass": "s3cret" });
      const page = await context.newPage();
      await page.goto(`${app.origin}/`, { waitUntil: "load" });
      const fromApp = seen.filter((s) => s.origin === "app");
      expect(fromApp.length).toBeGreaterThanOrEqual(2);
      expect(fromApp.every((s) => s.bypass === "s3cret" && s.cookie === "session=abc")).toBe(true);
      expect(seen.filter((s) => s.origin === "third").map((s) => s.bypass)).toEqual([undefined]);
    } finally {
      await context.close();
      app.server.close();
      third.server.close();
    }
  });
});
