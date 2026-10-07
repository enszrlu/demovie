/**
 * Build the website into site/dist: the landing page, the gallery, every doc under docs/, a search index, a sitemap
 * and a 404 page. Media comes from site/media and site/data (see scripts/build-site-media.ts).
 *
 *   pnpm site:build              # build once
 *   pnpm site:dev                # build, serve on http://localhost:4321 and rebuild on changes
 */

import { spawn } from "node:child_process";
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readQaRules } from "./lib/data.ts";
import { initHighlighter } from "./lib/markdown.ts";
import { icon, page, SITE_URL } from "./lib/site.ts";
import { readVideos } from "./lib/videos.ts";
import { buildDocs, docPath, type SearchEntry } from "./pages/docs.ts";
import { buildGallery } from "./pages/gallery.ts";
import { buildHome } from "./pages/home.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const siteDir = path.join(repoRoot, "site");
const dist = path.join(siteDir, "dist");

/** Repo paths the site publishes, mapped to their site paths; everything else links to GitHub. */
function publish(repoPath: string): string | undefined {
  if (/^docs\/.*\.md$/.test(repoPath)) return docPath(repoPath);
  if (repoPath.startsWith("docs/media/")) return repoPath;
  if (repoPath === "README.md") return "";
  return undefined;
}

function posterFor(fileName: string): string | undefined {
  const poster = path.join(siteDir, "media/posters", fileName.replace(/\.mp4$/, ".webp"));
  return existsSync(poster) ? `media/posters/${path.basename(poster)}` : undefined;
}

function write(file: string, content: string): void {
  const out = path.join(dist, file);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, content);
}

function copyDir(from: string, to: string, filter: (file: string) => boolean = () => true): void {
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true, filter: (src) => statSync(src).isDirectory() || filter(src) });
}

function requireMedia(): void {
  const needed = ["data/element-map.json", "data/flow.json", "data/qa-cases.json", "data/terminal.json", "media/video"];
  const missing = needed.filter((f) => !existsSync(path.join(siteDir, f)));
  if (missing.length)
    throw new Error(`site/${missing.join(", site/")} missing. fix: run \`pnpm site:media\` (needs local renders)`);
}

