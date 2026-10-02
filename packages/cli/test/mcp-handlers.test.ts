import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syntheticProject } from "../../render/test/synthetic.ts";
import { mcpHandlers } from "../src/mcp-handlers.ts";

describe("MCP tool guards", () => {
  it("keeps capture ids and slugs inside the project", async () => {
    const p = syntheticProject("unit-mcp-guards", "");
    const tools = mcpHandlers(p.root);
    await expect(tools.get_elements({ captureId: "../../../etc" } as never, {} as never)).rejects.toMatchObject({
      code: "E_USAGE",
    });
    await expect(tools.qa({ slug: "../../elsewhere/videos/x" } as never, {} as never)).rejects.toMatchObject({
      code: "E_USAGE",
    });
    const ok = await tools.get_elements({ captureId: "routes/demo@desktop" } as never, {} as never);
    expect(JSON.stringify(ok.data)).toContain("button:create-shape");
  });

  it("asks for allowRemote before capturing an app that isn't local", async () => {
    const p = syntheticProject("unit-mcp-remote", "");
    writeFileSync(
      path.join(p.root, ".demovie/config.json"),
      JSON.stringify({
        version: 1,
        project: { name: "Synthetica", framework: "generic" },
        app: { url: "https://shop-production.invalid" },
      }),
    );
    writeFileSync(
      path.join(p.root, ".demovie/routes.json"),
      JSON.stringify({
        generatedAt: "2026-09-15T10:30:00.000Z",
        routes: [{ path: "/", file: null, dynamic: false, params: [], protected: false, source: "crawl" }],
      }),
    );
    const tools = mcpHandlers(p.root);
    await expect(tools.capture({ routes: ["/"] } as never, {} as never)).rejects.toMatchObject({
      code: "E_UNSAFE_URL",
    });
  });
});
