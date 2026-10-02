import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { NextjsDetection, PackageJson } from "../detect/framework.ts";
import type { Brand, ColorSet, FontSpec } from "../schemas/brand.ts";
import { toHex } from "../util/color.ts";
import { toPosix } from "../util/fs.ts";
import { parseJsonc } from "../util/jsonc.ts";
import { slugify } from "../util/slug.ts";
import {
  type AnyNode,
  callsTo,
  defaultExportValue,
  exportedConst,
  literalValue,
  moduleImports,
  parseModule,
  UNKNOWN,
  walk,
} from "../util/static-js.ts";
import { type CssTokens, type CssVar, lengthToPx, parseCssTokens, resolveVars } from "./css.ts";

/** A file to copy into `.demovie/` (dest is relative to `.demovie/`). */
export interface FileCopy {
  from: string;
  to: string;
}

export interface StaticBrandResult {
  brand: Brand;
  copies: FileCopy[];
  /** Root layout metadata (literal fields only). */
  metadata: {
    title: string | null;
    description: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    url: string | null;
  };
  cssFiles: string[];
}

const COLOR_KEYS: Record<Exclude<keyof ColorSet, "chart">, string[]> = {
  background: ["--background", "--color-background", "--bg", "--color-bg"],
  foreground: ["--foreground", "--color-foreground", "--fg", "--color-fg", "--text"],
  primary: ["--primary", "--color-primary", "--brand", "--color-brand"],
  primaryForeground: ["--primary-foreground", "--color-primary-foreground", "--brand-foreground"],
  secondary: ["--secondary", "--color-secondary"],
  accent: ["--accent", "--color-accent"],
  muted: ["--muted", "--color-muted"],
  mutedForeground: ["--muted-foreground", "--color-muted-foreground"],
  border: ["--border", "--color-border"],
  ring: ["--ring", "--color-ring"],
};

const LAYOUTS = ["layout.tsx", "layout.jsx", "layout.js", "layout.ts"];

function readIf(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function tsconfigPaths(appRoot: string): { baseUrl: string; paths: Record<string, string[]> } {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const text = readIf(path.join(appRoot, name));
    if (!text) continue;
    try {
      const json = parseJsonc(text) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };
      return {
        baseUrl: path.join(appRoot, json.compilerOptions?.baseUrl ?? "."),
        paths: json.compilerOptions?.paths ?? {},
      };
    } catch {
      /* ignore */
    }
  }
  return { baseUrl: appRoot, paths: {} };
}

/** Resolve a module specifier from `fromFile` (relative or tsconfig `paths` alias). */
export function resolveLocalSpecifier(appRoot: string, fromFile: string, spec: string): string | null {
  const candidates: string[] = [];
  if (spec.startsWith(".")) candidates.push(path.resolve(path.dirname(fromFile), spec));
  else {
    const { baseUrl, paths } = tsconfigPaths(appRoot);
    for (const [pattern, targets] of Object.entries(paths)) {
      const prefix = pattern.replace(/\*$/, "");
      if (pattern.endsWith("*") ? spec.startsWith(prefix) : spec === pattern) {
        for (const target of targets)
          candidates.push(path.resolve(baseUrl, target.replace(/\*$/, spec.slice(prefix.length))));
      }
    }
    if (spec.startsWith("/")) candidates.push(path.join(appRoot, spec));
  }
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"]) if (existsSync(c + ext)) return c + ext;
    for (const ext of ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) if (existsSync(c + ext)) return c + ext;
  }
  return null;
}

function findRootLayout(appRoot: string, nextjs: NextjsDetection | null): string | null {
  if (nextjs?.appDir) {
    for (const l of LAYOUTS) {
      const f = path.join(appRoot, nextjs.appDir, l);
      if (existsSync(f)) return f;
    }
  }
  if (nextjs?.pagesDir) {
    for (const l of ["_app.tsx", "_app.jsx", "_app.js", "_app.ts"]) {
      const f = path.join(appRoot, nextjs.pagesDir, l);
      if (existsSync(f)) return f;
    }
  }
  return null;
}

