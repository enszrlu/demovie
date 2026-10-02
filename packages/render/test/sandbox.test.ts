import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { loadProject } from "@demovie/core";
import type { Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "../src/server.ts";
import { launchRenderer, openComposition } from "../src/session.ts";
import { resolveVideo } from "../src/video-dir.ts";
import { syntheticProject } from "./synthetic.ts";

/** GET with an explicit Host header (fetch can't set it). */
function get(port: number, urlPath: string, host = `127.0.0.1:${port}`): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: urlPath, headers: { host } }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("render sandbox and static server", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launchRenderer();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("serves only loopback hosts, and never follows a symlink out of a served folder", async () => {
    const p = syntheticProject("unit-sandbox-server", "");
    const outside = path.join(p.root, "outside-secret.txt");
    writeFileSync(outside, "s3cret");
    const assets = path.join(p.root, ".demovie/assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, "ok.txt"), "fine");
    symlinkSync(outside, path.join(assets, "logo.png"));
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const server = await startServer({ project, video });
    try {
      expect((await get(server.port, "/assets/ok.txt")).body).toBe("fine");
      expect((await get(server.port, "/assets/ok.txt", `localhost:${server.port}`)).status).toBe(200);
      expect((await get(server.port, "/assets/logo.png")).status).toBe(403);
      expect((await get(server.port, "/assets/ok.txt", `rebind.attacker.example:${server.port}`)).status).toBe(403);
      expect((await get(server.port, "/assets/%E0%A4%A")).status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("blocks WebSockets and WebRTC in compositions, and records the attempts", async () => {
    let upgrades = 0;
    const ws = createServer();
    ws.on("upgrade", (_req, socket) => {
      upgrades++;
      socket.destroy();
    });
    await new Promise<void>((resolve) => ws.listen(0, "127.0.0.1", () => resolve()));
    const wsPort = (ws.address() as AddressInfo).port;
    const p = syntheticProject(
      "unit-sandbox-ws",
      `import { createVideo } from "/__demovie/runtime.js";
const v = await createVideo();
v.shot("t", 0, 4, { kind: "title" });
window.__rtc = typeof RTCPeerConnection;
const socket = new WebSocket("ws://127.0.0.1:${wsPort}/leak");
window.__ws = await new Promise((resolve) => { socket.onopen = () => resolve("open"); socket.onclose = () => resolve("closed"); socket.onerror = () => resolve("error"); });
v.ready();`,
    );
    const project = await loadProject(p.root);
    const video = await resolveVideo(project, p.videoDir, p.root);
    const server = await startServer({ project, video });
    const comp = await openComposition(browser, server, { format: "16:9", scale: 0.25, timeoutMs: 15_000 });
    try {
      expect(await comp.page.evaluate("window.__rtc")).toBe("undefined");
      expect(await comp.page.evaluate("window.__ws")).not.toBe("open");
      expect(comp.blocked.some((u) => u.includes(`127.0.0.1:${wsPort}/leak`))).toBe(true);
      expect(upgrades).toBe(0);
    } finally {
      await comp.close();
      await server.close();
      ws.close();
    }
  });
});
