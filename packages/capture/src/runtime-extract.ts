import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type Brand,
  type ColorSet,
  contrastRatio,
  ensureDir,
  type FontSpec,
  logger,
  parseColor,
  slugify,
  toHex,
  type UiText,
} from "@demovie/core";
import type { Page } from "playwright-core";

/** What one page tells us at runtime (computed styles, fonts, logo, UI text, links). */
export interface RuntimeSample {
  url: string;
  path: string;
  title: string;
  h1: string | null;
  body: { background: string; color: string; fontFamily: string };
  headings: { level: number; text: string; fontFamily: string; fontWeight: number }[];
  buttons: { text: string; background: string; color: string; radius: string; shadow: string; area: number }[];
  link: { color: string } | null;
  border: { color: string } | null;
  cardShadow: string | null;
  fonts: { family: string; weight: string; style: string; status: string }[];
  fontUrls: { family: string; weight: string; url: string }[];
  logo: { kind: "svg"; svg: string } | { kind: "img"; src: string } | null;
  uiTexts: { text: string; kind: UiText["kind"]; level?: number; href?: string }[];
  links: string[];
}

/** Runs inside the page. Plain JS on purpose (no bundler helpers can leak into page.evaluate). */
const SAMPLE_SCRIPT = String.raw`(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const txt = (el) => (el.getAttribute("aria-label") || el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  const cs = (el) => getComputedStyle(el);
  const body = document.body;
  let bodyBg = cs(body).backgroundColor;
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(bodyBg)) bodyBg = cs(document.documentElement).backgroundColor;
  const headings = [...document.querySelectorAll("h1, h2, h3")].filter(vis).slice(0, 30).map((h) => ({
    level: Number(h.tagName[1]), text: txt(h), fontFamily: cs(h).fontFamily, fontWeight: Number(cs(h).fontWeight),
  }));
  const buttonEls = [...document.querySelectorAll("main button, main a, main [role=button], main input[type=submit], nav button, nav a, header button, header a, [role=navigation] a")].filter(vis);
  const buttons = buttonEls.map((b) => {
    const s = cs(b); const r = b.getBoundingClientRect();
    return { text: txt(b).slice(0, 60), background: s.backgroundColor, color: s.color, radius: s.borderTopLeftRadius, shadow: s.boxShadow, area: r.width * r.height };
  }).filter((b) => !/rgba\(0, 0, 0, 0\)|transparent/.test(b.background));
  const plainLink = [...document.querySelectorAll("main a, footer a")].filter(vis).find((a) => /rgba\(0, 0, 0, 0\)|transparent/.test(cs(a).backgroundColor));
  const bordered = [...document.querySelectorAll("main *")].slice(0, 2000).find((el) => vis(el) && parseFloat(cs(el).borderTopWidth) >= 1 && cs(el).borderTopStyle !== "none" && el.getBoundingClientRect().width > 120);
  const card = [...document.querySelectorAll("main *")].slice(0, 2000).find((el) => vis(el) && cs(el).boxShadow !== "none" && el.getBoundingClientRect().width > 160 && el.getBoundingClientRect().height > 80);
  const fonts = [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ""), weight: f.weight, style: f.style, status: f.status }));
  const fontUrls = [];
  for (const sheet of [...document.styleSheets]) {
    let rules = [];
    try { rules = [...sheet.cssRules]; } catch (e) { continue; }
    for (const rule of rules) {
      if (rule.constructor.name !== "CSSFontFaceRule" && !(rule.cssText || "").startsWith("@font-face")) continue;
      const fam = (rule.style.getPropertyValue("font-family") || "").replace(/^["']|["']$/g, "");
      const src = rule.style.getPropertyValue("src") || "";
      const m = src.match(/url\(["']?([^"')]+)["']?\)/);
      if (fam && m) fontUrls.push({ family: fam, weight: rule.style.getPropertyValue("font-weight") || "400", url: new URL(m[1], sheet.href || location.href).href });
    }
  }
  let logo = null;
  const top = [...document.querySelectorAll("header, nav, aside, [role=banner]")].filter(vis);
  for (const region of top) {
    const svg = [...region.querySelectorAll("svg")].find((s) => { const r = s.getBoundingClientRect(); return r.width >= 16 && r.height >= 16 && r.top < 200; });
    if (svg) { logo = { kind: "svg", svg: svg.outerHTML }; break; }
    const img = [...region.querySelectorAll("img")].find((i) => /logo|brand|mark/i.test((i.alt || "") + (i.src || "")));
    if (img) { logo = { kind: "img", src: img.currentSrc || img.src }; break; }
  }
  const ui = [];
  for (const a of document.querySelectorAll("nav a, [role=navigation] a, aside a")) if (vis(a)) ui.push({ text: txt(a), kind: "nav", href: a.href && a.href.startsWith(location.origin) ? new URL(a.href).pathname.replace(/\/+$/, "") || "/" : undefined });
  for (const h of headings) ui.push({ text: h.text, kind: "heading", level: h.level });
  for (const b of document.querySelectorAll("button, [role=button], input[type=submit]")) if (vis(b)) ui.push({ text: txt(b) || b.value || "", kind: "button" });
  for (const t of document.querySelectorAll("[role=tab]")) if (vis(t)) ui.push({ text: txt(t), kind: "tab" });
  const links = [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => h.startsWith(location.origin));
  const h1 = document.querySelector("h1");
  return {
    url: location.href, path: location.pathname, title: document.title, h1: h1 ? txt(h1) : null,
    body: { background: bodyBg, color: cs(body).color, fontFamily: cs(body).fontFamily },
    headings, buttons, link: plainLink ? { color: cs(plainLink).color } : null,
    border: bordered ? { color: cs(bordered).borderTopColor } : null, cardShadow: card ? cs(card).boxShadow : null,
    fonts, fontUrls, logo, uiTexts: ui.filter((u) => u.text), links: [...new Set(links)],
  };
})()`;