function collectCssFiles(appRoot: string, layoutFile: string | null, ast: AnyNode | null): string[] {
  const files = new Set<string>();
  if (layoutFile && ast) {
    for (const imp of moduleImports(ast)) {
      if (!imp.source.endsWith(".css")) continue;
      const resolved = resolveLocalSpecifier(appRoot, layoutFile, imp.source);
      if (resolved) files.add(resolved);
    }
  }
  const components = readIf(path.join(appRoot, "components.json"));
  if (components) {
    try {
      const css = (JSON.parse(components) as { tailwind?: { css?: string } }).tailwind?.css;
      if (css && existsSync(path.join(appRoot, css))) files.add(path.join(appRoot, css));
    } catch {
      /* ignore */
    }
  }
  if (files.size === 0) {
    for (const c of [
      "src/app/globals.css",
      "app/globals.css",
      "styles/globals.css",
      "src/styles/globals.css",
      "src/index.css",
      "styles.css",
      "style.css",
      "css/styles.css",
    ]) {
      if (existsSync(path.join(appRoot, c))) files.add(path.join(appRoot, c));
    }
  }
  // Follow local @import chains one level deep.
  for (const file of [...files]) {
    const tokens = parseCssTokens(readIf(file) ?? "", file);
    for (const imp of tokens.imports) {
      if (!imp.startsWith(".")) continue;
      const resolved = path.resolve(path.dirname(file), imp);
      if (existsSync(resolved)) files.add(resolved);
    }
  }
  return [...files];
}

interface VarIndex {
  get(name: string, context: "root" | "dark"): CssVar | undefined;
  all: CssVar[];
}

function indexVars(tokens: CssTokens[]): VarIndex {
  const all = tokens.flatMap((t) => t.vars);
  const byContext = (ctx: string) => {
    const map = new Map<string, CssVar>();
    for (const v of all) if (v.context === ctx) map.set(v.name, v);
    return map;
  };
  const root = byContext("root");
  const dark = byContext("dark");
  const theme = byContext("theme");
  return {
    all,
    get(name, context) {
      if (context === "dark") return dark.get(name) ?? theme.get(name) ?? root.get(name);
      return root.get(name) ?? theme.get(name);
    },
  };
}

function relFile(appRoot: string, file: string): string {
  return toPosix(path.relative(appRoot, file));
}

function resolveColor(
  index: VarIndex,
  names: string[],
  context: "root" | "dark",
  appRoot: string,
): { hex: string; provenance: string } | null {
  for (const name of names) {
    const v = index.get(name, context);
    if (!v) continue;
    // Only accept dark values actually declared for dark (or theme refs to dark vars).
    const value = resolveVars(v.value, (n) => index.get(n, context)?.value);
    const hex = toHex(value);
    if (hex) {
      const original = v.value.trim() === value.trim() ? value.trim() : `${v.value.trim()} → ${value.trim()}`;
      return { hex, provenance: `css-var ${name} @ ${relFile(appRoot, v.file)}:${v.line} (${original})` };
    }
  }
  return null;
}

function emptyColors(): ColorSet {
  return {
    background: null,
    foreground: null,
    primary: null,
    primaryForeground: null,
    secondary: null,
    accent: null,
    muted: null,
    mutedForeground: null,
    border: null,
    ring: null,
    chart: [],
  };
}

function extractColors(
  index: VarIndex,
  context: "root" | "dark",
  appRoot: string,
  provenance: Record<string, string>,
  prefix: string,
): ColorSet {
  const colors = emptyColors();
  for (const [key, names] of Object.entries(COLOR_KEYS) as [Exclude<keyof ColorSet, "chart">, string[]][]) {
    const found = resolveColor(index, names, context, appRoot);
    if (found) {
      colors[key] = found.hex;
      provenance[`${prefix}.${key}`] = found.provenance;
    }
  }
  for (let i = 1; i <= 8; i++) {
    const found = resolveColor(index, [`--chart-${i}`, `--color-chart-${i}`], context, appRoot);
    if (!found) break;
    colors.chart.push(found.hex);
    provenance[`${prefix}.chart.${i - 1}`] = found.provenance;
  }
  return colors;
}

