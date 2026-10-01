/**
 * Minimal CSS reader for design tokens: custom properties per context, @font-face rules and @import.
 * It is not a full CSS parser; it walks braces and keeps selector/at-rule context.
 */

export type VarContext = "root" | "dark" | "theme";

export interface CssVar {
  name: string;
  value: string;
  context: VarContext;
  file: string;
  line: number;
}

export interface FontFace {
  family: string;
  src: string[];
  weight: string | null;
  style: string | null;
  file: string;
}

export interface CssTokens {
  vars: CssVar[];
  fontFaces: FontFace[];
  imports: string[];
}

function stripComments(css: string): string {
  // Keep newlines so line numbers stay correct.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function contextFor(stack: string[]): VarContext | null {
  const joined = stack.join(" ").replace(/\s+/g, " ").trim();
  if (/@theme\b/.test(joined)) return "theme";
  if (/\.dark\b|\[data-theme=["']?dark["']?\]|\[data-mode=["']?dark["']?\]|prefers-color-scheme:\s*dark/.test(joined))
    return "dark";
  const last = stack[stack.length - 1] ?? "";
  if (/(^|,|\s):root\b|(^|,|\s)html\b|:host\b|(^|,|\s)body\b|\[data-theme=["']?light["']?\]|\.light\b/.test(last))
    return "root";
  return null;
}

export function parseCssTokens(css: string, file: string): CssTokens {
  const src = stripComments(css);
  const vars: CssVar[] = [];
  const fontFaces: FontFace[] = [];
  const imports: string[] = [];
  const stack: string[] = [];
  let buffer = "";
  let bufferStart = 0;
  let line = 1;

  const flushDeclarations = (text: string, startLine: number) => {
    const ctx = contextFor(stack);
    const inFontFace = stack[stack.length - 1]?.trim().startsWith("@font-face");
    let offsetLine = startLine;
    const face: Record<string, string> = {};
    for (const decl of text.split(";")) {
      const lineOfDecl = offsetLine + (decl.match(/^\s*/)?.[0].split("\n").length ?? 1) - 1;
      offsetLine += decl.split("\n").length - 1;
      const m = decl.match(/^\s*(--[\w-]+|[a-z-]+)\s*:\s*([\s\S]+?)\s*$/i);
      if (!m) continue;
      const [, prop, value] = m as unknown as [string, string, string];
      if (inFontFace) face[prop.toLowerCase()] = value;
      else if (prop.startsWith("--") && ctx)
        vars.push({ name: prop, value: value.replace(/\s*!important$/, ""), context: ctx, file, line: lineOfDecl });
    }
    if (inFontFace && face["font-family"]) {
      fontFaces.push({
        family: face["font-family"].replace(/^["']|["']$/g, ""),
        src: [...(face.src ?? "").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((x) => x[1]!),
        weight: face["font-weight"] ?? null,
        style: face["font-style"] ?? null,
        file,
      });
    }
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (ch === "{") {
      flushDeclarations(buffer.slice(0, Math.max(0, buffer.lastIndexOf(";") + 1)), bufferStart);
      const selector = buffer.slice(buffer.lastIndexOf(";") + 1).trim();
      stack.push(selector);
      buffer = "";
      bufferStart = line;
    } else if (ch === "}") {
      flushDeclarations(buffer, bufferStart);
      stack.pop();
      buffer = "";
      bufferStart = line;
    } else if (ch === ";" && stack.length === 0) {
      const statement = buffer.trim();
      const imp = statement.match(/^@import\s+(?:url\()?["']([^"']+)["']/);
      if (imp) imports.push(imp[1]!);
      buffer = "";
      bufferStart = line;
    } else {
      if (buffer === "") bufferStart = line;
      buffer += ch;
    }
    if (ch === "\n") line++;
  }
  return { vars, fontFaces, imports };
}

/** Resolve `var(--x, fallback)` chains against a lookup. Unresolvable vars keep their fallback or stay as-is. */
export function resolveVars(value: string, lookup: (name: string) => string | undefined, depth = 0): string {
  if (depth > 10 || !value.includes("var(")) return value;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf("var(", i);
    if (start < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);
    let depthParen = 0;
    let end = start + 3;
    for (; end < value.length; end++) {
      if (value[end] === "(") depthParen++;
      else if (value[end] === ")" && --depthParen === 0) break;
    }
    const inner = value.slice(start + 4, end);
    const comma = inner.indexOf(",");
    const name = (comma >= 0 ? inner.slice(0, comma) : inner).trim();
    const fallback = comma >= 0 ? inner.slice(comma + 1).trim() : undefined;
    const resolved = lookup(name) ?? fallback;
    out += resolved === undefined ? value.slice(start, end + 1) : resolveVars(resolved, lookup, depth + 1);
    i = end + 1;
  }
  return out;
}

/** Evaluate a CSS length (px, rem, simple calc) to px. Returns null when unknown. */
export function lengthToPx(value: string, rootFontSize = 16): number | null {
  const v = value.trim();
  const calc = v.match(/^calc\((.*)\)$/s);
  if (calc) {
    const tokens = calc[1]!.split(/\s+([+-])\s+/);
    let total = lengthToPx(tokens[0]!, rootFontSize);
    for (let i = 1; i < tokens.length && total !== null; i += 2) {
      const next = lengthToPx(tokens[i + 1]!, rootFontSize);
      if (next === null) return null;
      total = tokens[i] === "+" ? total + next : total - next;
    }
    return total;
  }
  const m = v.match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "rem" || m[2] === "em" ? n * rootFontSize : n;
}