export async function build(): Promise<{ pages: number; seconds: number }> {
  const started = Date.now();
  requireMedia();
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  copyDir(path.join(siteDir, "src/assets"), path.join(dist, "assets"));
  copyDir(path.join(repoRoot, "packages/runtime/fonts"), path.join(dist, "assets/fonts"), (f) =>
    /\.(woff2|txt)$/.test(f),
  );
  copyDir(path.join(siteDir, "media"), path.join(dist, "media"));
  copyDir(path.join(repoRoot, "docs/media"), path.join(dist, "docs/media"), (f) => !f.endsWith(".gif"));

  await initHighlighter();
  const rules = readQaRules(repoRoot);
  const videos = readVideos(repoRoot);
  const terminal = readJson<{
    status: string;
    qa: string;
    render: string;
    rules: { id: string; title: string; status: string }[];
  }>(path.join(siteDir, "data/terminal.json"));
  const share = existsSync(path.join(siteDir, "data/share.json"))
    ? readJson<Record<string, string>>(path.join(siteDir, "data/share.json"))
    : {};

  const files: string[] = [];
  const emit = (file: string, html: string) => {
    write(file, html);
    files.push(file);
  };

  emit("index.html", buildHome({ repoRoot, rules, videos, publish, terminal }));
  emit("gallery/index.html", buildGallery(videos, share));
  const docs = buildDocs(repoRoot, publish, posterFor);
  for (const p of docs.pages) emit(p.file, p.html);

  const search: SearchEntry[] = [
    ...docs.search,
    {
      page: "Gallery",
      heading: "Made with demovie",
      url: "gallery/",
      text: videos.map((v) => `${v.name} ${v.blurb}`).join(" "),
    },
  ];
  write("search-index.json", JSON.stringify(search));

  // GitHub Pages serves 404.html for any missing path, so its links must be absolute.
  const base = new URL(SITE_URL).pathname;
  write(
    "404.html",
    page({
      file: "404.html",
      root: base,
      title: "Not found",
      styles: ["site.css", "home.css"],
      scripts: ["site.js"],
      solidHeader: true,
      body: `<div class="wrap"><section class="page-hero" style="min-height:52vh;display:grid;align-content:center">
        <p class="kicker">404</p>
        <h1>This shot isn't in the storyboard.</h1>
        <p class="lede">The page you asked for doesn't exist, or it moved when the docs were reorganized.</p>
        <div class="hero-ctas" style="justify-content:flex-start"><a class="btn btn-primary" href="${base}">Back to the overview ${icon.arrow}</a><a class="btn" href="${base}docs/">Browse the docs</a><button class="btn" type="button" data-search-open>Search the docs</button></div>
      </section></div>`,
    }),
  );

  const urls = files.map((f) => SITE_URL + f.replace(/index\.html$/, ""));
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`,
  );
  write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);

  const broken = checkLinks(files);
  if (broken.length) throw new Error(`broken links in site/dist:\n  ${broken.join("\n  ")}`);
  return { pages: files.length + 1, seconds: (Date.now() - started) / 1000 };
}

/** Every relative link, asset and anchor on the built pages resolves (videos and posters in inline JSON too). */
function checkLinks(files: string[]): string[] {
  const problems: string[] = [];
  const ids = new Map<string, Set<string>>();
  const idsOf = (file: string) => {
    let found = ids.get(file);
    if (!found) {
      const html = existsSync(path.join(dist, file)) ? readFileSync(path.join(dist, file), "utf8") : "";
      found = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
      ids.set(file, found);
    }
    return found;
  };
  for (const file of files) {
    const html = readFileSync(path.join(dist, file), "utf8");
    const dir = path.posix.dirname(file);
    const refs = [
      ...[...html.matchAll(/\s(?:href|src|poster|data-src|data-format-src|data-format-poster)="([^"]+)"/g)].map(
        (m) => m[1]!,
      ),
      ...[...html.matchAll(/"((?:\.\.\/)*media\/[^"]+\.(?:mp4|webp|png))"/g)].map((m) => m[1]!),
    ];
    for (const raw of refs) {
      const ref = raw.replace(/&amp;/g, "&");
      if (/^(https?:|mailto:|data:)/.test(ref)) continue;
      const [target = "", hash] = ref.split("#");
      let resolved = target ? path.posix.normalize(path.posix.join(dir, target)) : file;
      if (target && (target.endsWith("/") || resolved === ".")) resolved = path.posix.join(resolved, "index.html");
      if (resolved.startsWith("..") || !existsSync(path.join(dist, resolved))) {
        problems.push(`${file}: ${ref} (→ ${resolved}) is missing`);
        continue;
      }
      if (hash && resolved.endsWith(".html") && !idsOf(resolved).has(decodeURIComponent(hash)))
        problems.push(`${file}: ${ref} has no #${hash} anchor`);
    }
  }
  return problems;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

/** A small static server that mimics GitHub Pages under its base path (index.html for directories, 404.html). */
function serve(port: number): void {
  const base = new URL(SITE_URL).pathname;
  createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(302, { location: base });
      res.end();
      return;
    }
    const rel = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname.slice(1);
    let file = path.join(dist, decodeURIComponent(rel));
    if (!file.startsWith(dist)) file = dist;
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(301, { location: `${url.pathname}/` });
        res.end();
        return;
      }
      file = path.join(file, "index.html");
    }
    const found = existsSync(file);
    const target = found ? file : path.join(dist, "404.html");
    const size = statSync(target).size;
    const type = TYPES[path.extname(target)] ?? "application/octet-stream";
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (found && range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, {
        "content-type": type,
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
      });
      createReadStream(target, { start, end }).pipe(res);
      return;
    }
    res.writeHead(found ? 200 : 404, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
    createReadStream(target).pipe(res);
  }).listen(port, () => process.stderr.write(`serving site/dist at http://localhost:${port}${base}\n`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = (r: { pages: number; seconds: number }) =>
    process.stderr.write(`site built: ${r.pages} pages in ${r.seconds.toFixed(1)} s → site/dist\n`);
  report(await build());
  if (process.argv.includes("--serve")) {
    const portArg = process.argv.indexOf("--port");
    serve(portArg > 0 ? Number(process.argv[portArg + 1]) : 4321);
    // rebuild in a fresh process so edited page modules are re-imported
    let timer: NodeJS.Timeout | undefined;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], { stdio: "inherit" }),
        150,
      );
    };
    for (const dir of [path.join(siteDir, "src"), path.join(siteDir, "data"), path.join(repoRoot, "docs")])
      watch(dir, { recursive: true }, rebuild);
  }
}
