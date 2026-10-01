/**
 * CSS color parsing and normalization to sRGB hex (SPEC §6.2: "All colors are normalized to sRGB hex").
 * Supports hex, rgb(a), hsl(a), bare shadcn HSL triplets ("222.2 84% 4.9%"), oklch, oklab, lab, lch,
 * color(srgb …) and common named colors.
 */

export interface Rgba {
  r: number; // 0–255
  g: number;
  b: number;
  a: number; // 0–1
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  navy: "#000080",
  teal: "#008080",
  orange: "#ffa500",
  purple: "#800080",
  yellow: "#ffff00",
  transparent: "#00000000",
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function parseNumber(token: string, percentScale = 1): number | null {
  const t = token.trim();
  if (t === "none") return 0;
  const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|turn|grad)?$/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "%") return (value / 100) * percentScale;
  if (unit === "rad") return (value * 180) / Math.PI;
  if (unit === "turn") return value * 360;
  if (unit === "grad") return value * 0.9;
  return value;
}

function splitArgs(inner: string): { parts: string[]; alpha: string | null } {
  const [main, alphaPart] = inner.includes("/") ? inner.split("/") : [inner, null];
  const parts = main!
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (alphaPart === null && parts.length === 4) return { parts: parts.slice(0, 3), alpha: parts[3]! };
  return { parts, alpha: alphaPart === null ? null : alphaPart.trim() };
}

function alphaOf(token: string | null): number {
  if (token === null) return 1;
  const v = parseNumber(token, 1);
  return v === null ? 1 : clamp(v, 0, 1);
}

const srgbEncode = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const srgbDecode = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function linearToRgba(lr: number, lg: number, lb: number, a: number): Rgba {
  return {
    r: Math.round(clamp(srgbEncode(lr), 0, 1) * 255),
    g: Math.round(clamp(srgbEncode(lg), 0, 1) * 255),
    b: Math.round(clamp(srgbEncode(lb), 0, 1) * 255),
    a,
  };
}

function oklabToRgba(L: number, A: number, B: number, alpha: number): Rgba {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return linearToRgba(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    alpha,
  );
}

function labToRgba(L: number, a: number, b: number, alpha: number): Rgba {
  // CIE Lab (D50) → XYZ (D50) → XYZ (D65, Bradford) → linear sRGB
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const e = 216 / 24389;
  const k = 24389 / 27;
  const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const yr = L > k * e ? ((L + 16) / 116) ** 3 : L / k;
  const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  const X = (xr * 0.3457) / 0.3585;
  const Y = yr;
  const Z = (zr * (1 - 0.3457 - 0.3585)) / 0.3585;
  const X65 = 0.9554734527042182 * X - 0.023098536874261423 * Y + 0.0632593086610217 * Z;
  const Y65 = -0.028369706963208136 * X + 1.0099954580058226 * Y + 0.021041398966943008 * Z;
  const Z65 = 0.012314001688319899 * X - 0.020507696433477912 * Y + 1.3303659366080753 * Z;
  return linearToRgba(
    3.2409699419045226 * X65 - 1.537383177570094 * Y65 - 0.4986107602930034 * Z65,
    -0.9692436362808796 * X65 + 1.8759675015077202 * Y65 + 0.04155505740717559 * Z65,
    0.05563007969699366 * X65 - 0.20397695888897652 * Y65 + 1.0569715142428786 * Z65,
    alpha,
  );
}

function hslToRgba(h: number, s: number, l: number, a: number): Rgba {
  const hue = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a };
}

