// A tiny static server for the generic-mode fixture. Usage: node server.mjs [port]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "site");
const port = Number(process.argv[2] ?? process.env.PORT ?? 3002);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".js": "text/javascript",
};

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let file = path.join(root, urlPath);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`static-site on http://127.0.0.1:${port}\n`);
});
