import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { type Glossary, GlossarySchema } from "../schemas/project-files.ts";
import { markdownHeadings } from "../util/markdown.ts";
import { type AnyNode, parseModule, walk } from "../util/static-js.ts";

/** Words too generic to be product vocabulary (SPEC §8.4). Compared case-insensitively. */
const GENERIC = new Set(
  [
    "home",
    "back",
    "ok",
    "okay",
    "close",
    "cancel",
    "next",
    "previous",
    "prev",
    "more",
    "menu",
    "open menu",
    "close menu",
    "search",
    "submit",
    "yes",
    "no",
    "continue",
    "learn more",
    "read more",
    "see all",
    "view all",
    "skip to content",
    "skip to main content",
    "loading",
    "loading…",
    "toggle theme",
    "toggle navigation",
    "toggle sidebar",
    "accept",
    "decline",
    "dismiss",
    "copy",
    "edit",
    "delete",
    "remove",
    "save",
    "x",
    "×",
  ].map((w) => w.toLowerCase()),
);

export const MAX_UI_LABELS = 200;

export function isGenericLabel(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.length < 2 || GENERIC.has(t) || /^[\d\s.,:%$€£+\-/]+$/.test(t) || t.length > 60;
}

/** Dedupe keeping the first casing seen, dropping generic labels. */
export function cleanLabels(labels: Iterable<string>, limit = MAX_UI_LABELS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = stripCount(raw.replace(/\s+/g, " ").trim());
    if (!label || isGenericLabel(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

export interface UiText {
  text: string;
  kind: "nav" | "heading" | "button" | "tab" | "link";
  route: string;
  level?: number;
  /** Target path of nav links. */
  href?: string;
}

export interface GlossaryInputs {
  productName: string;
  tagline: string | null;
  ctaUrl: string | null;
  readme: string | null;
  uiTexts: UiText[];
  people: string[];
  entities: string[];
  /** Feature terms found elsewhere (e.g. README "Features" bullets). */
  features?: { term: string; source: string }[];
}

/** README bullets under a "Features" heading, including its sub-headings (`## Features` › `### Billing`). */
export function readmeFeatures(readme: string): { term: string; source: string }[] {
  const out: { term: string; source: string }[] = [];
  const lines = readme.split(/\r?\n/);
  let featuresLevel = 0; // heading level of the Features section we are in, 0 when outside
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      if (featuresLevel && level > featuresLevel) continue;
      featuresLevel = /features|what you get|highlights/i.test(heading[2]!) ? level : 0;
      continue;
    }
    if (!featuresLevel) continue;
    // `- **Term:** text` or `- **Term** — text`, else `- Term: text`
    const bold = line.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/);
    const plain = bold ? null : line.match(/^\s*[-*]\s+([^:—–*\s-][^:—–-]*?)(?:\s*[:—–-]|$)/);
    const term = (bold?.[1] ?? plain?.[1] ?? "").trim().replace(/[.:]$/, "");
    if (term && term.length <= 40) out.push({ term, source: "README features" });
  }
  return out;
}

/**
 * Feature terms (SPEC §8.4): a nav link whose target page's h1 extends the nav label ("Projects" → "Projects board"),
 * and a feature grid on the landing page (three or more short h3 headings on "/").
 */
const AUTH_HREF = /(^|\/)(log-?in|sign-?in|sign-?up|register|log-?out|sign-?out)(\/|$)/i;

export function navFeatures(uiTexts: UiText[]): { term: string; source: string }[] {
  const out: { term: string; source: string }[] = [];
  const h1ByRoute = new Map<string, string>();
  for (const t of uiTexts)
    if (t.kind === "heading" && (t.level ?? 1) === 1 && !h1ByRoute.has(t.route)) h1ByRoute.set(t.route, t.text);
  for (const nav of uiTexts.filter((t) => t.kind === "nav" && t.href && !AUTH_HREF.test(t.href))) {
    const h1 = h1ByRoute.get(nav.href!);
    if (!h1 || isGenericLabel(h1)) continue;
    const label = stripCount(nav.text).toLowerCase();
    const lower = h1.toLowerCase();
    if (
      lower !== label &&
      (lower.startsWith(`${label} `) || lower.endsWith(` ${label}`)) &&
      h1.split(/\s+/).length <= 4
    ) {
      out.push({ term: h1, source: `nav + h1 on ${nav.href}` });
    }
  }
  const landing = uiTexts.filter((t) => t.kind === "heading" && t.level === 3 && t.route === "/");
  const grid = landing.filter(
    (t) => t.text.split(/\s+/).length <= 4 && /^[A-Z0-9]/.test(t.text) && !/[.?!:]$/.test(t.text),
  );
  if (grid.length >= 3) for (const h of grid) out.push({ term: h.text, source: "h3 on /" });
  return out;
}

/** "Projects 9" (nav label with a count badge) → "Projects". */
export function stripCount(text: string): string {
  return text.replace(/\s+\d+$/, "").trim();
}

