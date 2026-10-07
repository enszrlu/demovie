/** Site-wide constants and the shared page shell (head, header, footer, search dialog). */
import path from "node:path";

export const REPO_URL = "https://github.com/enszrlu/demovie";
export const COFFEE_URL = "https://buymeacoffee.com/enszrlu";
/** Where the site is published; override with SITE_URL for a fork or a custom domain. */
export const SITE_URL = (process.env.SITE_URL ?? "https://enszrlu.github.io/demovie/").replace(/\/?$/, "/");
export const TAGLINE = "Your agent animates. demovie makes it true.";
export const DESCRIPTION =
  "Accurate, on-brand motion-graphics videos of your real web app, made by the AI coding agent you already use, from real captures of your running app, checked by a QA engine before they render. Open source, MIT.";

/** Inline SVG icons (24×24, stroke = currentColor). */
export const icon = {
  coffee:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V10Z"/><path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sun: '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  muted:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  drag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 7-5 5 5 5M15 7l5 5-5 5"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  cursor:
    '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M5 2.5v19.2l5-4.6 3.4 7.4 3.4-1.5-3.3-7.3h6.6L5 2.5Z" fill="#fff" stroke="#16140f" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

export interface PageOptions {
  /** Output path relative to the site root, e.g. "index.html" or "docs/tutorial/index.html". */
  file: string;
  title: string;
  description?: string;
  /** Which top-level nav item is current. */
  section?: "home" | "gallery" | "docs";
  styles: string[];
  scripts: string[];
  body: string;
  /** Solid header from the start (pages without a hero). */
  solidHeader?: boolean;
  bodyClass?: string;
  /** Root prefix for links and assets; defaults to the page's relative path to the site root. */
  root?: string;
}

/** Relative path from a page to the site root ("" for the root, "../" one level down, …). */
export function rootOf(file: string): string {
  const depth = path.posix
    .dirname(file)
    .split("/")
    .filter((p) => p && p !== ".").length;
  return "../".repeat(depth);
}

function header(root: string, section: PageOptions["section"], solid: boolean): string {
  const nav: [string, string, PageOptions["section"] | undefined][] = [
    ["How it works", `${root}#how`, undefined],
    ["Gallery", `${root}gallery/`, "gallery"],
    ["Compare", `${root}#compare`, undefined],
    ["Docs", `${root}docs/`, "docs"],
    ["FAQ", `${root}#faq`, undefined],
  ];
  const links = nav
    .map(([label, href, s]) => `<a href="${href}"${s && s === section ? ' aria-current="page"' : ""}>${label}</a>`)
    .join("");
  return `<header class="site-header${solid ? " is-solid" : ""}" data-header>
  <div class="wrap">
    <a class="brand" href="${root || "./"}" aria-label="demovie home"><img src="${root}assets/img/logo.svg" alt="" width="28" height="28">demovie</a>
    <nav class="nav" aria-label="Main">${links}</nav>
    <div class="header-actions">
      <button class="search-btn" type="button" data-search-open aria-label="Search the docs">${icon.search}<span class="label">Search docs</span><kbd>⌘K</kbd></button>
      <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Toggle dark mode">${icon.sun}${icon.moon}</button>
      <a class="icon-btn coffee-btn" href="${COFFEE_URL}" rel="noopener" aria-label="Buy me a coffee" title="Buy me a coffee">${icon.coffee}</a>
      <a class="gh-btn" href="${REPO_URL}" rel="noopener">${icon.github}<span class="label">GitHub</span></a>
      <button class="icon-btn menu-btn" type="button" data-menu aria-label="Menu" aria-expanded="false" aria-controls="mobile-nav">${icon.menu}</button>
    </div>
  </div>
</header>
<nav class="mobile-nav" id="mobile-nav" aria-label="Mobile">${links}<a href="${REPO_URL}" rel="noopener">GitHub</a><a href="${COFFEE_URL}" rel="noopener">Buy me a coffee</a></nav>`;
}

function footer(root: string): string {
  const col = (title: string, items: [string, string][]) =>
    `<div><h2>${title}</h2><ul>${items.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join("")}</ul></div>`;
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="${root || "./"}"><img src="${root}assets/img/logo.svg" alt="" width="28" height="28">demovie</a>
        <p class="footer-tag">${TAGLINE} Open source under the MIT license.</p>
        <a class="coffee-link" href="${COFFEE_URL}" rel="noopener">${icon.coffee}Buy me a coffee</a>
      </div>
      ${col("Product", [
        ["How it works", `${root}#how`],
        ["Gallery", `${root}gallery/`],
        ["How it compares", `${root}docs/comparison/`],
        ["FAQ", `${root}docs/faq/`],
      ])}
      ${col("Docs", [
        ["Getting started", `${root}docs/getting-started/`],
        ["Your first video", `${root}docs/tutorial/`],
        ["Commands", `${root}docs/cli/`],
        ["QA rules", `${root}docs/qa-rules/`],
      ])}
      ${col("Project", [
        ["GitHub", REPO_URL],
        ["Changelog", `${REPO_URL}/blob/main/packages/cli/CHANGELOG.md`],
        ["Contributing", `${REPO_URL}/blob/main/CONTRIBUTING.md`],
        ["Security", `${REPO_URL}/blob/main/SECURITY.md`],
        ["Buy me a coffee", COFFEE_URL],
      ])}
    </div>
    <div class="footer-note">
      <span>MIT licensed. Bundled fonts are OFL; bundled sound effects are CC0.</span>
      <span>Harborly is a fictional app made for demovie's examples, with seeded demo data.</span>
    </div>
  </div>
</footer>`;
}

const SEARCH_DIALOG = `<dialog class="search-dialog" data-search aria-label="Search the docs">
  <div class="search-field">${icon.search}<input type="search" placeholder="Search the docs…" aria-label="Search" autocomplete="off" spellcheck="false" data-search-input></div>
  <ul class="search-results" role="listbox" data-search-results></ul>
  <div class="search-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
</dialog>`;

/** Runs before first paint so the saved theme never flashes. */
const THEME_BOOT = `<script>(function(){document.documentElement.classList.add("js");try{var t=localStorage.getItem("demovie-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();</script>`;

export function page(o: PageOptions): string {
  const root = o.root ?? rootOf(o.file);
  const description = o.description ?? DESCRIPTION;
  const canonical = SITE_URL + o.file.replace(/index\.html$/, "");
  const fullTitle = o.title === "demovie" ? `demovie: ${TAGLINE}` : `${o.title} · demovie`;
  return `<!doctype html>
<html lang="en" data-root="${root}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0b0b0d" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f6f4ef" media="(prefers-color-scheme: light)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="demovie">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE_URL}media/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}media/apple-touch-icon.png">
<link rel="preload" href="${root}assets/fonts/geist-variable.woff2" as="font" type="font/woff2" crossorigin>
${o.styles.map((s) => `<link rel="stylesheet" href="${root}assets/css/${s}">`).join("\n")}
${THEME_BOOT}
</head>
<body${o.bodyClass ? ` class="${o.bodyClass}"` : ""}>
<a class="skip-link" href="#main">Skip to content</a>
${header(root, o.section, o.solidHeader ?? false)}
<main id="main">
${o.body}
</main>
${footer(root)}
${SEARCH_DIALOG}
${o.scripts.map((s) => `<script src="${root}assets/js/${s}" defer></script>`).join("\n")}
</body>
</html>
`;
}