/** Tailwind v3 `tailwind.config.*`: theme(.extend).colors/fontFamily/borderRadius, read statically. */
function readTailwindV3(appRoot: string): {
  colors: Record<string, unknown>;
  fontFamily: Record<string, unknown>;
  borderRadius: Record<string, unknown>;
  file: string;
} | null {
  const file = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs", "tailwind.config.cjs"]
    .map((f) => path.join(appRoot, f))
    .find((f) => existsSync(f));
  if (!file) return null;
  const ast = parseModule(readFileSync(file, "utf8"), file);
  if (!ast) return null;
  const value = defaultExportValue(ast);
  if (!value || value === UNKNOWN || typeof value !== "object") return null;
  const theme = ((value as Record<string, unknown>).theme ?? {}) as Record<string, unknown>;
  const extend = (theme.extend ?? {}) as Record<string, unknown>;
  const pick = (key: string) =>
    ({
      ...((typeof theme[key] === "object" && theme[key]) || {}),
      ...((typeof extend[key] === "object" && extend[key]) || {}),
    }) as Record<string, unknown>;
  return { colors: pick("colors"), fontFamily: pick("fontFamily"), borderRadius: pick("borderRadius"), file };
}

function tailwindColor(
  colors: Record<string, unknown>,
  key: string,
  sub: string | null,
  index: VarIndex,
  context: "root" | "dark",
): string | null {
  const entry = colors[key];
  const raw =
    sub === null
      ? typeof entry === "string"
        ? entry
        : (entry as Record<string, unknown> | undefined)?.DEFAULT
      : (entry as Record<string, unknown> | undefined)?.[sub];
  if (typeof raw !== "string") return null;
  return toHex(resolveVars(raw, (n) => index.get(n, context)?.value).replace(/<alpha-value>/g, "1"));
}

interface FontFinding {
  family: string;
  variable: string | null;
  weights: number[];
  files: string[];
  source: string;
}

const GOOGLE_FONT_WEIGHTS = [400, 500, 600, 700];

function nextFontFindings(appRoot: string, layoutFile: string, ast: AnyNode): FontFinding[] {
  const findings: FontFinding[] = [];
  const req = createRequire(path.join(appRoot, "package.json"));
  for (const imp of moduleImports(ast)) {
    if (imp.source === "next/font/google") {
      for (const spec of imp.specifiers) {
        const family = spec.imported.replace(/_/g, " ");
        const call = callsTo(ast, spec.local)[0];
        const raw: unknown = call ? literalValue(call.arguments[0]) : {};
        const opts = (raw && raw !== UNKNOWN && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const weight = opts.weight;
        const weights = Array.isArray(weight)
          ? weight.map(Number).filter(Number.isFinite)
          : typeof weight === "string"
            ? [Number(weight)]
            : GOOGLE_FONT_WEIGHTS;
        findings.push({
          family,
          variable: typeof opts?.variable === "string" ? opts.variable : null,
          weights,
          files: [],
          source: `next/font/google ${spec.imported} @ ${relFile(appRoot, layoutFile)}`,
        });
      }
    } else if (imp.source === "next/font/local") {
      const local = imp.specifiers[0]?.local;
      if (!local) continue;
      walk(ast, (node) => {
        if (
          node.type !== "VariableDeclarator" ||
          node.init?.type !== "CallExpression" ||
          node.init.callee?.name !== local
        )
          return;
        const raw: unknown = literalValue(node.init.arguments[0]);
        if (!raw || raw === UNKNOWN || typeof raw !== "object") return;
        const opts = raw as Record<string, unknown>;
        const srcs = (Array.isArray(opts.src) ? opts.src : [{ path: opts.src, weight: opts.weight }]) as {
          path?: unknown;
          weight?: unknown;
        }[];
        const files = srcs
          .map((s) => (typeof s === "string" ? s : s.path))
          .filter((p): p is string => typeof p === "string")
          .map((p) => path.resolve(path.dirname(layoutFile), p))
          .filter((p) => existsSync(p));
        const first = files[0] ? path.basename(files[0]).replace(/\.(woff2?|ttf|otf)$/, "") : String(node.id.name);
        const base =
          first.replace(/(VF|Variable|-?Regular|-?Medium|-?Bold|-?Light|\d+)$/i, "").replace(/[-_]+$/, "") || first;
        const family = base.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
        findings.push({
          family,
          variable: typeof opts.variable === "string" ? opts.variable : null,
          weights: weightsFrom(opts.weight),
          files,
          source: `next/font/local ${node.id.name} @ ${relFile(appRoot, layoutFile)}`,
        });
      });
    } else if (imp.source === "geist/font/sans" || imp.source === "geist/font/mono") {
      const mono = imp.source.endsWith("mono");
      let files: string[] = [];
      try {
        const pkgDir = path.dirname(req.resolve("geist/package.json"));
        files = findFiles(
          path.join(pkgDir, "dist", "fonts"),
          mono ? /^GeistMono-Variable\.woff2$/ : /^Geist-Variable\.woff2$/,
        );
      } catch {
        /* geist not installed */
      }
      findings.push({
        family: mono ? "Geist Mono" : "Geist",
        variable: mono ? "--font-geist-mono" : "--font-geist-sans",
        weights: mono ? [400, 500] : [400, 500, 600, 700],
        files,
        source: `${imp.source} @ ${relFile(appRoot, layoutFile)}`,
      });
    }
  }
  return findings;
}

function weightsFrom(value: unknown): number[] {
  if (typeof value === "string") {
    const range = value.match(/^(\d+)\s+(\d+)$/);
    if (range) return GOOGLE_FONT_WEIGHTS.filter((w) => w >= Number(range[1]) && w <= Number(range[2]));
    return [Number(value)].filter(Number.isFinite);
  }
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  return GOOGLE_FONT_WEIGHTS;
}

function findFiles(dir: string, re: RegExp, depth = 3): string[] {
  const out: string[] = [];
  if (depth < 0 || !existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findFiles(full, re, depth - 1));
    else if (re.test(entry)) out.push(full);
  }
  return out;
}