export function buildGlossary(inputs: GlossaryInputs): Glossary {
  const features = [...(inputs.features ?? []), ...navFeatures(inputs.uiTexts)];
  if (inputs.readme) features.push(...readmeFeatures(inputs.readme));
  const seenFeatures = new Set<string>();
  const uniqueFeatures = features.filter((f) => {
    const key = f.term.toLowerCase();
    if (seenFeatures.has(key)) return false;
    seenFeatures.add(key);
    return true;
  });
  return GlossarySchema.parse({
    productName: inputs.productName,
    tagline: inputs.tagline,
    features: uniqueFeatures.slice(0, 40),
    uiLabels: cleanLabels(inputs.uiTexts.map((t) => t.text)),
    entities: cleanLabels(inputs.entities, 100),
    people: cleanLabels(inputs.people, 50),
    ctaUrl: inputs.ctaUrl,
    avoid: [],
  });
}

const SECTION_COMMENTS: Record<string, string> = {
  Features: "<!-- Product features, in the product's own words. Format: `- Term — where it appears`. -->",
  "UI labels": "<!-- Exact UI text (casing matters). -->",
  Entities: "<!-- Companies, projects and other names from demo data only. -->",
  People: "<!-- Fictional people from demo data only. -->",
  Avoid: "<!-- Words the product does NOT use. Agents must not put these on screen. -->",
  Discovered: "<!-- Appended by `demovie capture`. Move items into a section above to keep them; delete the rest. -->",
};

/** Render glossary.md (human-editable, authoritative). */
export function renderGlossaryMd(g: Glossary, discovered: string[] = []): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "");
  const section = (title: string, body: string) =>
    `## ${title}\n${SECTION_COMMENTS[title]}\n${body}${body ? "\n" : ""}`;
  return [
    `# ${g.productName} glossary`,
    "",
    "<!-- Human-editable and authoritative. `npx demovie glossary sync` regenerates glossary.json from this file.",
    "     demovie only ever appends to the Discovered section. -->",
    "",
    `- **Product name:** ${g.productName}`,
    `- **Tagline:** ${g.tagline ?? ""}`,
    `- **CTA URL:** ${g.ctaUrl ?? ""}`,
    "",
    section("Features", list(g.features.map((f) => (f.source ? `${f.term} — ${f.source}` : f.term)))),
    section("UI labels", list(g.uiLabels)),
    section("Entities", list(g.entities)),
    section("People", list(g.people)),
    section("Avoid", list(g.avoid)),
    section("Discovered", list(discovered)),
  ].join("\n");
}

type SectionKey = "features" | "uiLabels" | "entities" | "people" | "avoid" | "discovered";

function sectionKey(title: string): SectionKey | null {
  const t = title.toLowerCase().trim();
  if (t.startsWith("feature")) return "features";
  if (t.includes("label") || t === "ui" || t === "ui text") return "uiLabels";
  if (t.startsWith("entit") || t.startsWith("compan")) return "entities";
  if (t.startsWith("people") || t.startsWith("person")) return "people";
  if (t.startsWith("avoid") || t.includes("don't") || t.includes("do not")) return "avoid";
  if (t.startsWith("discover")) return "discovered";
  return null;
}

/** Parse glossary.md into glossary.json (Discovered items count as UI labels). */
export function parseGlossaryMd(md: string): Glossary {
  const text = md.replace(/<!--[\s\S]*?-->/g, "");
  const lists: Record<SectionKey, string[]> = {
    features: [],
    uiLabels: [],
    entities: [],
    people: [],
    avoid: [],
    discovered: [],
  };
  let productName: string | null = null;
  let tagline: string | null = null;
  let ctaUrl: string | null = null;
  let current: SectionKey | null = null;
  let seenSection = false;
  for (const line of text.split(/\r?\n/)) {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h1 && !productName) {
      productName = h1[1]!.replace(/\s+glossary$/i, "").trim();
      continue;
    }
    const h2 = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (h2) {
      current = sectionKey(h2[1]!);
      seenSection = true;
      continue;
    }
    const item = line.match(/^\s*[-*]\s+(.*\S)\s*$/);
    if (!item) continue;
    const value = item[1]!;
    const kv = value.match(/^\*\*([^*]+?):?\*\*:?\s*(.*)$/);
    if (kv && !seenSection) {
      const key = kv[1]!.toLowerCase();
      const v = kv[2]!.trim() || null;
      if (key.startsWith("product")) productName = v ?? productName;
      else if (key.startsWith("tagline")) tagline = v;
      else if (key.startsWith("cta")) ctaUrl = v;
      continue;
    }
    if (current) lists[current].push(value.replace(/^`|`$/g, ""));
  }
  return GlossarySchema.parse({
    productName: productName ?? "Product",
    tagline,
    ctaUrl,
    features: lists.features.map((f) => {
      const [term, ...rest] = f.split(/\s+[—–]\s+|\s+-\s+/);
      return { term: term!.trim(), source: rest.join(" — ").trim() || null };
    }),
    uiLabels: cleanLabels([...lists.uiLabels, ...lists.discovered]),
    entities: lists.entities,
    people: lists.people,
    avoid: lists.avoid,
  });
}

