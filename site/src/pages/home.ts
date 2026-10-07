/** The landing page. Copy and numbers come from the README and docs; media from real renders and captures. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { type QaRule, readJson } from "../lib/data.ts";
import {
  codeBlock,
  copyButton,
  escapeHtml,
  type LinkContext,
  markdownSections,
  renderMarkdown,
} from "../lib/markdown.ts";
import { DESCRIPTION, icon, page, REPO_URL } from "../lib/site.ts";
import { posterSrc, type SiteVideo, videoSrc } from "../lib/videos.ts";

export interface HomeInput {
  repoRoot: string;
  rules: QaRule[];
  videos: SiteVideo[];
  publish: LinkContext["publish"];
  /** Real CLI output captured by scripts/build-site-media.ts (site/data/terminal.json). */
  terminal: { status: string; qa: string; render: string; rules: { id: string; title: string; status: string }[] };
}

const md = (source: string, ctx: LinkContext) => renderMarkdown(source, ctx, { anchors: false }).html;

/** Inline code spans in plain copy: `x` → <code>x</code>. */
const inline = (text: string) => escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");

function json(id: string, data: unknown): string {
  return `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/** Colorize captured terminal output a little: ✓ green, ✗/error red, paths and numbers left alone. */
function term(text: string): string {
  return escapeHtml(text)
    .split("\n")
    .map((line) =>
      line
        .replace(/^(\$ )(.*)$/, '<span class="p">$1</span>$2')
        .replace(/(#.*)$/, '<span class="c">$1</span>')
        .replace(/(✓|0 errors?|0E\/0W|0 warnings?)/g, '<span class="ok">$1</span>')
        .replace(/^(◇.*)$/, '<span class="c">$1</span>'),
    )
    .join("\n");
}

export function buildHome(input: HomeInput): string {
  const { repoRoot, rules, videos } = input;
  const root = "";
  const docsCtx = (source: string): LinkContext => ({ source, pageDir: "", publish: input.publish });
  const elementMap = readJson<any>(path.join(repoRoot, "site/data/element-map.json"));
  const flow = readJson<any>(path.join(repoRoot, "site/data/flow.json"));
  const qaCases = readJson<any[]>(path.join(repoRoot, "site/data/qa-cases.json"));
  const comparison = markdownSections(readFileSync(path.join(repoRoot, "docs/comparison.md"), "utf8"));
  const faq = markdownSections(readFileSync(path.join(repoRoot, "docs/faq.md"), "utf8"));
  const byId = (id: string) => videos.find((v) => v.id === id)!;
  const launch = byId("harborly-launch");
  const changelog = byId("harborly-changelog");
  const teaser = byId("harborly-teaser");

  // ── hero ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const hero = `<section class="hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap">
    <div class="hero-copy">
      <a class="hero-badge reveal" href="${REPO_URL}" rel="noopener"><b>MIT</b><span>Open source<span class="hide-sm">, for Claude Code, Codex and Cursor</span></span> ${icon.arrow.replace("<svg", '<svg width="14" height="14"')}</a>
      <h1 class="reveal" style="--delay:.05s"><span class="line">Your agent animates.</span><span class="line"><span class="dim">demovie makes it</span> <span class="true">true.</span></span></h1>
      <p class="hero-sub reveal" style="--delay:.12s">Accurate, on-brand motion-graphics videos of your real web app: launch videos, feature clips, changelogs and teasers, made by the coding agent you already use from real captures of your running app, and checked by 30 QA rules before they render.</p>
      <div class="hero-ctas reveal" style="--delay:.18s">
        <div class="cmd"><span class="prompt">$</span><span>npx demovie init</span>${copyButton("Copy command")}</div>
        <a class="btn" href="docs/getting-started/">Read the docs ${icon.arrow}</a>
      </div>
      <div class="hero-meta reveal" style="--delay:.24s">
        <span>${icon.check}Real captures, not imagination</span>
        <span>${icon.check}Your brand and your words</span>
        <span>${icon.check}16:9, 9:16, 1:1 and 4:5</span>
        <span>${icon.check}No telemetry</span>
      </div>
    </div>
    <div class="hero-stage reveal" style="--delay:.3s">
      <div class="wipe" data-wipe data-mode="wipe">
        <div class="wipe-frame">
          <div class="wipe-stage" data-wipe-stage>
            <div class="wipe-fallback"><img src="media/posters/hero-imagined.webp" alt="" width="1280" height="720"><img src="media/posters/hero-real.webp" alt="" width="1280" height="720"></div>
            <canvas data-wipe-canvas width="1280" height="720" role="img" aria-label="A video comparison. Left: an imagined dashboard from one prompt with no captures. Right: Harborly's real Projects board, made with demovie from captures."></canvas>
            <span class="wipe-label left"><span class="dot"></span>Imagined <small>one prompt, no captures</small></span>
            <span class="wipe-label right"><span class="dot"></span>Real <small>demovie, from captures</small></span>
            <div class="wipe-divider" aria-hidden="true"></div>
            <button class="wipe-handle" type="button" role="slider" aria-label="Drag to compare" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" data-wipe-handle>${icon.drag}</button>
          </div>
          <video data-wipe-video muted loop playsinline preload="auto" src="media/video/hero-imagined-vs-real.mp4"></video>
          <div class="wipe-controls">
            <button class="player-btn is-on" type="button" data-play aria-label="Pause"><span class="when-off">${icon.play}</span><span class="when-on">${icon.pause}</span></button>
            <button class="player-btn" type="button" data-mute aria-label="Turn sound on"><span class="when-off">${icon.muted}</span><span class="when-on">${icon.sound}</span></button>
            <div class="scrub" data-scrub role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0" aria-valuemax="35" aria-valuenow="0"><div class="scrub-fill"></div></div>
            <span class="time" data-time>0:00 / 0:35</span>
            <div class="seg" role="group" aria-label="Compare mode"><button type="button" aria-pressed="true" data-mode-btn="wipe">Wipe</button><button type="button" aria-pressed="false" data-mode-btn="side">Side by side</button></div>
          </div>
        </div>
        <p class="wipe-caption fine">Left: a recreation of what one prompt and no captures typically gives you: an imagined dashboard, invented metrics, HUD labels. Right: demovie, from real captures of the app, in the product's own words, with a cursor that clicks real buttons. Sound is the right-hand video's soundtrack, synthesized by demovie.</p>
      </div>
    </div>
    <div class="agents-strip reveal">
      <p>Drives the agent you already use, installed and signed in by you</p>
      <div class="agents-row"><span>Claude Code</span><span>Codex CLI</span><span>Cursor</span><span>Any MCP client</span><span>Any skills-aware agent</span></div>
    </div>
  </div>
</section>`;

  // ── proof ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const proof = `<section class="section" style="padding-top:clamp(64px,8vw,96px)">
  <div class="wrap">
    <div class="proof reveal">
      <div><b>${rules.length}</b><span>QA rules run on every video before the final render, each with a fix.</span></div>
      <div><b>4 <small>formats</small></b><span>16:9, 9:16, 1:1 and 4:5, each laid out on its own, from one composition.</span></div>
      <div><b>3m 21s</b><span>of agent time for the Harborly teaser, from one command in a project already set up. QA 0 errors.<sup><a href="#compare" aria-label="Source: the comparison below">[1]</a></sup></span></div>
      <div><b>0</b><span>telemetry. Captures and videos stay in your repo's <code>.demovie/</code> folder.</span></div>
    </div>
  </div>
</section>`;

  // ── how it works ────────────────────────────────────────────────────────────────────────────────────────────────
  const tagged = ["link:new-project", "link:q3-launch", "dm:health-prj_android-app-v2"].map((id) =>
    elementMap.elements.find((e: any) => e.id === id),
  );
  const pct = (b: any) =>
    `left:${((b.x / elementMap.viewport.width) * 100).toFixed(2)}%;top:${((b.y / elementMap.viewport.height) * 100).toFixed(2)}%;width:${((b.width / elementMap.viewport.width) * 100).toFixed(2)}%;height:${((b.height / elementMap.viewport.height) * 100).toFixed(2)}%`;
  const groundBoxes = elementMap.elements
    .filter((e: any) => e.interactive || e.id.startsWith("dm:health"))
    .map((e: any, i: number) => `<i style="${pct(e.bbox)};--i:${i}"></i>`)
    .join("");
  const groundTags = tagged
    .filter(Boolean)
    .map((e: any) => {
      const { width: vw, height: vh } = elementMap.viewport;
      const right = e.bbox.x / vw > 0.45;
      const x = right
        ? `right:${(((vw - e.bbox.x - e.bbox.width) / vw) * 100).toFixed(1)}%`
        : `left:${((e.bbox.x / vw) * 100).toFixed(1)}%`;
      return `<span class="tag" style="${x};top:calc(${(((e.bbox.y + e.bbox.height) / vh) * 100).toFixed(1)}% + 6px)">${escapeHtml(e.id)}</span>`;
    })
    .join("");
  const directCode = `<pre class="term"><span class="c">// launch/composition/main.js: the New project flow, shot 3</span>
<span class="k">const</span> plan = browser(flow, <span class="s">"flows/create-project@desktop/board"</span>, bar(<span class="f">6</span>) - <span class="f">0.3</span>);
<span class="k">const</span> pointer = cursor(v, { style: <span class="s">"mac"</span> });
pointer.moveTo(plan, <span class="s">"link:new-project"</span>, { at: bar(<span class="f">6</span>) + <span class="f">0.4</span>, duration: <span class="f">0.85</span> });
pointer.click({ at: bar(<span class="f">6</span>) + <span class="f">1.35</span> });
plan.swap(<span class="s">"flows/create-project@desktop/dialog"</span>, { at: bar(<span class="f">6</span>) + <span class="f">1.5</span>, transition: <span class="s">"crossfade"</span> });
pointer.moveTo(plan, <span class="s">"textbox:project-name"</span>, { at: bar(<span class="f">6</span>) + <span class="f">2.2</span>, duration: <span class="f">0.6</span> });
typeText(plan, <span class="s">"textbox:project-name"</span>, <span class="s">"Q4 Launch"</span>, { at: typedAt, cps: <span class="f">14</span> });
pointer.moveTo(plan, <span class="s">"button:create-project"</span>, { at: bar(<span class="f">6</span>) + <span class="f">4.0</span>, duration: <span class="f">0.65</span> });
pointer.click({ at: bar(<span class="f">6</span>) + <span class="f">4.75</span> });
plan.highlight(<span class="s">"generic:project-checklist"</span>, { at: bar(<span class="f">9</span>) + <span class="f">1.7</span>, style: <span class="s">"ring"</span> });</pre>`;
  const how = `<section class="section" id="how">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">How it works</p>
      <h2 class="h2">Ground. Direct. Check. Render.</h2>
      <p class="lede">demovie gives your agent your real product to work from, a motion runtime to animate it, and a QA engine that checks the result. Your agent does the creative work; demovie keeps it true.</p>
    </div>
    <div class="how" data-how>
      <div class="how-steps">
        <div class="how-step is-active" data-step="0">
          <span class="num">01</span>
          <h3>Ground</h3>
          <p><code>init</code> reads your code and the running app: brand colors and fonts, your product's vocabulary, every route. <code>capture</code> screenshots real states with seeded demo data, a frozen clock and masked personal data, and maps every element.</p>
          <span class="how-cmd">npx demovie init · npx demovie capture</span>
        </div>
        <div class="how-step" data-step="1">
          <span class="num">02</span>
          <h3>Direct</h3>
          <p>Your agent follows the demovie skill: brief, capture plan, storyboard, style frames, animation. Product UI only enters through <code>screen()</code> with real captures; cursors, zooms and highlights target element ids.</p>
          <span class="how-cmd">“Make a 30-second launch video of the Projects board.”</span>
        </div>
        <div class="how-step" data-step="2">
          <span class="num">03</span>
          <h3>Check</h3>
          <p><code>demovie qa</code> samples the video and runs ${rules.length} rules: reading time, legibility, contrast, safe areas, pacing, truthful clicks, invented words and numbers, determinism, loudness and the “AI look” clichés, with a fix for every failure.</p>
          <span class="how-cmd">npx demovie qa launch --format all</span>
        </div>
        <div class="how-step" data-step="3">
          <span class="num">04</span>
          <h3>Render</h3>
          <p>A deterministic frame-stepping renderer (Playwright and your ffmpeg) writes H.264 MP4s in every format, posters and captions, with license-clean music and sound effects mixed to −16 LUFS.</p>
          <span class="how-cmd">npx demovie render launch</span>
        </div>
      </div>
      <div class="how-visual">
        <div class="how-panels">
          <div class="how-panel panel-ground is-active" data-panel="0">
            <div class="mini-head"><span class="mini-dots"><i></i><i></i><i></i></span>captures/routes/app-projects@desktop</div>
            <div class="panel-body"><div class="cap"><img src="${elementMap.image}" alt="A real capture of Harborly's Projects board" loading="lazy" width="2160" height="1350"><div class="boxes">${groundBoxes}${groundTags}</div></div></div>
          </div>
          <div class="how-panel" data-panel="1">
            <div class="mini-head"><span class="mini-dots"><i></i><i></i><i></i></span>.demovie/videos/launch/composition/main.js</div>
            <div class="panel-body">${directCode}</div>
          </div>
          <div class="how-panel" data-panel="2">
            <div class="mini-head"><span class="mini-dots"><i></i><i></i><i></i></span>~/harborly</div>
            <div class="panel-body"><pre class="term">${term(`$ npx demovie qa launch --format all\n${input.terminal.qa}`)}\n\n<span class="c"># qa.json, 16:9</span>\n${input.terminal.rules
              .map(
                (r) =>
                  `${r.status === "pass" ? '<span class="ok">✓</span>' : '<span class="c">–</span>'} <span class="k">${r.id}</span> ${escapeHtml(r.title)}${r.status === "pass" ? "" : ` <span class="c">(${escapeHtml(r.status)})</span>`}`,
              )
              .join("\n")}</pre></div>
          </div>
          <div class="how-panel panel-render" data-panel="3">
            <div class="mini-head"><span class="mini-dots"><i></i><i></i><i></i></span>.demovie/videos/launch/out/</div>
            <div class="panel-body">
              <div class="formats">
                <figure class="f169"><img src="${posterSrc(launch, "16:9", root)}" alt="16:9 poster" loading="lazy"><figcaption>16:9</figcaption></figure>
                <figure class="f916"><img src="${posterSrc(launch, "9:16", root)}" alt="9:16 poster" loading="lazy"><figcaption>9:16</figcaption></figure>
                <figure class="f11"><img src="${posterSrc(changelog, "1:1", root)}" alt="1:1 poster" loading="lazy"><figcaption>1:1</figcaption></figure>
              </div>
              <pre class="term">${term(input.terminal.render)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;

  // ── element map explorer ────────────────────────────────────────────────────────────────────────────────────────
  const explorer = `<section class="section" id="captures">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Captures</p>
      <h2 class="h2">Every element has an address.</h2>
      <p class="lede">A capture is more than a screenshot. demovie records every visible element's role, name and box under a stable id, so a cursor click lands exactly on the real button, and QA can check that it did. Hover the board, or pick an id.</p>
    </div>
    <div class="explorer reveal" data-explorer>
      <div class="browser">
        <div class="browser-bar"><span class="mini-dots"><i></i><i></i><i></i></span><span class="browser-url">harborly.example${escapeHtml(elementMap.path)}</span><span class="spacer"></span></div>
        <div class="browser-view show-map" data-view>
          <img src="${elementMap.image}" alt="Harborly's Projects board, captured with seeded demo data" width="2160" height="1350">
          <div class="el-layer" data-layer></div>
          <div class="el-tip" data-tip></div>
          <div class="fake-cursor" data-cursor>${icon.cursor}</div>
        </div>
      </div>
      <div class="explorer-side">
        <div class="side-card">
          <label class="toggle">Show the element map <input type="checkbox" checked data-map-toggle></label>
          <p class="fine" style="margin-top:8px"><span data-el-count>${elementMap.elements.length}</span> visible elements in <code>${escapeHtml(elementMap.captureId)}</code>, captured at 1440×900 and device scale 2.</p>
        </div>
        <div class="side-card">
          <h3>Find an element</h3>
          <input class="find-input" type="search" placeholder="e.g. new-project" aria-label="Filter element ids" data-find>
          <ul class="id-list" data-ids></ul>
        </div>
        <div class="side-card">
          <h3>In a composition</h3>
          <div class="code-line" data-code><span class="c">// pick an element</span></div>
        </div>
      </div>
    </div>
    ${json("element-map", elementMap)}
  </div>
</section>`;

  // ── flow replay ─────────────────────────────────────────────────────────────────────────────────────────────────
  const yamlLines = (flow.yaml as string)
    .replace(/\n$/, "")
    .split("\n")
    .map((line, i) => {
      const comment = line.trimStart().startsWith("#");
      const html = comment
        ? escapeHtml(line)
        : escapeHtml(line).replace(/^(\s*-?\s*)([a-zA-Z]+)(:)/, '$1<span class="key">$2</span>$3');
      return `<li data-line="${i}"${comment ? ' class="is-comment"' : ""}>${html || " "}</li>`;
    })
    .join("");
  const flowSection = `<section class="section" id="flows">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Flows</p>
      <h2 class="h2">States behind clicks, captured for real.</h2>
      <p class="lede">Dialogs, filled forms and results come from flows: a few steps of YAML that demovie replays against your running app, capturing each state on the way. The composition then animates between real screenshots instead of drawing them.</p>
    </div>
    <div class="flow reveal" data-flow>
      <div class="yaml"><div class="code-head"><span>.demovie/flows/create-project.flow.yaml</span></div><ol>${yamlLines}</ol></div>
      <div class="flow-view">
        <div class="browser">
          <div class="browser-bar"><span class="mini-dots"><i></i><i></i><i></i></span><span class="browser-url" data-flow-url>harborly.example/app/projects</span><span class="spacer"></span></div>
          <div class="browser-view" data-flow-view>
            ${flow.states.map((s: any, i: number) => `<img class="state${i === 0 ? " is-on" : ""}" src="${s.image}" alt="Flow state ${escapeHtml(s.id)}" loading="lazy" data-state="${escapeHtml(s.id)}" width="1600" height="1000">`).join("")}
            <div class="flow-target" data-flow-target><span></span></div>
            <div class="fake-cursor" data-flow-cursor>${icon.cursor}</div>
          </div>
        </div>
        <div class="flow-bar">
          <button class="player-btn" type="button" data-flow-play aria-label="Play the flow"><span class="when-off">${icon.play}</span><span class="when-on">${icon.pause}</span></button>
          <div class="flow-states" role="tablist" aria-label="Captured states">${flow.states.map((s: any, i: number) => `<button type="button" role="tab" data-goto="${i}"${i === 0 ? ' class="is-on" aria-selected="true"' : ' aria-selected="false"'}>${escapeHtml(s.id)}</button>`).join("")}</div>
        </div>
        <p class="flow-caption" data-flow-caption>Six states of the <code>create-project</code> flow from the Harborly example, re-seeded before every capture run.</p>
      </div>
    </div>
    ${json("flow-data", { states: flow.states, steps: flow.steps, viewport: flow.viewport })}
  </div>
</section>`;

  // ── QA ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const categories = [...new Set(rules.map((r) => r.category))];
  const ruleCards = rules
    .map(
      (r) => `<details class="rule" data-cat="${escapeHtml(r.category)}">
      <summary><span class="rid">${r.id}</span><span class="rtitle">${escapeHtml(r.title)}</span><span class="sev ${r.severity}">${r.severity}</span></summary>
      <div class="rbody"><p><b>Measures:</b> ${inline(r.measurement)}</p><p><b>Fix:</b> ${inline(r.fix)}</p></div>
    </details>`,
    )
    .join("");
  const qa = `<section class="section" id="qa">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">QA</p>
      <h2 class="h2">${rules.length} checks before anything renders.</h2>
      <p class="lede"><code>demovie qa</code> loads the composition exactly as the renderer does, samples it at 10 fps and reports what a careful reviewer would flag, with a fix for each finding. These are real reports on the deliberately broken examples in the repo.</p>
    </div>
    <div class="reveal" data-qa>
      <div class="qa-tabs" role="tablist" aria-label="Broken examples">${qaCases
        .map(
          (c, i) =>
            `<button class="tab" role="tab" type="button" aria-selected="${i === 0}" data-case="${i}">${escapeHtml(c.label)} <span class="count">${c.findings.length}</span></button>`,
        )
        .join("")}</div>
      <div class="qa-grid">
        <div>
          <div class="qa-still" data-qa-still><img alt="" data-qa-img width="1280" height="720"><div data-qa-boxes></div><span class="qa-stamp" data-qa-stamp></span></div>
          <p class="fine" style="margin-top:10px" data-qa-note></p>
        </div>
        <ol class="qa-findings" data-qa-findings></ol>
      </div>
    </div>
    <div class="rules reveal" data-rules>
      <div class="rules-head">
        <h3>All ${rules.length} rules</h3>
        <div class="filters" role="group" aria-label="Filter rules"><button type="button" aria-pressed="true" data-filter="all">All</button>${categories.map((c) => `<button type="button" aria-pressed="false" data-filter="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}</div>
      </div>
      <div class="rule-grid">${ruleCards}</div>
      <p class="fine" style="margin-top:16px">Rules listed in <code>video.json</code> <code>qa.ignore</code> are reported as waived; <code>--strict</code> turns warnings into errors. Full details in the <a href="docs/qa-rules/">QA rules reference</a>.</p>
    </div>
    ${json("qa-cases", qaCases)}
  </div>
</section>`;

  // ── gallery ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const card = (v: SiteVideo) => {
    const format = v.formats.includes("16:9") ? "16:9" : v.formats[0]!;
    return `<button class="vcard" type="button" data-video="${v.id}">
      <span class="vcard-media"><img src="${posterSrc(v, format, root)}" alt="" loading="lazy" width="1280" height="720"><video muted loop playsinline preload="none" data-src="${videoSrc(v, format, root)}"></video><span class="vcard-play">${icon.play} Play</span></span>
      <span class="vcard-meta"><b>${inline(v.name)}</b><span>${v.duration} s · ${v.formats.join(" · ")}</span></span>
      <p>${inline(v.blurb)}</p>
    </button>`;
  };
  const videoData = videos.map((v) => ({
    id: v.id,
    name: v.name.replace(/`/g, ""),
    title: v.title,
    type: v.type,
    style: v.style,
    duration: v.duration,
    formats: v.formats,
    blurb: v.blurb,
    made: v.made.replace(/`/g, ""),
    source: `${REPO_URL}/tree/main/${v.source}`,
    sources: Object.fromEntries(v.formats.map((f) => [f, videoSrc(v, f, root)])),
    posters: Object.fromEntries(v.formats.map((f) => [f, posterSrc(v, f, root)])),
  }));
  const gallery = `<section class="section" id="gallery">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Gallery</p>
      <h2 class="h2">Made with demovie.</h2>
      <p class="lede">Every video here was made from captures of Harborly, a fictional app in the repo, by following the same skill your agent uses. All of them pass QA.</p>
    </div>
    <div class="gallery-tabs reveal">
      <div class="seg" role="tablist" aria-label="Gallery"><button type="button" role="tab" aria-pressed="true" data-gtab="harborly">Harborly videos</button><button type="button" role="tab" aria-pressed="false" data-gtab="styles">Style presets</button></div>
      <a class="text-link" href="gallery/">Open the full gallery ${icon.arrow}</a>
    </div>
    <div class="card-grid reveal" data-gpanel="harborly">${videos
      .filter((v) => v.group === "harborly")
      .map(card)
      .join("")}</div>
    <div class="card-grid five" data-gpanel="styles" hidden>${videos
      .filter((v) => v.group === "styles")
      .map(card)
      .join("")}</div>
  </div>
</section>`;

  // ── formats ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const formats = `<section class="section" id="formats">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Formats</p>
      <h2 class="h2">Every format, laid out on its own.</h2>
      <p class="lede">One composition, separate layouts. The vertical launch video keeps the board legible by framing cards instead of cropping the landscape one; the changelog clip gets its own square cut.</p>
    </div>
    <div class="formats-band reveal" data-autoplay-group>
      <figure class="f169"><video muted loop playsinline preload="none" poster="${posterSrc(launch, "16:9", root)}" data-src="${videoSrc(launch, "16:9", root)}" aria-label="Harborly launch video, 16:9"></video><figcaption><span>launch-16x9.mp4</span><span>1920×1080</span></figcaption></figure>
      <figure class="f916"><video muted loop playsinline preload="none" poster="${posterSrc(launch, "9:16", root)}" data-src="${videoSrc(launch, "9:16", root)}" aria-label="Harborly launch video, 9:16"></video><figcaption><span>9:16</span><span>1080×1920</span></figcaption></figure>
      <figure class="f11"><video muted loop playsinline preload="none" poster="${posterSrc(changelog, "1:1", root)}" data-src="${videoSrc(changelog, "1:1", root)}" aria-label="Harborly changelog clip, 1:1"></video><figcaption><span>1:1</span><span>1080×1080</span></figcaption></figure>
    </div>
  </div>
</section>`;

  // ── quickstart ──────────────────────────────────────────────────────────────────────────────────────────────────
  // an excerpt of `demovie status` on Harborly: the project, its captures, grounding level and videos
  const statusLines = input.terminal.status
    .split("\n")
    .filter((l) => /^(demovie |captures:|grounding:|videos:)/.test(l));
  const quickLines = [
    "$ npx demovie init       # detect your app; brand, glossary, routes, login, skill",
    "$ npx demovie capture    # screenshots + element maps of every route and flow",
    "$ npx demovie status",
    ...statusLines,
    "$ npx demovie make --type teaser --format 16:9 --yes",
    "[ 2m 15s] → Bash npx demovie stills projects-board-teaser --every 1 --format all --sheet",
    "[ 2m 35s] → Bash npx demovie qa projects-board-teaser --format all",
    "[ 3m 11s] Rendered. Writing the share copy.",
    "Claude Code finished · 3m 21s · 43 turns · $1.06 (as reported by Claude Code)",
    "videos: .demovie/videos/projects-board-teaser/out/projects-board-teaser-16x9.mp4",
  ];
  const quick = `<section class="section" id="start">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Quickstart</p>
      <h2 class="h2">Three commands. Then just ask.</h2>
      <p class="lede">In your app's folder: set up once, capture, then ask your agent for a video in plain words, or let <code>make</code> start it for you. The status and log below are real: Harborly at grounding level L3, and the headless run that made its teaser.</p>
    </div>
    <div class="quick reveal">
      <div class="terminal">
        <div class="mini-head"><span class="mini-dots"><i></i><i></i><i></i></span>~/your-app${copyButton("Copy the three commands").replace("data-copy", 'data-copy="npx demovie init\nnpx demovie capture\nnpx demovie make"')}</div>
        <div class="terminal-body typed" data-typed><pre class="term">${quickLines
          .map((l) => `<span class="tl">${term(l)}</span>`)
          .join("\n")}<span class="caret" aria-hidden="true"></span></pre></div>
      </div>
      <div class="ask">
        <div class="bubble"><small>Or, in Claude Code, Codex or Cursor:</small>“Make a 30-second launch video of the Projects board with demovie.”</div>
        <div class="result-card">
          <video muted loop playsinline preload="none" poster="${posterSrc(teaser, "16:9", root)}" data-src="${videoSrc(teaser, "16:9", root)}" data-autoplay aria-label="The Harborly teaser made by that run"></video>
          <div class="rc-meta"><span><b>12 s</b> teaser, 16:9</span><span><b>43</b> turns</span><span><b>$1.06</b> reported by Claude Code</span><span><b>QA</b> 0 errors · 0 warnings</span></div>
        </div>
      </div>
    </div>
    <div class="req reveal"><span class="chip"><span class="dot"></span>Node ≥ 20.19, or Bun</span><span class="chip"><span class="dot"></span>ffmpeg with libx264</span><span class="chip"><span class="dot"></span>An app you can run locally</span><span class="chip"><span class="dot"></span>Next.js detected automatically; anything else with <code>init --url</code></span></div>
  </div>
</section>`;

  // ── agents ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const tabs: { id: string; name: string; sub: string; body: string }[] = [
    {
      id: "claude",
      name: "Claude Code",
      sub: "Plugin, skill and MCP",
      body: `<h3>Claude Code</h3><p>Install the plugin: it bundles the skill and registers the MCP server. Or let <code>init</code> copy the skill into <code>.claude/skills/demovie</code>.</p>
      ${codeBlock("/plugin marketplace add enszrlu/demovie\n/plugin install demovie@demovie", "text", "in Claude Code")}
      ${codeBlock('npx demovie make --type launch --about "the Projects board"   # interactive\nnpx demovie make --type changelog --yes                        # headless', "bash")}`,
    },
    {
      id: "codex",
      name: "Codex CLI",
      sub: "Skill and MCP",
      body: `<h3>Codex CLI</h3><p><code>init</code> installs the skill in <code>.agents/skills/demovie</code>. demovie prints the MCP command but never edits your global config.</p>
      ${codeBlock("codex mcp add demovie -- npx -y demovie mcp", "bash")}
      ${codeBlock("npx demovie make --agent codex --format 16:9,9:16", "bash")}`,
    },
    {
      id: "cursor",
      name: "Cursor",
      sub: "Skill and .cursor/mcp.json",
      body: `<h3>Cursor</h3><p><code>init</code> installs the skill in <code>.agents/skills/demovie</code> (Cursor also reads <code>.claude/skills</code>) and merges the MCP server into <code>.cursor/mcp.json</code>.</p>
      ${codeBlock("npx demovie make --agent cursor --type teaser", "bash")}`,
    },
    {
      id: "any",
      name: "Any agent",
      sub: "skills.sh, MCP, custom command",
      body: `<h3>Any MCP client or skills-aware agent</h3><p>The skill is plain Agent Skills; the MCP server speaks stdio. Or point <code>make</code> at any CLI.</p>
      ${codeBlock('npx skills add enszrlu/demovie\nnpx -y demovie mcp\nnpx demovie make --agent custom --agent-cmd "mytool run {prompt}"', "bash")}`,
    },
  ];
  const agents = `<section class="section" id="agents">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Agents</p>
      <h2 class="h2">Works with the agent you already use.</h2>
      <p class="lede">demovie is skill-first: your agent reads the demovie skill and drives the CLI, or calls the MCP server. demovie never logs in to AI services or touches your subscription; it starts the agent you installed and signed in to, or passes through API keys in CI.</p>
    </div>
    <div class="install reveal" data-tabs>
      <div class="install-list" role="tablist" aria-label="Agents">${tabs
        .map(
          (t, i) =>
            `<button type="button" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${i === 0}" data-tab="${t.id}"><b>${t.name}</b><span>${t.sub}</span></button>`,
        )
        .join("")}</div>
      ${tabs.map((t, i) => `<div class="install-panel" role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" data-tabpanel="${t.id}"${i === 0 ? "" : " hidden"}>${t.body}</div>`).join("")}
    </div>
  </div>
</section>`;

  // ── changelog mode ──────────────────────────────────────────────────────────────────────────────────────────────
  const ci = `<section class="section" id="changelog">
  <div class="wrap">
    <div class="ci">
      <div class="reveal">
        <p class="kicker">Changelog mode</p>
        <h2 class="h2">A fresh clip for every release.</h2>
        <p class="lede"><code>demovie changes</code> maps commits to the routes they affect through the import graph. The GitHub Action turns that into a clip on every release.</p>
        <ol class="ci-steps">
          <li>Recaptures only what changed: <code>capture --changed --since &lt;previous tag&gt;</code></li>
          <li>Runs your agent headless with the changelog preset: <code>make --type changelog --yes</code></li>
          <li>Comments on the pull request with the poster, links and the QA summary</li>
          <li>Attaches the MP4s and posters to the release</li>
        </ol>
      </div>
      <div class="ci-visual reveal" style="--delay:.1s">
        <video muted loop playsinline preload="none" poster="${posterSrc(changelog, "1:1", root)}" data-src="${videoSrc(changelog, "1:1", root)}" data-autoplay aria-label="The Harborly changelog clip, 1:1"></video>
      </div>
    </div>
    <div class="reveal" style="margin-top:56px">${codeBlock(
      `- uses: actions/checkout@v7
  with:
    fetch-depth: 0                       # tags and history for \`demovie changes\`
- uses: enszrlu/demovie/packages/action@v0
  with:
    agent: claude                        # or codex
    type: changelog
    app-url: \${{ github.event.deployment_status.environment_url }}   # or \`start: pnpm build && pnpm start\`
  env:
    ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}              # an API key, not a subscription`,
      "yaml",
      ".github/workflows/demovie.yml (written by npx demovie ci init)",
    )}</div>
  </div>
</section>`;

  // ── features ────────────────────────────────────────────────────────────────────────────────────────────────────
  const feat = (ico: string, title: string, text: string) =>
    `<div class="feature reveal"><div class="ico">${ico}</div><h3>${title}</h3><p>${text}</p></div>`;
  const svg = (d: string) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const features = `<section class="section" id="features">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Features</p>
      <h2 class="h2">What a product video needs. <em>None of what it shouldn't have.</em></h2>
    </div>
    <div class="features">
      ${feat(svg('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M8 21h8"/>'), "Real captures, not imagination", "Logged-in states via form login, saved sessions or scripts; multi-step flows in YAML or TypeScript; stable element maps; freshness tracking.")}
      ${feat(svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'), "Your brand and your words", "Colors, fonts and logos extracted from your code, and a glossary of your product's vocabulary that QA enforces.")}
      ${feat(svg('<path d="M4 17c3-6 5-9 8-9s5 3 8 9"/><circle cx="12" cy="8" r="1.5"/>'), "A motion runtime", "Device frames, camera moves, a truthful cursor, typing, callouts, captions and transitions, in five style presets.")}
      ${feat(svg('<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>'), "QA you can trust", `${rules.length} machine-checked rules, a preview player with QA overlays, and contact sheets for review.`)}
      ${feat(svg('<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'), "License-clean audio", "A deterministic music synthesizer that follows your storyboard, 12 CC0 sound effects, optional voiceover with your own key, ducking and loudness normalization.")}
      ${feat(svg('<path d="M6 3v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'), "Changelog mode", "<code>demovie changes</code> maps commits to affected routes through the import graph; a GitHub Action makes a clip for every release.")}
    </div>
  </div>
</section>`;

  // ── compare ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const atAGlance = comparison.get("At a glance") ?? "";
  const compare = `<section class="section" id="compare">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Compare</p>
      <h2 class="h2">Honest about the alternatives.</h2>
      <p class="lede">There are several good ways to make a product video with an agent now. Here is the same app made with one command each: <code>/brag</code> with its defaults, and <code>npx demovie make --type teaser --format 16:9 --yes</code>.</p>
    </div>
    <div class="compare-video reveal"><video controls muted loop playsinline preload="none" poster="media/posters/harborly-brag-vs-demovie.webp" data-src="docs/media/comparison/harborly-brag-vs-demovie.mp4" data-autoplay aria-label="Left: brag's video of Harborly. Right: demovie's teaser of Harborly."></video></div>
    <div class="compare-stats reveal">
      <div class="stat-card">
        <h3>brag <code>/brag</code></h3>
        <div class="stat-row"><div><b>39 min</b><span>agent time</span></div><div><b>108</b><span>turns</span></div><div><b>$12.26</b><span>reported cost</span></div></div>
        <p>Started from the repository, nothing set up. 21.5 s, 16:9, music and sound effects. Harborly's real components and demo data, rendered in a harness it built for the run.</p>
      </div>
      <div class="stat-card is-us">
        <h3>demovie <code>make --yes</code></h3>
        <div class="stat-row"><div><b>3m 21s</b><span>agent time</span></div><div><b>43</b><span>turns</span></div><div><b>$1.06</b><span>reported cost</span></div></div>
        <p>Started with <code>init</code> and <code>capture</code> already done (a few minutes, once per project). 12 s, 16:9, music. Screenshots of the running app with its demo data. QA: 0 errors, 0 warnings.</p>
      </div>
    </div>
    <p class="fine reveal" style="margin-top:14px">[1] Both runs used Claude Opus 5.5, brag at maximum effort and demovie at the default effort, so read the cost difference as a direction, not a precise ratio. brag's story is the stronger one here; demovie's run was the cheap part of a project that was already set up. <a href="docs/comparison/">Read the full comparison</a>, including four approaches measured on a private production app.</p>
    <div class="picker">
      <div class="pick reveal"><small>A quick, fun launch post of a React app you just built</small><b>brag is one command and tells a good story.</b><span><a href="https://github.com/latent-spaces/brag" rel="noopener">brag</a></span></div>
      <div class="pick reveal" style="--delay:.05s"><small>Building videos as code yourself, or hundreds of data-driven videos</small><b>Use a video framework with agent skills.</b><span><a href="https://www.remotion.dev" rel="noopener">Remotion</a> · <a href="https://github.com/heygen-com/hyperframes" rel="noopener">HyperFrames</a></span></div>
      <div class="pick reveal" style="--delay:.1s"><small>A showreel or motion art that isn't about your UI</small><b>A strong model with a good prompt and a render harness is enough.</b><span>No captures needed</span></div>
      <div class="pick is-us reveal" style="--delay:.15s"><small>A video that has to show your real, current product</small><b>Logged-in screens, your demo data, several formats, checked before it renders, again on every release.</b><span>demovie</span></div>
    </div>
    <details class="compare-more reveal"><summary>The full comparison table ${icon.chevron}</summary>${md(atAGlance, docsCtx("docs/comparison.md"))}</details>
  </div>
</section>`;

  // ── trust ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const trust = `<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="kicker">Trust</p>
      <h2 class="h2">Your agent, your keys, your data.</h2>
    </div>
    <div class="trust">
      <div class="reveal">${icon.check}<b>Never logs in for you</b><p>demovie never logs in to AI services or reads tokens. It starts the agent you installed and signed in to.</p></div>
      <div class="reveal" style="--delay:.05s">${icon.check}<b>No telemetry</b><p>Captures, videos and caches stay in <code>.demovie/</code>. The only outside calls are the ones you configure.</p></div>
      <div class="reveal" style="--delay:.1s">${icon.check}<b>MIT, for any company</b><p>No per-company video license. Compositions are plain HTML and GSAP on demovie's own renderer.</p></div>
      <div class="reveal" style="--delay:.15s">${icon.check}<b>License-clean audio</b><p>Music is synthesized, effects are CC0, voiceover uses your own key. Every audio file has a provenance entry.</p></div>
    </div>
  </div>
</section>`;

  // ── FAQ ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  const faqItems = [...faq.entries()]
    .map(
      ([q, a], i) =>
        `<details class="faq-item"${i === 0 ? " open" : ""}><summary>${escapeHtml(q)}<span class="pm" aria-hidden="true"></span></summary><div class="faq-body">${md(a.replace("See the side-by-side in the README.", "See the side-by-side at the top of this page."), docsCtx("docs/faq.md"))}</div></details>`,
    )
    .join("");
  const faqSection = `<section class="section" id="faq">
  <div class="wrap faq-grid">
    <div class="section-head reveal">
      <p class="kicker">FAQ</p>
      <h2 class="h2">Questions, answered.</h2>
      <p class="lede">Something else? <a href="docs/troubleshooting/">Troubleshooting</a> covers the common errors, and <a href="${REPO_URL}/issues" rel="noopener">issues</a> are open.</p>
    </div>
    <div class="faq-list reveal">${faqItems}</div>
  </div>
</section>`;

  // ── final CTA ───────────────────────────────────────────────────────────────────────────────────────────────────
  const final = `<div class="wrap">
  <section class="final reveal">
    <h2>Make your first video.</h2>
    <p>A few minutes of your time, then your agent works on it. The MP4s land in <code>.demovie/videos/&lt;slug&gt;/out/</code>.</p>
    <div class="hero-ctas">
      <div class="cmd"><span class="prompt">$</span><span>npx demovie init</span>${copyButton("Copy command")}</div>
      <a class="btn btn-primary" href="docs/tutorial/">Your first video, step by step ${icon.arrow}</a>
    </div>
  </section>
</div>`;

  const body = [
    hero,
    proof,
    how,
    explorer,
    flowSection,
    qa,
    gallery,
    formats,
    quick,
    agents,
    ci,
    features,
    compare,
    trust,
    faqSection,
    final,
    json("videos", videoData),
    lightbox(),
  ].join("\n");

  return page({
    file: "index.html",
    title: "demovie",
    description: DESCRIPTION,
    section: "home",
    styles: ["site.css", "home.css"],
    scripts: ["site.js", "home.js"],
    body,
  });
}

export function lightbox(): string {
  return `<dialog class="lightbox" data-lightbox aria-label="Video">
  <button class="icon-btn lb-close" type="button" data-lb-close aria-label="Close">${icon.close}</button>
  <div class="lb-stage"><video controls playsinline data-lb-video></video></div>
  <div class="lb-side">
    <h2 data-lb-title></h2>
    <p data-lb-blurb></p>
    <div class="seg" role="group" aria-label="Format" data-lb-formats></div>
    <dl class="facts" data-lb-facts></dl>
    <p class="fine" data-lb-made></p>
    <div class="lb-links"><a data-lb-source rel="noopener">Brief, storyboard and composition on GitHub</a></div>
  </div>
</dialog>`;
}
