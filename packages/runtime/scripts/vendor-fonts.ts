/** Copies the OFL fallback fonts and their licenses from npm packages into packages/runtime/fonts. */
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const inter = path.dirname(require.resolve("@fontsource-variable/inter/package.json"));
const geist = path.dirname(require.resolve("geist/package.json"));
const fonts = path.join(root, "fonts");
const copies: [string, string][] = [
  [path.join(inter, "files", "inter-latin-wght-normal.woff2"), "inter-variable.woff2"],
  [path.join(inter, "LICENSE"), "OFL-Inter.txt"],
  [path.join(geist, "dist", "fonts", "geist-sans", "Geist-Variable.woff2"), "geist-variable.woff2"],
  [path.join(geist, "dist", "fonts", "geist-mono", "GeistMono-Variable.woff2"), "geist-mono-variable.woff2"],
  [path.join(geist, "LICENSE.txt"), "OFL-Geist.txt"],
];
for (const [from, to] of copies) copyFileSync(from, path.join(fonts, to));
process.stdout.write(`vendored ${copies.length} files into ${path.relative(process.cwd(), fonts)}\n`);