/** Append labels not yet mentioned anywhere in the md to its Discovered section. Never rewrites user content. */
export function appendDiscovered(md: string, labels: string[]): { md: string; added: string[] } {
  const known = parseGlossaryMd(md);
  const mentioned = new Set(
    [
      ...known.uiLabels,
      ...known.features.map((f) => f.term),
      ...known.entities,
      ...known.people,
      ...known.avoid,
      known.productName,
    ].map((s) => s.toLowerCase()),
  );
  const added = cleanLabels(labels).filter((l) => !mentioned.has(l.toLowerCase()));
  if (added.length === 0) return { md, added };
  const room = Math.max(0, MAX_UI_LABELS - known.uiLabels.length);
  const toAdd = added.slice(0, room);
  if (toAdd.length === 0) return { md, added: [] };
  const block = toAdd.map((l) => `- ${l}`).join("\n");
  const lines = md.replace(/\s*$/, "").split("\n");
  const idx = lines.findIndex((l) => /^##\s+discover/i.test(l));
  if (idx < 0)
    return { md: `${lines.join("\n")}\n\n## Discovered\n${SECTION_COMMENTS.Discovered}\n${block}\n`, added: toAdd };
  let end = idx + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end]!)) end++;
  lines.splice(end, 0, block);
  return { md: `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`, added: toAdd };
}

const PERSON = /^[A-Z][a-zà-ÿ'’-]+(?:\s[A-Z][a-zà-ÿ'’-]+){1,2}$/;
const ENTITY_KEYS =
  /^(company|customer|account|org|organization|organisation|workspace|client|brand|vendor|partner)(name)?$/i;

export interface SeedData {
  file: string | null;
  people: string[];
  entities: string[];
}

/** Find the seed script behind a command like `pnpm demo:seed` → `node scripts/seed.mjs`. */
export function seedFileFromCommand(
  appRoot: string,
  command: string | null,
  scripts: Record<string, string> = {},
): string | null {
  if (!command) return null;
  const scriptName = command.match(/^(?:pnpm|yarn|bun(?: run)?|npm run)\s+([\w:.-]+)/)?.[1];
  const resolvedCommand = scriptName && scripts[scriptName] ? scripts[scriptName]! : command;
  for (const token of resolvedCommand.split(/\s+/)) {
    if (!/\.(m?[jt]s|cjs|json)$/.test(token)) continue;
    const file = path.resolve(appRoot, token);
    if (existsSync(file)) return file;
  }
  return null;
}

/** People and entities from a seed file (object literals with name/email, company keys, project names). */
export function extractSeedData(file: string | null): SeedData {
  const result: SeedData = { file, people: [], entities: [] };
  if (!file || !existsSync(file)) return result;
  const code = readFileSync(file, "utf8");
  const objects: Record<string, unknown>[] = [];
  if (file.endsWith(".json")) {
    const visit = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") {
        objects.push(v as Record<string, unknown>);
        Object.values(v).forEach(visit);
      }
    };
    try {
      visit(JSON.parse(code));
    } catch {
      return result;
    }
  } else {
    const ast = parseModule(code, file);
    if (!ast) return result;
    walk(ast, (node: AnyNode) => {
      if (node.type !== "ObjectExpression") return;
      const obj: Record<string, unknown> = {};
      for (const p of node.properties as AnyNode[]) {
        if (p.type !== "Property" || p.computed) continue;
        const key = p.key.type === "Identifier" ? p.key.name : String(p.key.value);
        obj[key] =
          p.value.type === "Literal"
            ? p.value.value
            : p.value.type === "TemplateLiteral" && p.value.expressions.length === 0
              ? p.value.quasis[0].value.cooked
              : undefined;
      }
      objects.push(obj);
    });
  }
  const people = new Set<string>();
  const entities = new Set<string>();
  for (const obj of objects) {
    const name = typeof obj.name === "string" ? obj.name.trim() : null;
    const looksLikePerson = Boolean(obj.email || obj.role || obj.avatar || obj.initials || obj.title || obj.jobTitle);
    if (name && looksLikePerson && PERSON.test(name)) people.add(name);
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && ENTITY_KEYS.test(key) && /^[A-Z0-9]/.test(value) && value.length <= 40)
        entities.add(value.trim());
    }
    if (name && !looksLikePerson && /^[A-Z0-9]/.test(name) && name.split(/\s+/).length <= 5 && name.length <= 40) {
      if (
        obj.status !== undefined ||
        obj.id !== undefined ||
        obj.slug !== undefined ||
        obj.customer !== undefined ||
        obj.company !== undefined
      ) {
        entities.add(name);
      }
    }
  }
  for (const p of people) entities.delete(p);
  return { file, people: [...people], entities: [...entities] };
}

export function readReadme(...dirs: (string | null)[]): string | null {
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of ["README.md", "readme.md", "Readme.md"]) {
      const file = path.join(dir, name);
      if (existsSync(file)) return readFileSync(file, "utf8");
    }
  }
  return null;
}

export { markdownHeadings };