function fontFileName(family: string, file: string, weights: number[]): string {
  const ext = path.extname(file);
  const variable = /variable|vf/i.test(path.basename(file));
  const weight = variable ? "variable" : String(weights[0] ?? 400);
  return `${slugify(family)}-${weight}${ext}`;
}

function familyFromStack(stack: string): string | null {
  const first = stack
    .split(",")[0]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  return first && !first.startsWith("var(") ? first : null;
}

function findLogos(
  appRoot: string,
  nextjs: NextjsDetection | null,
): { mark: string | null; wordmark: string | null; onDark: string | null } {
  const candidates: string[] = [];
  for (const dir of [nextjs?.appDir, "app", "src/app"].filter(Boolean) as string[]) {
    for (const f of ["icon.svg", "icon.png", "apple-icon.png", "apple-icon.svg"]) {
      const full = path.join(appRoot, dir, f);
      if (existsSync(full)) candidates.push(full);
    }
  }
  candidates.push(...findFiles(path.join(appRoot, "public"), /^(logo|brand|mark|wordmark)[^/]*\.(svg|png)$/i, 3));
  for (const f of ["public/favicon.svg", "public/favicon.png", "favicon.svg"])
    if (existsSync(path.join(appRoot, f))) candidates.push(path.join(appRoot, f));
  const uniq = [...new Set(candidates)];
  const svgFirst = (list: string[]) =>
    list.sort((a, b) => Number(b.endsWith(".svg")) - Number(a.endsWith(".svg")))[0] ?? null;
  const isDark = (f: string) => /(dark|white|inverse|on-dark)/i.test(path.basename(f));
  const isMark = (f: string) =>
    /(mark|icon|symbol|glyph)/i.test(path.basename(f)) && !/wordmark/i.test(path.basename(f));
  const wordmark = svgFirst(
    uniq.filter((f) => !isDark(f) && !isMark(f) && /(logo|wordmark|brand)/i.test(path.basename(f))),
  );
  const mark =
    svgFirst(uniq.filter((f) => !isDark(f) && isMark(f) && /^(logo|brand|mark)/i.test(path.basename(f)))) ??
    svgFirst(uniq.filter((f) => !isDark(f) && isMark(f)));
  const onDark = svgFirst(uniq.filter(isDark));
  return { mark, wordmark: wordmark ?? null, onDark };
}

function layoutMetadata(ast: AnyNode | null): StaticBrandResult["metadata"] {
  const empty = { title: null, description: null, ogTitle: null, ogDescription: null, ogImage: null, url: null };
  if (!ast) return empty;
  const node = exportedConst(ast, "metadata");
  const value = node ? literalValue(node) : UNKNOWN;
  if (!value || value === UNKNOWN || typeof value !== "object") return empty;
  const m = value as Record<string, any>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const title = str(m.title) ?? str(m.title?.default) ?? str(m.title?.absolute);
  const images = m.openGraph?.images;
  const ogImage = str(images) ?? (Array.isArray(images) ? (str(images[0]) ?? str(images[0]?.url)) : str(images?.url));
  return {
    title,
    description: str(m.description),
    ogTitle: str(m.openGraph?.title),
    ogDescription: str(m.openGraph?.description),
    ogImage,
    url: str(m.metadataBase),
  };
}

