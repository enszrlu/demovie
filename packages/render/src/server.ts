import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { assetDir, isInside, type Project } from "@demovie/core";
import { transform } from "esbuild";
import type { VideoContext } from "./video-dir.ts";

const require = createRequire(import.meta.url);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

export interface StaticServer {
  origin: string;
  port: number;
  /** Every request with its status, for DM-A02 (4xx/5xx). */
  requests: { url: string; status: number }[];
  close(): Promise<void>;
}

export interface ServerOptions {
  project: Pick<Project, "paths" | "resolved">;
  video: VideoContext;
  port?: number;
  /** Extra handler (preview player, SSE); return true when handled. */
  extra?: (req: IncomingMessage, res: ServerResponse, url: URL) => boolean | Promise<boolean>;
}

export function gsapDir(): string {
  return path.dirname(require.resolve("gsap/package.json"));
}

/** Milliseconds since epoch for the composition's virtual clock (`demo.now`, else 2026-01-01). */
export function epochFor(project: Pick<Project, "resolved">): number {
  const now = project.resolved.demo.now;
  return now ? Date.parse(now) : Date.UTC(2026, 0, 1);
}

async function send(res: ServerResponse, file: string, transpile = false): Promise<number> {
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return 404;
  }
  const ext = path.extname(file).toLowerCase();
  const headers = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" };
  if (transpile && ext === ".ts") {
    const code = await readFile(file, "utf8");
    const out = await transform(code, {
      loader: "ts",
      format: "esm",
      target: "chrome120",
      sourcefile: file,
      sourcemap: "inline",
    });
    res.writeHead(200, headers).end(out.code);
    return 200;
  }
  res.writeHead(200, { ...headers, "content-length": statSync(file).size });
  createReadStream(file).pipe(res);
  return 200;
}

/** Map a URL path to a file under `base`, refusing traversal outside it. */
function under(base: string, rel: string): string | null {
  const decoded = decodeURIComponent(rel);
  const file = path.resolve(base, `.${path.sep}${decoded}`);
  return isInside(base, file) ? file : null;
}

/**
 * Local static server bound to 127.0.0.1 serving the SPEC §10.4 paths:
 * /__demovie/* (runtime, clock, CSS, GSAP, fonts, SFX), /brand/*, /captures/*, /assets/*, /audio/*,
 * /video.json, /glossary.json, and the composition folder (with `.ts` transpiled on the fly).
 */
export async function startServer(options: ServerOptions): Promise<StaticServer> {
  const { project, video } = options;
  const paths = project.paths;
  const runtime = assetDir("runtime");
  const fonts = assetDir("fonts");
  const sfx = assetDir("sfx");
  const gsap = gsapDir();
  const clockSource = path.join(runtime, "clock.js");
  const epoch = epochFor(project);
  const requests: StaticServer["requests"] = [];

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<number> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (options.extra && (await options.extra(req, res, url))) return res.statusCode;
    const p = url.pathname;
    const route = (prefix: string, base: string): string | null =>
      p.startsWith(prefix) ? under(base, p.slice(prefix.length)) : null;
    if (p === "/__demovie/clock.js") {
      if (!existsSync(clockSource)) {
        res.writeHead(500, { "content-type": "text/plain" }).end("runtime not built: run `pnpm build`");
        return 500;
      }
      res
        .writeHead(200, { "content-type": TYPES[".js"]!, "cache-control": "no-store" })
        .end(`window.__DEMOVIE_EPOCH__=${epoch};\n${readFileSync(clockSource, "utf8")}`);
      return 200;
    }
    if (p === "/__demovie/captures.json") {
      // Every capture's meta + element map in one response, so the runtime never needs synchronous requests.
      res
        .writeHead(200, { "content-type": TYPES[".json"]!, "cache-control": "no-store" })
        .end(JSON.stringify(await captureBundle(paths.capturesDir)));
      return 200;
    }
    let file: string | null = null;
    if (p.startsWith("/__demovie/gsap/")) file = route("/__demovie/gsap/", gsap);
    else if (p.startsWith("/__demovie/fonts/")) file = route("/__demovie/fonts/", fonts);
    else if (p.startsWith("/__demovie/sfx/")) file = route("/__demovie/sfx/", sfx);
    else if (p.startsWith("/__demovie/")) file = route("/__demovie/", runtime);
    else if (p.startsWith("/brand/")) file = route("/brand/", paths.brandDir);
    else if (p.startsWith("/captures/")) file = route("/captures/", paths.capturesDir);
    else if (p.startsWith("/assets/")) file = route("/assets/", paths.assetsDir);
    else if (p.startsWith("/audio/")) file = route("/audio/", video.audioDir);
    else if (p.startsWith("/__out/")) file = route("/__out/", video.outDir);
    else if (p === "/video.json") file = video.videoFile;
    else if (p === "/glossary.json") file = paths.glossaryJson;
    else file = under(video.compositionDir, p === "/" ? "index.html" : p.slice(1));
    if (!file) {
      res.writeHead(403, { "content-type": "text/plain" }).end("forbidden");
      return 403;
    }
    return send(res, file, true);
  };

  const server: Server = createServer((req, res) => {
    handle(req, res)
      .then((status) => {
        requests.push({ url: req.url ?? "/", status });
      })
      .catch((error: Error) => {
        requests.push({ url: req.url ?? "/", status: 500 });
        if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
        res.end(error.message);
      });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

/** `{ captures: { [id]: { meta, elements } } }` for every state under captures/ (found by its meta.json). */
export async function captureBundle(
  capturesDir: string,
): Promise<{ captures: Record<string, { meta: unknown; elements: unknown }> }> {
  const out: Record<string, { meta: unknown; elements: unknown }> = {};
  const walk = async (dir: string, rel: string): Promise<void> => {
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === "meta.json") && entries.some((e) => e.name === "elements.json")) {
      try {
        out[rel] = {
          meta: JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")),
          elements: JSON.parse(await readFile(path.join(dir, "elements.json"), "utf8")),
        };
      } catch {
        /* a half-written state; skip it */
      }
      return;
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith("."))
        await walk(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
    }
  };
  await walk(capturesDir, "");
  return { captures: out };
}
