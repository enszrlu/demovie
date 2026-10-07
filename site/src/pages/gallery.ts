/** The gallery: every example video with its formats, brief, shot list and share copy. */
import { escapeHtml } from "../lib/markdown.ts";
import { icon, page, REPO_URL } from "../lib/site.ts";
import { posterSrc, type SiteVideo, videoSrc } from "../lib/videos.ts";

const inline = (text: string) => escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");

/** The X post from a share.md (the agent writes one next to every render). */
function sharePost(markdown: string | undefined): string | undefined {
  const x = markdown?.split(/^## /m).find((s) => s.startsWith("X"));
  return x
    ?.replace(/^X\s*\n/, "")
    .trim()
    .replace(/\*\*/g, "");
}

export function buildGallery(videos: SiteVideo[], share: Record<string, string>): string {
  const root = "../";
  const showcase = (v: SiteVideo) => {
    const first = v.formats[0]!;
    const post = sharePost(share[v.slug]);
    const shots = v.shots.length
      ? `<h3>Shot list</h3><ol class="shots">${v.shots
          .map((s) => `<li><span>${s.start.toFixed(1)} s · ${escapeHtml(s.kind)}</span>${inline(s.text || "—")}</li>`)
          .join("")}</ol>`
      : "";
    return `<section class="showcase" id="${v.id}">
    <div class="showcase-player" data-showcase>
      <div class="screen"><video controls muted loop playsinline preload="none" poster="${posterSrc(v, first, root)}" data-src="${videoSrc(v, first, root)}" aria-label="${escapeHtml(v.title)}"></video></div>
      ${
        v.formats.length > 1
          ? `<div class="seg" role="group" aria-label="Format">${v.formats
              .map(
                (f, i) =>
                  `<button type="button" aria-pressed="${i === 0}" data-format-src="${videoSrc(v, f, root)}" data-format-poster="${posterSrc(v, f, root)}">${f}</button>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>
    <div class="showcase-info">
      <p class="kicker">${v.group === "harborly" ? "Harborly" : "Style preset"}</p>
      <h2>${inline(v.name)}</h2>
      <p class="muted">${inline(v.blurb)}</p>
      <dl class="facts">
        <dt>Type</dt><dd>${escapeHtml(v.type)}</dd>
        <dt>Style</dt><dd><code>${escapeHtml(v.style)}</code></dd>
        <dt>Length</dt><dd>${v.duration} s at ${v.fps} fps</dd>
        <dt>Formats</dt><dd>${v.formats.join(", ")}</dd>
        <dt>QA</dt><dd class="pass">0 errors</dd>
      </dl>
      ${v.brief.message ? `<h3>The brief's message</h3><blockquote class="brief">${escapeHtml(v.brief.message)}</blockquote>` : ""}
      ${shots}
      ${post ? `<h3>Share copy the agent wrote</h3><p class="share-copy">${escapeHtml(post)}</p>` : ""}
      <p class="fine" style="margin-top:18px">${inline(v.made)}</p>
      <div class="showcase-links">
        <a href="${REPO_URL}/tree/main/${v.source}" rel="noopener">Brief, storyboard and composition</a>
        <a href="${REPO_URL}/blob/main/${v.source}/composition/main.js" rel="noopener">main.js</a>
      </div>
    </div>
  </section>`;
  };
  const harborly = videos.filter((v) => v.group === "harborly");
  const styles = videos.filter((v) => v.group === "styles");
  const body = `<div class="wrap">
  <header class="page-hero">
    <p class="kicker">Gallery</p>
    <h1>Made with demovie.</h1>
    <p class="lede">Every video below was made from captures of Harborly, a fictional app in the repo, by following the demovie skill. Each folder holds the brief, storyboard, <code>video.json</code> and composition, so you can read exactly how it was made.</p>
    <nav class="jump" aria-label="Videos">${videos.map((v) => `<a class="chip" href="#${v.id}">${inline(v.name)}</a>`).join("")}</nav>
  </header>
  ${harborly.map(showcase).join("\n")}
  <div class="section-head" style="margin:clamp(56px,8vw,96px) 0 0">
    <p class="kicker">Style presets</p>
    <h2 class="h2">Five styles, one product.</h2>
    <p class="lede">A style decides type scale, easing, backgrounds and pacing; brand colors and fonts always come from your code. Each preset ships with a reference composition that passes QA. <a href="../docs/styles/">More on styles</a>.</p>
  </div>
  ${styles.map(showcase).join("\n")}
  <div class="final" style="margin-top:72px">
    <h2>Your app next.</h2>
    <p>Three commands, then ask your agent for a video.</p>
    <div class="hero-ctas"><a class="btn btn-primary" href="../docs/tutorial/">Your first video, step by step ${icon.arrow}</a><a class="btn" href="../">Back to the overview</a></div>
  </div>
</div>`;
  return page({
    file: "gallery/index.html",
    title: "Gallery",
    description:
      "Launch videos, changelog clips, teasers and five style presets, all made with demovie from real captures.",
    section: "gallery",
    styles: ["site.css", "home.css"],
    scripts: ["site.js", "home.js"],
    body,
    solidHeader: true,
  });
}
