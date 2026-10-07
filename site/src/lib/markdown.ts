/** Markdown → HTML for the site: GitHub-style heading ids, shiki highlighting, and links rewritten for Pages. */
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import { REPO_URL } from "./site.ts";

const LANGS = ["bash", "shell", "json", "jsonc", "ts", "tsx", "js", "yaml", "html", "css", "diff", "markdown", "text"];
const ALIASES: Record<string, string> = { sh: "bash", zsh: "bash", console: "bash", yml: "yaml", md: "markdown" };

let highlighter: Highlighter | undefined;

export async function initHighlighter(): Promise<void> {
  highlighter ??= await createHighlighter({ themes: ["github-light", "vesper"], langs: LANGS });
}

export function highlight(code: string, lang = "text"): string {
  if (!highlighter) throw new Error("call initHighlighter() first");
  const resolved = ALIASES[lang] ?? lang;
  return highlighter.codeToHtml(code, {
    lang: LANGS.includes(resolved) ? resolved : "text",
    themes: { light: "github-light", dark: "vesper" },
    defaultColor: false,
  });
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COPY_ICON =
  '<svg class="copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg><svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

export function copyButton(label = "Copy"): string {
  return `<button class="copy-btn" type="button" data-copy aria-label="${label}">${COPY_ICON}</button>`;
}

/** A code block with a header (language label and copy button). */
export function codeBlock(code: string, lang = "text", title?: string): string {
  const body = code.replace(/\n$/, "");
  // a one-line command needs no header: just the line and a copy button
  if (!title && !body.includes("\n"))
    return `<div class="code is-compact">${highlight(body, lang)}${copyButton()}</div>`;
  const label = title ?? (lang === "text" ? "" : lang);
  return `<div class="code"><div class="code-head"><span>${escapeHtml(label)}</span>${copyButton()}</div>${highlight(body, lang)}</div>`;
}

/** GitHub's heading slugs: lowercase, punctuation dropped, spaces to hyphens, duplicates numbered. */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
}

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export interface Section {
  heading: string;
  id: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  title: string;
  headings: Heading[];
  sections: Section[];
}

/**
 * How links in a Markdown file resolve. `source` is the file's path relative to the repo root; `pageDir` is the output
 * directory of the page it renders into, relative to the site root. `publish` maps a repo path to a site path when the
 * site publishes it (e.g. docs/tutorial.md → docs/tutorial/), or returns undefined to link to GitHub instead.
 */
export interface LinkContext {
  source: string;
  pageDir: string;
  publish: (repoPath: string) => string | undefined;
  /** A poster image (site path) for a published video, by its file name. */
  posterFor?: (fileName: string) => string | undefined;
}

export function resolveHref(href: string, ctx: LinkContext): string {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [target = "", hash = ""] = href.split("#");
  const repoPath = path.posix.normalize(path.posix.join(path.posix.dirname(ctx.source), target));
  const published = ctx.publish(repoPath);
  if (published === undefined) {
    const kind = path.posix.extname(repoPath) ? "blob" : "tree";
    return `${REPO_URL}/${kind}/main/${repoPath}${hash ? `#${hash}` : ""}`;
  }
  let rel = path.posix.relative(ctx.pageDir, published) || ".";
  if (published.endsWith("/") && !rel.endsWith("/")) rel += "/";
  return `${rel}${hash ? `#${hash}` : ""}`;
}

function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Render a Markdown document. Headings get anchor links; `## ` sections are collected for search. */
export function renderMarkdown(
  source: string,
  ctx: LinkContext,
  options: { anchors?: boolean } = {},
): RenderedMarkdown {
  const slug = createSlugger();
  const headings: Heading[] = [];
  const anchors = options.anchors ?? true;
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        const text = plain(inner);
        const id = slug(text);
        headings.push({ depth: token.depth, text, id });
        if (token.depth === 1) return `<h1 id="${id}">${inner}</h1>\n`;
        const anchor = anchors ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : "";
        return `<h${token.depth} id="${id}">${inner}${anchor}</h${token.depth}>\n`;
      },
      code(token: Tokens.Code) {
        const lang = (token.lang ?? "").split(/\s/)[0] || "text";
        return codeBlock(token.text, lang);
      },
      link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Link) {
        const href = resolveHref(token.href, ctx);
        const only = token.tokens.length === 1 ? token.tokens[0] : undefined;
        if (only?.type === "image" && /\.mp4$/i.test(href)) {
          const image = only as Tokens.Image;
          const posterPath = ctx.posterFor?.(path.posix.basename(href));
          const poster = posterPath ? path.posix.relative(ctx.pageDir, posterPath) : undefined;
          return `<figure class="md-video"><video controls muted loop playsinline preload="metadata"${poster ? ` poster="${poster}"` : ""} aria-label="${escapeHtml(image.text)}"><source src="${href}" type="video/mp4"></video><figcaption>${escapeHtml(image.text)}</figcaption></figure>`;
        }
        const inner = this.parser.parseInline(token.tokens);
        const external = /^https?:/.test(href);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        return `<a href="${href}"${title}${external ? ' rel="noopener"' : ""}>${inner}</a>`;
      },
      image(token: Tokens.Image) {
        const src = resolveHref(token.href, ctx);
        return `<img src="${src}" alt="${escapeHtml(token.text)}" loading="lazy">`;
      },
      table(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Table) {
        const cell = (c: Tokens.TableCell, tag: "th" | "td") => {
          const align = c.align ? ` style="text-align:${c.align}"` : "";
          // short single-token cells (ids like DM-T01, flags) shouldn't break at their hyphens
          const short = c.text.length <= 14 && !/\s/.test(c.text.trim()) ? ' class="nw"' : "";
          return `<${tag}${align}${short}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        };
        const head = `<tr>${token.header.map((c) => cell(c, "th")).join("")}</tr>`;
        const rows = token.rows.map((r) => `<tr>${r.map((c) => cell(c, "td")).join("")}</tr>`).join("\n");
        return `<div class="md-table"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const html = marked.parse(source, { async: false }) as string;
  const title = headings.find((h) => h.depth === 1)?.text ?? "";
  return { html, title, headings, sections: collectSections(html, title, headings) };
}

/** Split rendered HTML at h2/h3 boundaries into plain-text sections for the search index. */
function collectSections(html: string, title: string, headings: Heading[]): Section[] {
  const parts = html.split(/(?=<h[23] id=")/);
  const sections: Section[] = [];
  for (const part of parts) {
    const m = part.match(/^<h([23]) id="([^"]+)">/);
    const heading = m ? headings.find((h) => h.id === m[2]) : undefined;
    const body = plain(part.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/g, " ").replace(/<pre[\s\S]*?<\/pre>/g, " "));
    sections.push({ heading: heading?.text ?? title, id: heading?.id ?? "", text: body.slice(0, 600) });
  }
  return sections.filter((s) => s.text || s.id);
}

/** The `## Heading` sections of a Markdown document, by heading text. */
export function markdownSections(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = source.split(/^## /m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    out.set(part.slice(0, nl).trim(), part.slice(nl + 1).trim());
  }
  return out;
}
