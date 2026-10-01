/**
 * Builds the browser runtime:
 *  - dist/runtime.js   ESM for npm consumers (imports the bare `gsap` specifier)
 *  - dist/served/…     the files the renderer serves at /__demovie/* (GSAP imported from /__demovie/gsap/)
 */
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(root, "src/index.ts")],
  outfile: path.join(dist, "runtime.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  external: ["gsap"],
  logLevel: "warning",
});