/** Parse any supported CSS color. Returns null for unsupported or non-literal values (e.g. var()). */
export function parseColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  if (!value || value.includes("var(")) return null;
  if (NAMED[value]) return parseColor(NAMED[value]!);
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    const expand = hex.length === 3 || hex.length === 4 ? [...hex].map((c) => c + c).join("") : hex;
    if (expand.length !== 6 && expand.length !== 8) return null;
    const n = (i: number) => Number.parseInt(expand.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: expand.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = value.match(/^([a-z-]+)\((.*)\)$/s);
  if (!fn) {
    // Bare shadcn HSL triplet: "222.2 84% 4.9%" (optionally "/ 50%").
    const bare = value.match(/^([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?$/);
    if (bare) return hslToRgba(Number(bare[1]), Number(bare[2]) / 100, Number(bare[3]) / 100, alphaOf(bare[4] ?? null));
    return null;
  }
  const name = fn[1]!;
  // color(<space> c1 c2 c3 [/ a]) has four positional tokens, so the legacy "4th token is alpha" rule doesn't apply.
  const { parts, alpha } =
    name === "color"
      ? {
          parts: fn[2]!.split("/")[0]!.trim().split(/\s+/),
          alpha: fn[2]!.includes("/") ? fn[2]!.split("/")[1]!.trim() : null,
        }
      : splitArgs(fn[2]!);
  const a = alphaOf(alpha);
  if (name === "rgb" || name === "rgba") {
    if (parts.length < 3) return null;
    const ch = parts.slice(0, 3).map((p) => parseNumber(p, 255));
    if (ch.some((c) => c === null)) return null;
    const [r, g, b] = ch as number[];
    return { r: Math.round(clamp(r!, 0, 255)), g: Math.round(clamp(g!, 0, 255)), b: Math.round(clamp(b!, 0, 255)), a };
  }
  if (name === "hsl" || name === "hsla") {
    if (parts.length < 3) return null;
    const h = parseNumber(parts[0]!);
    const s = parseNumber(parts[1]!.endsWith("%") ? parts[1]! : `${parts[1]}%`, 1);
    const l = parseNumber(parts[2]!.endsWith("%") ? parts[2]! : `${parts[2]}%`, 1);
    if (h === null || s === null || l === null) return null;
    return hslToRgba(h, s, l, a);
  }
  if (name === "oklch" || name === "oklab" || name === "lab" || name === "lch") {
    if (parts.length < 3) return null;
    const isOk = name.startsWith("ok");
    const L = parseNumber(parts[0]!, isOk ? 1 : 100);
    const p1 = parseNumber(parts[1]!, isOk ? (name === "oklch" ? 0.4 : 0.4) : name === "lch" ? 150 : 125);
    const p2 = parseNumber(parts[2]!, isOk ? 0.4 : 125);
    if (L === null || p1 === null || p2 === null) return null;
    if (name === "oklab") return oklabToRgba(L, p1, p2, a);
    if (name === "lab") return labToRgba(L, p1, p2, a);
    const rad = (p2 * Math.PI) / 180;
    if (name === "oklch") return oklabToRgba(L, p1 * Math.cos(rad), p1 * Math.sin(rad), a);
    return labToRgba(L, p1 * Math.cos(rad), p1 * Math.sin(rad), a);
  }
  if (name === "color") {
    const [space, ...rest] = parts;
    if ((space === "srgb" || space === "srgb-linear") && rest.length >= 3) {
      const ch = rest.slice(0, 3).map((p) => parseNumber(p, 1));
      if (ch.some((c) => c === null)) return null;
      const [r, g, b] = ch as number[];
      if (space === "srgb-linear") return linearToRgba(r!, g!, b!, a);
      return {
        r: Math.round(clamp(r!, 0, 1) * 255),
        g: Math.round(clamp(g!, 0, 1) * 255),
        b: Math.round(clamp(b!, 0, 1) * 255),
        a,
      };
    }
    return null;
  }
  return null;
}

const hex2 = (n: number): string =>
  Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, "0");

export function rgbaToHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return c.a >= 0.999 ? base : `${base}${hex2(c.a * 255)}`;
}

/** Normalize a CSS color to lowercase sRGB hex (#rrggbb, or #rrggbbaa when translucent). */
export function toHex(input: string): string | null {
  const parsed = parseColor(input);
  return parsed ? rgbaToHex(parsed) : null;
}

/** WCAG relative luminance of an sRGB color. */
export function relativeLuminance(c: Pick<Rgba, "r" | "g" | "b">): number {
  return 0.2126 * srgbDecode(c.r / 255) + 0.7152 * srgbDecode(c.g / 255) + 0.0722 * srgbDecode(c.b / 255);
}

/** WCAG 2.x contrast ratio between two opaque colors. */
export function contrastRatio(a: Pick<Rgba, "r" | "g" | "b">, b: Pick<Rgba, "r" | "g" | "b">): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite a translucent color over an opaque background. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}
