/** The docs: every Markdown file under docs/, rendered with a sidebar built from docs/README.md. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { escapeHtml, type LinkContext, renderMarkdown, type Section } from "../lib/markdown.ts";
import { icon, page, REPO_URL } from "../lib/site.ts";

export interface DocLink {
  label: string;
  description: string;
  /** Repo path of the Markdown file, e.g. docs/tutorial.md. */
  source: string;
}

export interface DocGroup {
  title: string;
  links: DocLink[];
}

export interface SearchEntry {
  page: string;
  heading: string;
  url: string;
  text: string;
}

/** docs/tutorial.md → docs/tutorial/, docs/README.md → docs/. */
export function docPath(source: string): string {
  const rel = source.replace(/^docs\//, "").replace(/\.md$/, "");
  return rel === "README" ? "docs/" : `docs/${rel}/`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Read the groups and links of docs/README.md: each `## ` heading is a group, each link a page, in order. */
export function readDocGroups(repoRoot: string): { intro: string; groups: DocGroup[] } {
  const index = readFileSync(path.join(repoRoot, "docs/README.md"), "utf8");
  const [head = "", ...rest] = index.split(/^## /m);
  const intro = head.replace(/^# .*\n/, "").trim();
  const groups: DocGroup[] = [];
  const seen = new Set<string>();
  for (const block of rest) {
    const title = block.slice(0, block.indexOf("\n")).trim();
    const links: DocLink[] = [];
    for (const item of block.split(/\n- /).slice(1)) {
      const text = item.replace(/\s+/g, " ").trim();
      const matches = [...text.matchAll(/\[([^\]]+)\]\(([^)#]+\.md)\)/g)];
      for (const [i, m] of matches.entries()) {
        const source = path.posix.normalize(`docs/${m[2]}`);
        if (seen.has(source)) continue;
        seen.add(source);
        // "[Page](page.md): what it covers." — the description follows a single link
        const description =
          matches.length === 1 && i === 0
            ? (text.split(/\):\s*/)[1] ?? "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            : "";
        links.push({ label: capitalize(m[1]!), description: description.replace(/\.$/, ""), source });
      }
    }
    groups.push({ title, links });
  }
  return { intro, groups };
}

export interface DocsBuild {
  pages: { file: string; html: string }[];
  search: SearchEntry[];
}

export function buildDocs(
  repoRoot: string,
  publish: LinkContext["publish"],
  posterFor: LinkContext["posterFor"],
): DocsBuild {
  const { intro, groups } = readDocGroups(repoRoot);
  const order = groups.flatMap((g) => g.links);
  const pages: DocsBuild["pages"] = [];
  const search: SearchEntry[] = [];

  const sidebar = (current: string, root: string) =>
    `<nav class="docs-nav" aria-label="Docs">
      <a class="docs-nav-home${current === "docs/README.md" ? " is-current" : ""}" href="${root}docs/">Overview</a>
      ${groups
        .map(
          (g) =>
            `<div class="docs-nav-group"><h2>${escapeHtml(g.title)}</h2><ul>${g.links
              .map(
                (l) =>
                  `<li><a href="${root}${docPath(l.source)}"${l.source === current ? ' aria-current="page"' : ""}>${escapeHtml(l.label)}</a></li>`,
              )
              .join("")}</ul></div>`,
        )
        .join("")}
    </nav>`;

  const addSearch = (title: string, url: string, sections: Section[]) => {
    for (const s of sections)
      search.push({ page: title, heading: s.heading, url: s.id ? `${url}#${s.id}` : url, text: s.text });
  };

  for (const [i, link] of order.entries()) {
    const out = docPath(link.source);
    const file = `${out}index.html`;
    const root = "../".repeat(out.split("/").filter(Boolean).length);
    const md = readFileSync(path.join(repoRoot, link.source), "utf8");
    const rendered = renderMarkdown(md, { source: link.source, pageDir: out, publish, posterFor });
    const toc = rendered.headings.filter((h) => h.depth === 2 || h.depth === 3);
    const prev = order[i - 1];
    const next = order[i + 1];
    const group = groups.find((g) => g.links.includes(link));
    const pager = `<nav class="pager" aria-label="Previous and next">
      ${prev ? `<a class="prev" href="${root}${docPath(prev.source)}"><small>Previous</small><b>${escapeHtml(prev.label)}</b></a>` : "<span></span>"}
      ${next ? `<a class="next" href="${root}${docPath(next.source)}"><small>Next</small><b>${escapeHtml(next.label)}</b></a>` : "<span></span>"}
    </nav>`;
    const body = `<div class="docs-shell wrap">
  <aside class="docs-side" data-docs-side>
    <button class="docs-side-toggle" type="button" data-docs-toggle aria-expanded="false">${escapeHtml(group?.title ?? "Docs")} <b>/ ${escapeHtml(link.label)}</b>${icon.chevron}</button>
    ${sidebar(link.source, root)}
  </aside>
  <article class="docs-article">
    <div class="docs-crumbs"><a href="${root}docs/">Docs</a><span>/</span>${escapeHtml(group?.title ?? "")}</div>
    <div class="prose">${rendered.html}</div>
    <div class="docs-edit"><a href="${REPO_URL}/blob/main/${link.source}" rel="noopener">${icon.github} Edit this page on GitHub</a></div>
    ${pager}
  </article>
  <aside class="docs-toc" aria-label="On this page">
    ${toc.length > 1 ? `<h2>On this page</h2><ul>${toc.map((h) => `<li class="d${h.depth}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join("")}</ul>` : ""}
  </aside>
</div>`;
    pages.push({
      file,
      html: page({
        file,
        title: rendered.title || link.label,
        description: link.description || undefined,
        section: "docs",
        styles: ["site.css", "docs.css"],
        scripts: ["site.js", "docs.js"],
        body,
        solidHeader: true,
        bodyClass: "docs-page",
      }),
    });
    addSearch(rendered.title || link.label, out, rendered.sections);
  }

  // docs home: the README's groups as cards
  const introHtml = renderMarkdown(intro, { source: "docs/README.md", pageDir: "docs/", publish, posterFor }).html;
  const cards = groups
    .map(
      (g) => `<section class="docs-group">
      <h2>${escapeHtml(g.title)}</h2>
      <div class="docs-cards">${g.links
        .map(
          (l) =>
            `<a class="docs-card" href="../${docPath(l.source)}"><b>${escapeHtml(l.label)}</b>${l.description ? `<span>${escapeHtml(capitalize(l.description))}.</span>` : ""}</a>`,
        )
        .join("")}</div>
    </section>`,
    )
    .join("");
  const homeBody = `<div class="docs-shell wrap docs-home">
  <aside class="docs-side" data-docs-side>
    <button class="docs-side-toggle" type="button" data-docs-toggle aria-expanded="false">Docs <b>/ Overview</b>${icon.chevron}</button>
    ${sidebar("docs/README.md", "../")}
  </aside>
  <article class="docs-article">
    <h1 class="docs-title">Docs</h1>
    <div class="prose docs-intro">${introHtml}</div>
    <div class="docs-start">
      <a class="btn btn-primary" href="../docs/getting-started/">Get started ${icon.arrow}</a>
      <a class="btn" href="../docs/tutorial/">Your first video, step by step</a>
    </div>
    ${cards}
  </article>
</div>`;
  pages.push({
    file: "docs/index.html",
    html: page({
      file: "docs/index.html",
      title: "Docs",
      description: "Getting started, guides and the full reference for demovie.",
      section: "docs",
      styles: ["site.css", "docs.css"],
      scripts: ["site.js", "docs.js"],
      body: homeBody,
      solidHeader: true,
      bodyClass: "docs-page",
    }),
  });
  return { pages, search };
}