export interface StaticBrandOptions {
  appRoot: string;
  nextjs: NextjsDetection | null;
  packageJson: PackageJson | null;
  productName: string;
}

/** Static brand extraction from source (SPEC §8.3). Never executes project code. */
export function extractStaticBrand(options: StaticBrandOptions): StaticBrandResult {
  const { appRoot, nextjs, packageJson } = options;
  const provenance: Record<string, string> = {};
  const warnings: string[] = [];
  const copies: FileCopy[] = [];

  const layoutFile = findRootLayout(appRoot, nextjs);
  const layoutAst = layoutFile ? parseModule(readFileSync(layoutFile, "utf8"), layoutFile) : null;
  const cssFiles = collectCssFiles(appRoot, layoutFile, layoutAst);
  const tokens = cssFiles.map((f) => parseCssTokens(readFileSync(f, "utf8"), f));
  const index = indexVars(tokens);

  const light = extractColors(index, "root", appRoot, provenance, "colors.light");
  const hasDark = index.all.some((v) => v.context === "dark");
  const dark = hasDark ? extractColors(index, "dark", appRoot, provenance, "colors.dark") : null;

  // Tailwind v3 config fills what CSS variables didn't.
  const tw = readTailwindV3(appRoot);
  if (tw) {
    const fill = (set: ColorSet | null, ctx: "root" | "dark", prefix: string) => {
      if (!set) return;
      const map: [keyof Omit<ColorSet, "chart">, string, string | null][] = [
        ["primary", "primary", null],
        ["primaryForeground", "primary", "foreground"],
        ["background", "background", null],
        ["foreground", "foreground", null],
        ["secondary", "secondary", null],
        ["accent", "accent", null],
        ["muted", "muted", null],
        ["mutedForeground", "muted", "foreground"],
        ["border", "border", null],
        ["ring", "ring", null],
      ];
      for (const [key, twKey, sub] of map) {
        if (set[key]) continue;
        const hex = tailwindColor(tw.colors, twKey, sub, index, ctx);
        if (hex) {
          set[key] = hex;
          provenance[`${prefix}.${key}`] =
            `tailwind theme.colors.${twKey}${sub ? `.${sub}` : ""} @ ${relFile(appRoot, tw.file)}`;
        }
      }
    };
    fill(light, "root", "colors.light");
    fill(dark, "dark", "colors.dark");
  }

  // Fonts
  const fonts: { heading: FontSpec | null; body: FontSpec | null; mono: FontSpec | null } = {
    heading: null,
    body: null,
    mono: null,
  };
  const findings = layoutFile && layoutAst ? nextFontFindings(appRoot, layoutFile, layoutAst) : [];
  for (const t of tokens) {
    for (const face of t.fontFaces) {
      const files = face.src
        .filter((s) => !/^(https?:|data:)/.test(s))
        .map((s) => path.resolve(path.dirname(face.file), s))
        .filter((s) => existsSync(s));
      findings.push({
        family: face.family,
        variable: null,
        weights: weightsFrom(face.weight ?? "400"),
        files,
        source: `@font-face @ ${relFile(appRoot, face.file)}`,
      });
    }
  }
  const themeFont = (role: string) => {
    for (const name of [`--font-${role}`]) {
      const v = index.get(name, "root");
      if (!v) continue;
      const resolved = v.value;
      const viaVar = resolved.match(/var\((--[\w-]+)/)?.[1];
      if (viaVar) {
        const f = findings.find((x) => x.variable === viaVar);
        if (f) return f;
      }
      const fam = familyFromStack(resolveVars(resolved, (n) => index.get(n, "root")?.value));
      if (fam)
        return (
          findings.find((x) => x.family.toLowerCase() === fam.toLowerCase()) ?? {
            family: fam,
            variable: null,
            weights: [400],
            files: [],
            source: `css-var ${name}`,
          }
        );
    }
    return undefined;
  };
  if (tw) {
    for (const [role, stack] of Object.entries(tw.fontFamily)) {
      const fam = Array.isArray(stack)
        ? typeof stack[0] === "string"
          ? familyFromStack(stack[0])
          : null
        : typeof stack === "string"
          ? familyFromStack(stack)
          : null;
      if (fam && !findings.some((f) => f.family === fam))
        findings.push({
          family: fam,
          variable: null,
          weights: [400, 600],
          files: [],
          source: `tailwind theme.fontFamily.${role}`,
        });
    }
  }
  const mono = themeFont("mono") ?? findings.find((f) => /mono|code/i.test(f.family) || /mono/i.test(f.variable ?? ""));
  const body = themeFont("sans") ?? themeFont("body") ?? findings.find((f) => f !== mono && !/mono/i.test(f.family));
  const heading = themeFont("heading") ?? themeFont("display") ?? body;
  const toSpec = (f: FontFinding | undefined, role: string): FontSpec | null => {
    if (!f) return null;
    const files = f.files.map((file) => {
      const dest = `brand/fonts/${fontFileName(f.family, file, f.weights)}`;
      if (!copies.some((c) => c.to === dest)) copies.push({ from: file, to: dest });
      return dest;
    });
    provenance[`fonts.${role}`] = f.source;
    return { family: f.family, weights: [...new Set(f.weights)].sort((a, b) => a - b), files };
  };
  fonts.heading = toSpec(heading, "heading");
  fonts.body = toSpec(body, "body");
  fonts.mono = toSpec(mono, "mono");

  // Radius
  const radius = { sm: null as string | null, md: null as string | null, lg: null as string | null };
  const radiusVar = (name: string) => {
    const v = index.get(name, "root");
    if (!v) return null;
    const px = lengthToPx(resolveVars(v.value, (n) => index.get(n, "root")?.value));
    return px === null ? null : `${Math.round(px * 100) / 100}px`;
  };
  radius.sm = radiusVar("--radius-sm");
  radius.md = radiusVar("--radius-md");
  radius.lg = radiusVar("--radius-lg");
  const base = radiusVar("--radius");
  if (base && !radius.lg) {
    const px = Number.parseFloat(base);
    radius.lg = `${px}px`;
    radius.md = radius.md ?? `${Math.max(0, px - 2)}px`;
    radius.sm = radius.sm ?? `${Math.max(0, px - 4)}px`;
    provenance.radius = `css-var --radius (${base}) with shadcn steps`;
  } else if (radius.lg) {
    provenance.radius = "css-var --radius-sm/md/lg";
  }
  if (tw && !radius.lg) {
    const r = (k: string) => {
      const raw = tw.borderRadius[k];
      if (typeof raw !== "string") return null;
      const px = lengthToPx(resolveVars(raw, (n) => index.get(n, "root")?.value));
      return px === null ? null : `${px}px`;
    };
    radius.sm = r("sm");
    radius.md = r("md");
    radius.lg = r("lg");
    if (radius.lg) provenance.radius = `tailwind theme.borderRadius @ ${relFile(appRoot, tw.file)}`;
  }

  // Logos
  const logos = findLogos(appRoot, nextjs);
  const logo = { mark: null as string | null, wordmark: null as string | null, onDark: null as string | null };
  for (const [key, file] of Object.entries(logos) as [keyof typeof logo, string | null][]) {
    if (!file) continue;
    const ext = path.extname(file);
    const dest = `brand/${key === "mark" ? "logo-mark" : key === "wordmark" ? "logo" : "logo-on-dark"}${ext}`;
    copies.push({ from: file, to: dest });
    logo[key] = dest;
    provenance[`logo.${key}`] = relFile(appRoot, file);
  }

  const metadata = layoutMetadata(layoutAst);
  if (!metadata.url && packageJson?.homepage) metadata.url = packageJson.homepage;
  if (metadata.title) provenance.name = `metadata.title @ ${layoutFile ? relFile(appRoot, layoutFile) : "?"}`;

  for (const key of ["background", "foreground", "primary"] as const) {
    if (!light[key]) warnings.push(`colors.light.${key} not found in CSS variables or tailwind config`);
  }
  if (!fonts.body) warnings.push("no brand font found; Inter/Geist fallbacks will be used");
  if (!logo.mark && !logo.wordmark)
    warnings.push("no logo found (looked for app/icon.*, public/**/logo*, public/**/mark*)");

  const brand: Brand = {
    name: options.productName,
    tagline: metadata.description,
    url: metadata.url,
    colors: { light, dark },
    fonts,
    radius,
    shadows: [],
    logo,
    og: {
      image: metadata.ogImage,
      title: metadata.ogTitle ?? metadata.title,
      description: metadata.ogDescription ?? metadata.description,
    },
    provenance,
    warnings,
  };
  return { brand, copies, metadata, cssFiles: cssFiles.map((f) => relFile(appRoot, f)) };
}
