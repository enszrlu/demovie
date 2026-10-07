/**
 * Media for the website (site/): web-sized MP4s and posters of the example videos, the Harborly captures and element
 * maps behind the interactive demos, QA findings of the broken reference compositions, and the social card. Everything
 * comes from real renders and captures in this repo; the results are committed under site/media and site/data so the
 * Pages workflow can build the site without rendering anything.
 *
 * Needs Harborly's captures (`demovie capture`), a built CLI, and the videos rendered first:
 *
 *   node packages/cli/dist/index.js --cwd examples/harborly render launch            # and changelog, projects-board-teaser
 *   node packages/cli/dist/index.js --cwd examples/harborly render ../compositions/<style>-launch
 *   node packages/cli/dist/index.js --cwd examples/harborly render ../baseline-one-prompt --format 16:9
 *   pnpm site:media
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/repo.ts";

const CLI = path.join(repoRoot, "packages/cli/dist/index.js");
const HARBORLY = path.join(repoRoot, "examples/harborly");
const VIDEOS = path.join(HARBORLY, ".demovie/videos");
const CAPTURES = path.join(HARBORLY, ".demovie/captures");
const COMPOSITIONS = path.join(repoRoot, "examples/compositions");
const OUT = path.join(repoRoot, "site/media");
const DATA = path.join(repoRoot, "site/data");

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1]?.split(",") : undefined;
const want = (step: string) => !only || only.includes(step);

function ffmpeg(args: string[]): void {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
}

function requireFile(file: string, hint: string): string {
  if (!existsSync(file)) throw new Error(`${path.relative(repoRoot, file)} is missing. fix: ${hint}`);
  return file;
}

function size(file: string): string {
  return `${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`;
}

function report(file: string): void {
  process.stdout.write(`${path.relative(repoRoot, file)} · ${size(file)}\n`);
}

const H264 = [
  "-c:v",
  "libx264",
  "-profile:v",
  "high",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "slow",
  "-movflags",
  "+faststart",
];
const BT709 = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv";

/** A web copy of a rendered MP4 (smaller, faststart) plus a WebP poster at `posterAt`. */
function webVideo(id: string, src: string, width: number, posterAt: number, crf = 25): void {
  mkdirSync(path.join(OUT, "video"), { recursive: true });
  mkdirSync(path.join(OUT, "posters"), { recursive: true });
  const mp4 = path.join(OUT, "video", `${id}.mp4`);
  const hasAudio =
    execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", src],
      {
        encoding: "utf8",
      },
    ).trim() !== "";
  ffmpeg([
    "-i",
    src,
    "-vf",
    `scale=${width}:-2:flags=lanczos,${BT709}`,
    ...H264,
    "-crf",
    String(crf),
    ...(hasAudio ? ["-c:a", "aac", "-b:a", "96k"] : ["-an"]),
    mp4,
  ]);
  report(mp4);
  const poster = path.join(OUT, "posters", `${id}.webp`);
  ffmpeg([
    "-ss",
    String(posterAt),
    "-i",
    src,
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:-2:flags=lanczos`,
    "-quality",
    "82",
    poster,
  ]);
  report(poster);
}

function videoJson(dir: string): { duration: number; poster?: number | null; formats: string[] } {
  return JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
}

// ── example videos ────────────────────────────────────────────────────────────────────────────────────────────────
if (want("videos")) {
  const renderHint = (slug: string) => `node packages/cli/dist/index.js --cwd examples/harborly render ${slug}`;
  const harborly: { id: string; slug: string; at: number }[] = [
    { id: "harborly-launch", slug: "launch", at: 23 },
    { id: "harborly-changelog", slug: "changelog", at: 9.5 },
    { id: "harborly-teaser", slug: "projects-board-teaser", at: 8 },
  ];
  for (const v of harborly) {
    const dir = path.join(VIDEOS, v.slug);
    for (const format of videoJson(dir).formats) {
      const tag = format.replace(":", "x");
      const src = requireFile(path.join(dir, "out", `${v.slug}-${tag}.mp4`), renderHint(v.slug));
      webVideo(`${v.id}-${tag}`, src, format === "16:9" ? 1280 : 720, v.at);
    }
  }
  for (const style of ["clean", "bold", "soft", "editorial", "terminal"]) {
    const dir = path.join(COMPOSITIONS, `${style}-launch`);
    const info = videoJson(dir);
    const at = info.poster ?? Math.round(info.duration * 3) / 10;
    for (const format of info.formats) {
      const tag = format.replace(":", "x");
      const src = requireFile(
        path.join(dir, "out", `${style}-launch-${tag}.mp4`),
        renderHint(`../compositions/${style}-launch`),
      );
      webVideo(`style-${style}-${tag}`, src, format === "16:9" ? 1280 : 540, at, format === "16:9" ? 25 : 27);
    }
  }
}

// ── hero: the one-prompt baseline stacked on top of the grounded launch video, for the wipe player ───────────────────
if (want("hero")) {
  const top = requireFile(
    path.join(repoRoot, "examples/baseline-one-prompt/out/baseline-one-prompt-16x9.mp4"),
    "node packages/cli/dist/index.js --cwd examples/harborly render ../baseline-one-prompt --format 16:9",
  );
  const bottom = requireFile(
    path.join(VIDEOS, "launch/out/launch-16x9.mp4"),
    "node packages/cli/dist/index.js --cwd examples/harborly render launch",
  );
  const duration = 35;
  const W = 1280;
  const H = 720;
  const mp4 = path.join(OUT, "video", "hero-imagined-vs-real.mp4");
  mkdirSync(path.dirname(mp4), { recursive: true });
  ffmpeg([
    "-i",
    top,
    "-i",
    bottom,
    "-filter_complex",
    [
      `[0:v]scale=${W}:${H}:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=${duration}[t]`,
      `[1:v]scale=${W}:${H}:flags=lanczos,setsar=1[b]`,
      `[t][b]vstack=inputs=2,${BT709}[v]`,
    ].join(";"),
    "-map",
    "[v]",
    "-map",
    "1:a",
    "-t",
    String(duration),
    ...H264,
    "-crf",
    "26",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    mp4,
  ]);
  report(mp4);
  for (const [name, src, at] of [
    ["hero-imagined", top, 6],
    ["hero-real", bottom, 6],
  ] as const) {
    const poster = path.join(OUT, "posters", `${name}.webp`);
    mkdirSync(path.dirname(poster), { recursive: true });
    ffmpeg([
      "-ss",
      String(at),
      "-i",
      src,
      "-frames:v",
      "1",
      "-vf",
      `scale=${W}:${H}:flags=lanczos`,
      "-quality",
      "82",
      poster,
    ]);
    report(poster);
  }
  const comparison = path.join(repoRoot, "docs/media/comparison/harborly-brag-vs-demovie.mp4");
  const poster = path.join(OUT, "posters", "harborly-brag-vs-demovie.webp");
  ffmpeg(["-ss", "8", "-i", comparison, "-frames:v", "1", "-quality", "82", poster]);
  report(poster);
}

// ── captures: the element map explorer and the flow replay ─────────────────────────────────────────────────────────
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface CapturedElement {
  id: string;
  role: string;
  name: string;
  tag: string;
  text?: string;
  bbox: Box;
  visible: boolean;
  interactive: boolean;
  inViewport: boolean;
}

const round = (b: Box): Box => ({
  x: Math.round(b.x * 10) / 10,
  y: Math.round(b.y * 10) / 10,
  width: Math.round(b.width * 10) / 10,
  height: Math.round(b.height * 10) / 10,
});

function captureImage(dir: string, name: string, width = 2160): string {
  const src = requireFile(
    path.join(dir, "screen.png"),
    "node packages/cli/dist/index.js --cwd examples/harborly capture",
  );
  const file = path.join(OUT, "captures", `${name}.webp`);
  mkdirSync(path.dirname(file), { recursive: true });
  ffmpeg(["-i", src, "-vf", `scale=${width}:-2:flags=lanczos`, "-quality", "86", file]);
  report(file);
  return `media/captures/${name}.webp`;
}

if (want("captures")) {
  mkdirSync(DATA, { recursive: true });
  const dir = path.join(CAPTURES, "routes/app-projects@desktop");
  const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf8"));
  const map = JSON.parse(readFileSync(path.join(dir, "elements.json"), "utf8")) as { elements: CapturedElement[] };
  const elements = map.elements
    .filter((e) => e.visible && e.inViewport && e.bbox.width > 0 && e.bbox.height > 0)
    .map((e) => ({
      id: e.id,
      role: e.role,
      name: e.name,
      tag: e.tag,
      interactive: e.interactive,
      bbox: round(e.bbox),
    }));
  const elementMap = {
    captureId: meta.id,
    path: meta.path,
    title: meta.title,
    capturedAt: meta.capturedAt,
    viewport: { width: meta.viewport.width, height: meta.viewport.height, dpr: meta.dpr },
    image: captureImage(dir, "app-projects"),
    elements,
  };
  writeFileSync(path.join(DATA, "element-map.json"), `${JSON.stringify(elementMap, null, 1)}\n`);
  process.stdout.write(`site/data/element-map.json · ${elements.length} elements\n`);

  const flowDir = path.join(CAPTURES, "flows/create-project@desktop");
  const flow = JSON.parse(readFileSync(path.join(flowDir, "flow.json"), "utf8")) as {
    name: string;
    states: string[];
    steps: {
      action: string;
      description: string;
      state: string;
      value?: string;
      target: { elementId: string; bbox: Box } | null;
    }[];
  };
  const yaml = readFileSync(path.join(HARBORLY, ".demovie/flows/create-project.flow.yaml"), "utf8");
  const states = flow.states.map((state) => {
    const stateMeta = JSON.parse(readFileSync(path.join(flowDir, state, "meta.json"), "utf8"));
    return {
      id: state,
      captureId: stateMeta.id,
      path: stateMeta.path,
      image: captureImage(path.join(flowDir, state), `flow-${state}`, 1600),
    };
  });
  const steps = flow.steps
    .filter((s) => s.target)
    .map((s) => ({
      action: s.action,
      description: s.description,
      from: s.state,
      value: s.value ?? null,
      elementId: s.target!.elementId,
      bbox: round(s.target!.bbox),
    }));
  writeFileSync(
    path.join(DATA, "flow.json"),
    `${JSON.stringify({ name: flow.name, viewport: elementMap.viewport, yaml, states, steps }, null, 1)}\n`,
  );
  process.stdout.write(`site/data/flow.json · ${states.length} states, ${steps.length} targeted steps\n`);
}

// ── QA: what the checks catch in the deliberately broken reference compositions ─────────────────────────────────────
if (want("qa")) {
  const cases: { slug: string; at: number; label: string }[] = [
    { slug: "bad-ai-look", at: 0, label: "The “AI look”" },
    { slug: "bad-truth", at: 0, label: "Invented facts" },
    { slug: "bad-text", at: 0, label: "Unreadable text" },
    { slug: "bad-layout", at: 0, label: "Broken layout" },
  ];
  const out = [];
  for (const c of cases) {
    const dir = path.join(COMPOSITIONS, c.slug);
    const qaFile = path.join(dir, "qa.json");
    const run = spawnSync(
      process.execPath,
      [CLI, "--cwd", HARBORLY, "qa", `../compositions/${c.slug}`, "--format", "16:9"],
      {
        stdio: "ignore",
      },
    );
    if (!existsSync(qaFile)) throw new Error(`demovie qa ${c.slug} wrote no qa.json (exit ${run.status})`);
    const qa = JSON.parse(readFileSync(qaFile, "utf8"));
    const qaReport = qa.reports[0];
    const stills = spawnSync(
      process.execPath,
      [
        CLI,
        "--cwd",
        HARBORLY,
        "stills",
        `../compositions/${c.slug}`,
        "--at",
        String(c.at),
        "--format",
        "16:9",
        "--scale",
        "1",
      ],
      { stdio: "ignore" },
    );
    if (stills.status !== 0) throw new Error(`demovie stills ${c.slug} failed (exit ${stills.status})`);
    const still = path.join(dir, "out/stills/16x9", `t${c.at.toFixed(2).padStart(6, "0")}.png`);
    const image = path.join(OUT, "qa", `${c.slug}.webp`);
    mkdirSync(path.dirname(image), { recursive: true });
    ffmpeg([
      "-i",
      requireFile(still, `demovie stills ../compositions/${c.slug}`),
      "-vf",
      "scale=1280:-2",
      "-quality",
      "86",
      image,
    ]);
    report(image);
    out.push({
      slug: c.slug,
      label: c.label,
      at: c.at,
      image: `media/qa/${c.slug}.webp`,
      stage: { width: 1920, height: 1080 },
      summary: qaReport.summary,
      findings: qaReport.rules
        .filter((r: { status: string }) => r.status === "fail")
        .map((r: { id: string; title: string; severity: string; message: string; fix: string; occurrences: any[] }) => {
          const boxes = r.occurrences
            .filter((o) => o.bbox && o.t <= c.at + 0.05 && (o.until ?? o.t) >= c.at - 0.05)
            .map((o) => round(o.bbox));
          return {
            id: r.id,
            title: r.title,
            severity: r.severity,
            t: r.occurrences[0]?.t ?? null,
            message: r.message,
            fix: r.fix,
            boxes: boxes.filter((b, i) => boxes.findIndex((o) => JSON.stringify(o) === JSON.stringify(b)) === i),
          };
        }),
    });
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path.join(DATA, "qa-cases.json"), `${JSON.stringify(out, null, 1)}\n`);
  process.stdout.write("site/data/qa-cases.json\n");
}

// ── share copy written by the skill next to each Harborly video (out/share.md is gitignored) ───────────────────────
if (want("share")) {
  const share: Record<string, string> = {};
  for (const slug of ["launch", "changelog", "projects-board-teaser"]) {
    const file = path.join(VIDEOS, slug, "out/share.md");
    if (existsSync(file)) share[slug] = readFileSync(file, "utf8");
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path.join(DATA, "share.json"), `${JSON.stringify(share, null, 1)}\n`);
  process.stdout.write(`site/data/share.json · ${Object.keys(share).length} videos\n`);
}

// ── real CLI output for the "how it works" panels: qa and render of the Harborly launch video ──────────────────────
if (want("terminal")) {
  const cli = (args: string[]) => {
    const r = spawnSync(process.execPath, [CLI, "--cwd", HARBORLY, ...args], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    if (r.status !== 0) throw new Error(`demovie ${args.join(" ")} exited ${r.status}: ${r.stderr}`);
    return `${r.stderr}${r.stdout}`.replace(/\x1b\[[0-9;]*m/g, "").trim();
  };
  const status = cli(["status"]);
  const qa = cli(["qa", "launch", "--format", "all"]);
  const qaJson = JSON.parse(readFileSync(path.join(VIDEOS, "launch/qa.json"), "utf8"));
  const rules = qaJson.reports[0].rules.map((r: { id: string; title: string; status: string }) => ({
    id: r.id,
    title: r.title,
    status: r.status,
  }));
  // a cold render (no cached frames), so the timings shown are the honest ones
  cli(["clean"]);
  const render = cli(["render", "launch", "--format", "all"]);
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path.join(DATA, "terminal.json"), `${JSON.stringify({ status, qa, rules, render }, null, 1)}\n`);
  process.stdout.write("site/data/terminal.json\n");
}

// ── the social card (og:image): the headline over the imagined-vs-real split, rendered in Chromium ─────────────────
if (want("og")) {
  const { chromium } = await import("playwright-core");
  const fonts = path.join(repoRoot, "packages/runtime/fonts");
  // inline everything: a page set with setContent can't load file:// URLs
  const MIME: Record<string, string> = { ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp" };
  const asset = (file: string) =>
    `data:${MIME[path.extname(file)] ?? "application/octet-stream"};base64,${readFileSync(file).toString("base64")}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Geist; src: url("${asset(path.join(fonts, "geist-variable.woff2"))}"); font-weight: 100 900; }
  @font-face { font-family: "Geist Mono"; src: url("${asset(path.join(fonts, "geist-mono-variable.woff2"))}"); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #0b0b0d; color: #f3f1ec; font-family: Geist; overflow: hidden; position: relative; }
  .glow { position: absolute; inset: 0; background: radial-gradient(60% 60% at 30% 0%, rgb(255 178 36 / .22), transparent 70%); }
  .copy { position: absolute; left: 72px; top: 60px; width: 660px; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 650; letter-spacing: -.035em; }
  .brand img { width: 44px; height: 44px; }
  h1 { margin-top: 56px; font-size: 62px; line-height: .98; font-weight: 680; letter-spacing: -.055em; }
  h1 span { color: #77736b; }
  h1 u { text-decoration: none; background: linear-gradient(transparent 82%, #ffb224 82%, #ffb224 94%, transparent 94%); }
  p { margin-top: 24px; width: 560px; color: #aaa69e; font-size: 22px; line-height: 1.45; }
  .mono { position: absolute; left: 72px; bottom: 56px; font-family: "Geist Mono"; font-size: 20px; color: #f3f1ec; padding: 12px 18px; border: 1px solid rgb(255 255 255 / .14); border-radius: 12px; background: rgb(255 255 255 / .05); }
  .mono b { color: #ffb224; font-weight: 500; }
  .split { position: absolute; right: -110px; top: 140px; width: 560px; height: 315px; border-radius: 16px; overflow: hidden; box-shadow: 0 30px 80px rgb(0 0 0 / .6), 0 0 0 1px rgb(255 255 255 / .1); transform: perspective(1400px) rotateY(-14deg); }
  .split img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .split .real { clip-path: inset(0 0 0 50%); }
  .split i { position: absolute; top: 0; bottom: 0; left: 50%; width: 3px; margin-left: -1.5px; background: #fff; box-shadow: 0 0 24px rgb(255 178 36 / .8); }
  .tag { position: absolute; bottom: 14px; padding: 5px 12px; border-radius: 99px; background: rgb(10 10 12 / .75); font-size: 15px; font-weight: 550; }
  </style></head><body><div class="glow"></div>
  <div class="copy"><div class="brand"><img src="${asset(path.join(repoRoot, "site/src/assets/img/logo.svg"))}">demovie</div>
  <h1>Your agent animates.<br><span>demovie makes it</span> <u>true.</u></h1>
  <p>Motion-graphics videos of your real web app, from real captures, checked by QA before they render.</p></div>
  <div class="mono"><b>$</b> npx demovie init</div>
  <div class="split"><img src="${asset(path.join(OUT, "posters/hero-imagined.webp"))}"><img class="real" src="${asset(path.join(OUT, "posters/hero-real.webp"))}"><i></i><span class="tag" style="left:14px">Imagined</span><span class="tag" style="right:130px">Real</span></div>
  </body></html>`;
  const browser = await chromium.launch();
  try {
    const pageHandle = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await pageHandle.setContent(html, { waitUntil: "load" });
    await pageHandle.evaluate(() => document.fonts.ready);
    const og = path.join(OUT, "og.png");
    await pageHandle.screenshot({ path: og });
    report(og);
    // the home-screen icon iOS asks for (it doesn't take SVG)
    const iconPage = await browser.newPage({ viewport: { width: 180, height: 180 } });
    await iconPage.setContent(
      `<body style="margin:0;background:#ffb224"><img src="${asset(path.join(repoRoot, "site/src/assets/img/logo.svg"))}" style="width:180px;height:180px;display:block;transform:scale(1.06)"></body>`,
      { waitUntil: "load" },
    );
    const touchIcon = path.join(OUT, "apple-touch-icon.png");
    await iconPage.screenshot({ path: touchIcon });
    report(touchIcon);
  } finally {
    await browser.close();
  }
}
