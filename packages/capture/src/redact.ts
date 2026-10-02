/**
 * Redaction (SPEC §9.8). Patterns live here once; the in-page script receives them as strings, and unit tests use
 * `redactText` with the same patterns.
 */

export type RedactionPattern = "email" | "phone" | "secret";

export const PATTERNS: Record<RedactionPattern, RegExp[]> = {
  email: [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g],
  phone: [/(?<![\w-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,5}(?![\w-])/g],
  secret: [
    /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    /\bAIza[0-9A-Za-z_-]{35}\b/g,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,})\b/g,
  ],
};

const SECRET_PREFIX =
  /^(sk_live_|sk_test_|pk_live_|pk_test_|rk_live_|rk_test_|gh[pousr]_|github_pat_|AKIA|ASIA|xox[abprs]-|AIza|eyJ|sk-proj-|sk-ant-|sk-)/;

const FICTIONAL_NAMES = [
  "alex.morgan",
  "sam.rivera",
  "jordan.lee",
  "taylor.reed",
  "casey.quinn",
  "riley.hart",
  "morgan.blake",
  "jamie.fox",
  "drew.carter",
  "avery.lane",
];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic fictional replacement of similar length (SPEC §9.8). */
export function fictional(kind: RedactionPattern, original: string): string {
  const h = hash(original);
  if (kind === "email") {
    const domains = ["example.com", "example.org", "example.net"];
    let best = "";
    for (let i = 0; i < FICTIONAL_NAMES.length; i++) {
      const candidate = `${FICTIONAL_NAMES[(h + i) % FICTIONAL_NAMES.length]}@${domains[(h + i) % domains.length]}`;
      if (!best || Math.abs(candidate.length - original.length) < Math.abs(best.length - original.length))
        best = candidate;
    }
    return best;
  }
  if (kind === "phone") {
    const digits = `5550100${String(h).padStart(10, "0")}`;
    let i = 0;
    const out = original.replace(/\d/g, () => digits[i++ % digits.length]!);
    return out;
  }
  const prefix = original.match(SECRET_PREFIX)?.[0] ?? "";
  return `${prefix}${"•".repeat(Math.max(6, Math.min(24, original.length - prefix.length)))}`;
}

export function replacementFor(kind: RedactionPattern, original: string, mode: "fictional" | "dots"): string {
  if (mode === "dots") return "•••";
  return fictional(kind, original);
}

/** Node-side equivalent of the in-page redaction (used by tests and for text outside the DOM). */
export function redactText(
  text: string,
  options: { patterns: RedactionPattern[]; allow: RegExp[]; mode: "fictional" | "dots" },
  counts: Record<string, number> = {},
): string {
  let out = text;
  for (const kind of options.patterns) {
    for (const re of PATTERNS[kind]) {
      out = out.replace(new RegExp(re.source, re.flags), (match) => {
        if (kind === "email" && options.allow.some((a) => a.test(match))) return match;
        counts[kind] = (counts[kind] ?? 0) + 1;
        return replacementFor(kind, match, options.mode);
      });
    }
  }
  return out;
}

/** Serializable form for page.evaluate. */
export function serializePatterns(
  kinds: RedactionPattern[],
): { kind: RedactionPattern; source: string; flags: string }[] {
  return kinds.flatMap((kind) => PATTERNS[kind].map((re) => ({ kind, source: re.source, flags: re.flags })));
}

/**
 * In-page redaction: text nodes and input values; `mask.selectors` get blurred. Returns counts per pattern.
 * Runs as a plain string (see DECISIONS D28). The argument mirrors `RedactArgs`.
 */
export const REDACT_SCRIPT = String.raw`(args) => {
  const counts = {};
  const allow = args.allow.map((a) => new RegExp(a, "i"));
  const SECRET_PREFIX = /^(sk_live_|sk_test_|pk_live_|pk_test_|rk_live_|rk_test_|gh[pousr]_|github_pat_|AKIA|ASIA|xox[abprs]-|AIza|eyJ|sk-proj-|sk-ant-|sk-)/;
  const NAMES = ["alex.morgan","sam.rivera","jordan.lee","taylor.reed","casey.quinn","riley.hart","morgan.blake","jamie.fox","drew.carter","avery.lane"];
  const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };
  const fictional = (kind, original) => {
    if (args.mode === "dots") return "•••";
    const h = hash(original);
    if (kind === "email") {
      const domains = ["example.com", "example.org", "example.net"]; let best = "";
      for (let i = 0; i < NAMES.length; i++) {
        const c = NAMES[(h + i) % NAMES.length] + "@" + domains[(h + i) % domains.length];
        if (!best || Math.abs(c.length - original.length) < Math.abs(best.length - original.length)) best = c;
      }
      return best;
    }
    if (kind === "phone") { const d = "5550100" + String(h).padStart(10, "0"); let i = 0; return original.replace(/\d/g, () => d[i++ % d.length]); }
    const prefix = (original.match(SECRET_PREFIX) || [""])[0];
    return prefix + "•".repeat(Math.max(6, Math.min(24, original.length - prefix.length)));
  };
  const apply = (text) => {
    let out = text;
    for (const p of args.patterns) {
      out = out.replace(new RegExp(p.source, p.flags), (m) => {
        if (p.kind === "email" && allow.some((a) => a.test(m))) return m;
        counts[p.kind] = (counts[p.kind] || 0) + 1;
        return fictional(p.kind, m);
      });
    }
    return out;
  };
  // Every root a screenshot shows: the document, open shadow roots and same-origin iframes.
  const roots = [];
  const collect = (root) => {
    roots.push(root);
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) collect(el.shadowRoot);
      if (el.tagName === "IFRAME") { try { const doc = el.contentDocument; if (doc && doc.body) collect(doc); } catch {} }
    }
  };
  collect(document);
  if (args.patterns.length) {
    for (const root of roots) {
      const doc = root.ownerDocument || root;
      const walker = doc.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE")) continue;
        const next = apply(node.nodeValue || "");
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      for (const el of root.querySelectorAll("input, textarea")) {
        if (el.type === "password" || el.type === "hidden") continue;
        const next = apply(el.value || "");
        if (next !== el.value) { el.value = next; el.setAttribute("value", next); }
        const ph = el.getAttribute("placeholder");
        if (ph) { const np = apply(ph); if (np !== ph) el.setAttribute("placeholder", np); }
      }
      // attributes element maps record: titles, alt text, labels and link targets (mailto:, tel:, ?email=…)
      for (const el of root.querySelectorAll("[title], img[alt], [aria-label], [href]")) {
        for (const attr of ["title", "alt", "aria-label", "href"]) {
          const v = el.getAttribute(attr);
          if (!v) continue;
          const text = attr === "href" ? (() => { try { return decodeURIComponent(v); } catch { return v; } })() : v;
          const nv = apply(text);
          if (nv !== text) el.setAttribute(attr, nv);
        }
      }
    }
    if (document.title) { const t = apply(document.title); if (t !== document.title) document.title = t; }
  }
  let masked = 0;
  for (const sel of args.selectors) {
    for (const root of roots)
      for (const el of root.querySelectorAll(sel)) { el.style.setProperty("filter", "blur(8px)", "important"); masked++; }
  }
  if (masked) counts.selector = masked;
  return counts;
}`;

export interface RedactArgs {
  patterns: { kind: RedactionPattern; source: string; flags: string }[];
  allow: string[];
  mode: "fictional" | "dots";
  selectors: string[];
}
