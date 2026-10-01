import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectProject } from "../src/detect/framework.ts";
import { extractStaticBrand } from "../src/extract/brand-static.ts";
import { lengthToPx, parseCssTokens, resolveVars } from "../src/extract/css.ts";
import { contrastRatio, parseColor, toHex } from "../src/util/color.ts";

const fixtures = path.join(import.meta.dirname, "fixtures");
const examples = path.join(import.meta.dirname, "../../../examples");

function brandOf(dir: string) {
  const d = detectProject(dir);
  return extractStaticBrand({ appRoot: d.appRoot, nextjs: d.nextjs, packageJson: d.packageJson, productName: d.name });
}

describe("color normalization", () => {
  it("converts CSS colors to sRGB hex", () => {
    expect(toHex("oklch(0.546 0.245 262.881)")).toBe("#155dfc"); // Tailwind v4 blue-600
    expect(toHex("oklch(0.623 0.214 259.815)")).toBe("#2b7fff"); // Tailwind v4 blue-500
    expect(toHex("oklch(1 0 0 / 10%)")).toBe("#ffffff1a");
    expect(toHex("222.2 84% 4.9%")).toBe("#020817"); // shadcn HSL triplet
    expect(toHex("hsl(221.2 83.2% 53.3%)")).toBe("#2563eb");
    expect(toHex("rgb(37, 99, 235)")).toBe("#2563eb");
    expect(toHex("#ABC")).toBe("#aabbcc");
    expect(toHex("lab(54.29% 80.8 69.89)")).toBe("#ff0000"); // CSS lab() is D50
    expect(toHex("color(srgb 1 0 0)")).toBe("#ff0000");
    expect(toHex("var(--x)")).toBeNull();
    expect(toHex("not-a-color")).toBeNull();
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio(parseColor("#000")!, parseColor("#fff")!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseColor("#767676")!, parseColor("#fff")!)).toBeCloseTo(4.54, 1);
  });
});

describe("css tokens", () => {
  it("reads contexts, line numbers and var chains", () => {
    const css =
      ":root {\n  --a: #fff;\n  --b: var(--a);\n}\n.dark {\n  --a: #000;\n}\n@theme inline {\n  --color-a: var(--a);\n}\n";
    const t = parseCssTokens(css, "x.css");
    expect(t.vars.map((v) => [v.name, v.context, v.line])).toEqual([
      ["--a", "root", 2],
      ["--b", "root", 3],
      ["--a", "dark", 6],
      ["--color-a", "theme", 9],
    ]);
    expect(resolveVars("var(--b)", (n) => t.vars.find((v) => v.name === n && v.context === "root")?.value)).toBe(
      "#fff",
    );
    expect(resolveVars("var(--missing, red)", () => undefined)).toBe("red");
    expect(lengthToPx("0.5rem")).toBe(8);
    expect(lengthToPx("calc(0.625rem - 4px)")).toBe(6);
  });
});

describe("static brand extraction", () => {
  it("reads oklch tokens, dark mode, next/font/google families, radius and metadata", () => {
    const { brand } = brandOf(path.join(fixtures, "oklch-tokens"));
    expect(brand.name).toBe("Tokenly");
    expect(brand.tagline).toBe("Design tokens that ship.");
    expect(brand.url).toBe("https://tokenly.example");
    expect(brand.colors.light).toMatchObject({
      background: "#ffffff",
      foreground: "#0a0a0a",
      primary: "#155dfc",
      primaryForeground: "#fafafa",
    });
    expect(brand.colors.light.chart).toEqual(["#f54900", "#009689"]);
    expect(brand.colors.dark?.primary).toBe("#2b7fff");
    expect(brand.colors.dark?.border).toBe("#ffffff1a");
    expect(brand.fonts.body?.family).toBe("Inter");
    expect(brand.fonts.body?.weights).toEqual([400, 500, 700]);
    expect(brand.fonts.mono?.family).toBe("JetBrains Mono");
    expect(brand.radius).toEqual({ sm: "6px", md: "8px", lg: "10px" });
    expect(brand.provenance["colors.light.primary"]).toMatch(/^css-var --primary @ app\/globals\.css:9 \(oklch/);
  });

  it("copies local fonts and logos", () => {
    const { brand, copies } = brandOf(path.join(fixtures, "local-fonts"));
    expect(brand.colors.light).toMatchObject({ background: "#fafafa", foreground: "#020817", primary: "#7c3aed" });
    expect(brand.fonts.body).toMatchObject({ family: "Brand Sans", files: ["brand/fonts/brand-sans-variable.woff2"] });
    expect(brand.fonts.heading).toMatchObject({
      family: "Brand Display",
      weights: [700],
      files: ["brand/fonts/brand-display-700.woff2"],
    });
    expect(brand.logo).toEqual({ mark: "brand/logo-mark.svg", wordmark: null, onDark: "brand/logo-on-dark.svg" });
    expect(copies.map((c) => c.to).sort()).toEqual(
      [
        "brand/fonts/brand-display-700.woff2",
        "brand/fonts/brand-sans-variable.woff2",
        "brand/logo-mark.svg",
        "brand/logo-on-dark.svg",
      ].sort(),
    );
  });

  it("reads a Tailwind v3 config with hsl(var()) colors (pages-minimal)", () => {
    const { brand } = brandOf(path.join(examples, "pages-minimal"));
    expect(brand.colors.light).toMatchObject({
      background: "#ffffff",
      foreground: "#020817",
      primary: "#10b77f",
      primaryForeground: "#ffffff",
    });
    expect(brand.fonts.body?.family).toBe("Inter");
    expect(brand.fonts.mono?.family).toBe("JetBrains Mono");
    expect(brand.radius).toEqual({ sm: "8px", md: "10px", lg: "12px" });
    expect(brand.logo.wordmark).toBe("brand/logo.svg");
  });
});