export async function sampleRuntime(page: Page): Promise<RuntimeSample> {
  return (await page.evaluate(SAMPLE_SCRIPT)) as RuntimeSample;
}

/** next/font names (`__GeistSans_3a0388`, `GeistSans Fallback`) → a human family name. */
export function normalizeFamily(family: string): string {
  let f = family.trim().replace(/^["']|["']$/g, "");
  f = f
    .replace(/^__/, "")
    .replace(/_[0-9a-f]{6}$/i, "")
    .replace(/[ _]Fallback$/i, "");
  const known: Record<string, string> = { GeistSans: "Geist", GeistMono: "Geist Mono", "Geist Sans": "Geist" };
  if (known[f]) return known[f]!;
  return f.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

const GENERIC_FAMILIES =
  /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-monospace|ui-serif|-apple-system|blinkmacsystemfont|cursive|fantasy|arial|helvetica|times new roman|segoe ui|roboto|apple color emoji|segoe ui emoji|noto color emoji)$/i;

function firstFamily(stack: string): string | null {
  for (const part of stack.split(",")) {
    const name = normalizeFamily(part);
    if (name && !GENERIC_FAMILIES.test(name)) return name;
  }
  return null;
}

function close(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return false;
  return Math.abs(ca.r - cb.r) <= 3 && Math.abs(ca.g - cb.g) <= 3 && Math.abs(ca.b - cb.b) <= 3;
}

function confirm(
  brand: Brand,
  key: string,
  runtimeHex: string | null,
  where: string,
  colors: ColorSet,
  field: keyof Omit<ColorSet, "chart">,
): void {
  if (!runtimeHex) return;
  const current = colors[field];
  if (current && close(current, runtimeHex)) {
    if (!brand.provenance[key]?.includes("runtime-confirmed"))
      brand.provenance[key] = `${brand.provenance[key] ?? "static"} (runtime-confirmed)`;
    return;
  }
  // Runtime wins for colors actually rendered (SPEC §8.3).
  brand.provenance[key] =
    `runtime: ${where}${current ? `; static value was ${current} (${brand.provenance[key] ?? "unknown source"})` : ""}`;
  colors[field] = runtimeHex;
}

export interface RuntimeMergeResult {
  /** Font files downloaded into brand/fonts (relative to .demovie/). */
  downloadedFonts: string[];
  logoSaved: string | null;
}

/**
 * Merge runtime samples into a static brand (SPEC §8.3): runtime confirms or fills in values; it wins for rendered
 * colors, static wins for token names. Downloads same-origin font files and the header logo when missing.
 */
export async function mergeRuntimeBrand(
  brand: Brand,
  samples: RuntimeSample[],
  options: { page: Page; demovieDir: string; origin: string },
): Promise<RuntimeMergeResult> {
  const result: RuntimeMergeResult = { downloadedFonts: [], logoSaved: null };
  const first = samples[0];
  if (!first) return result;
  const light = brand.colors.light;

  // Body colors on the first (public) page.
  confirm(
    brand,
    "colors.light.background",
    toHex(first.body.background),
    `computed body background on ${first.path}`,
    light,
    "background",
  );
  confirm(
    brand,
    "colors.light.foreground",
    toHex(first.body.color),
    `computed body color on ${first.path}`,
    light,
    "foreground",
  );

  // Primary: a filled button matching the static primary confirms it; otherwise the largest filled button wins.
  const filled = samples.flatMap((s) =>
    s.buttons
      .map((b) => ({ ...b, page: s.path, hex: toHex(b.background) }))
      .filter((b) => {
        const bg = parseColor(b.background);
        const pageBg = parseColor(s.body.background) ?? { r: 255, g: 255, b: 255, a: 1 };
        return bg && bg.a > 0.5 && contrastRatio(bg, pageBg) >= 1.5;
      }),
  );
  const matching = filled.find((b) => close(b.hex, light.primary));
  const largest = [...filled].sort((a, b) => b.area - a.area)[0];
  const primaryButton = matching ?? largest;
  if (primaryButton) {
    confirm(
      brand,
      "colors.light.primary",
      primaryButton.hex,
      `computed background of button "${primaryButton.text}" on ${primaryButton.page}`,
      light,
      "primary",
    );
    confirm(
      brand,
      "colors.light.primaryForeground",
      toHex(primaryButton.color),
      `computed color of button "${primaryButton.text}" on ${primaryButton.page}`,
      light,
      "primaryForeground",
    );
    if (!brand.radius.md && primaryButton.radius && primaryButton.radius !== "0px") {
      brand.radius.md = primaryButton.radius;
      brand.provenance.radius = `runtime: border-radius of button "${primaryButton.text}"`;
    }
    if (primaryButton.shadow && primaryButton.shadow !== "none" && !brand.shadows.includes(primaryButton.shadow))
      brand.shadows.push(primaryButton.shadow);
  }
  const border = samples.find((s) => s.border)?.border;
  if (border)
    confirm(
      brand,
      "colors.light.border",
      toHex(border.color),
      "computed border color of a bordered element",
      light,
      "border",
    );
  const shadow = samples.find((s) => s.cardShadow)?.cardShadow;
  if (shadow && !brand.shadows.includes(shadow)) brand.shadows.push(shadow);

  // Fonts: confirm, or fill from computed styles.
  const loaded = new Set(
    samples.flatMap((s) =>
      s.fonts.filter((f) => f.status === "loaded").map((f) => normalizeFamily(f.family).toLowerCase()),
    ),
  );
  const fillFont = (role: "heading" | "body", stack: string | undefined, weights: number[]) => {
    const current = brand.fonts[role];
    if (current) {
      if (loaded.has(current.family.toLowerCase()))
        brand.provenance[`fonts.${role}`] = `${brand.provenance[`fonts.${role}`] ?? "static"} (runtime-confirmed)`;
      return;
    }
    const family = stack ? firstFamily(stack) : null;
    if (!family) return;
    brand.fonts[role] = { family, weights: [...new Set(weights)].sort((a, b) => a - b), files: [] } satisfies FontSpec;
    brand.provenance[`fonts.${role}`] = `runtime: computed font-family on ${first.path}`;
  };
  const headingSample = samples.flatMap((s) => s.headings)[0];
  fillFont("body", first.body.fontFamily, [400, 500]);
  fillFont(
    "heading",
    headingSample?.fontFamily,
    samples.flatMap((s) => s.headings.map((h) => h.fontWeight)),
  );

  // Download same-origin font files for families that have none.
  await ensureDir(path.join(options.demovieDir, "brand", "fonts"));
  for (const role of ["heading", "body", "mono"] as const) {
    const spec = brand.fonts[role];
    if (!spec || spec.files.length > 0) continue;
    const urls = samples
      .flatMap((s) => s.fontUrls)
      .filter(
        (f) =>
          normalizeFamily(f.family).toLowerCase() === spec.family.toLowerCase() && f.url.startsWith(options.origin),
      );
    for (const font of urls.slice(0, 6)) {
      try {
        const res = await options.page.request.get(font.url);
        if (!res.ok()) continue;
        const ext = path.extname(new URL(font.url).pathname) || ".woff2";
        const weight = /\s/.test(font.weight) ? "variable" : font.weight;
        const rel = `brand/fonts/${slugify(spec.family)}-${weight}${ext}`;
        await writeFile(path.join(options.demovieDir, rel), await res.body());
        if (!spec.files.includes(rel)) spec.files.push(rel);
        result.downloadedFonts.push(rel);
      } catch (error) {
        logger.debug(`font download failed: ${font.url}: ${(error as Error).message}`);
      }
    }
    if (spec.files.length > 0) brand.provenance[`fonts.${role}.files`] = "runtime: downloaded same-origin font files";
  }

  // Logo from the header/nav when static extraction found none.
  if (!brand.logo.mark && !brand.logo.wordmark) {
    const logo = samples.map((s) => s.logo).find(Boolean);
    if (logo?.kind === "svg") {
      const svg = logo.svg.includes("xmlns=")
        ? logo.svg
        : logo.svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      await writeFile(path.join(options.demovieDir, "brand", "logo-mark.svg"), `${svg}\n`);
      brand.logo.mark = "brand/logo-mark.svg";
      brand.provenance["logo.mark"] = "runtime: inline SVG in the header/nav";
      result.logoSaved = brand.logo.mark;
    } else if (logo?.kind === "img" && logo.src.startsWith(options.origin)) {
      const res = await options.page.request.get(logo.src).catch(() => null);
      if (res?.ok()) {
        const ext = path.extname(new URL(logo.src).pathname) || ".png";
        await writeFile(path.join(options.demovieDir, "brand", `logo${ext}`), await res.body());
        brand.logo.wordmark = `brand/logo${ext}`;
        brand.provenance["logo.wordmark"] = `runtime: header image ${new URL(logo.src).pathname}`;
        result.logoSaved = brand.logo.wordmark;
      }
    }
  }
  brand.warnings = brand.warnings.filter((w) => {
    if (w.startsWith("colors.light.")) return !brand.colors.light[w.split(".")[2]!.split(" ")[0] as keyof ColorSet];
    if (w.startsWith("no brand font")) return !brand.fonts.body;
    if (w.startsWith("no logo")) return !brand.logo.mark && !brand.logo.wordmark;
    return true;
  });
  return result;
}
