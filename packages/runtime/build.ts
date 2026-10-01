/**
 * Builds the browser runtime:
 *  - dist/runtime.js, dist/clock.js, dist/runtime.css, dist/styles/*  for npm consumers (`gsap` stays a bare import)
 *  - dist/served/…  what the renderer serves at /__demovie/* (GSAP imported from /__demovie/gsap/index.js)
 */
import { cpSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const served = path.join(dist, "served");
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(served, "styles"), { recursive: true });

const servedGsap: Plugin = {
  name: "served-gsap",
  setup(b) {
    b.onResolve({ filter: /^gsap$/ }, () => ({ path: "/__demovie/gsap/index.js", external: true }));
  },
};

const common = {
  bundle: true,
  platform: "browser" as const,
  target: "chrome120",
  logLevel: "warning" as const,
  legalComments: "none" as const,
};

await Promise.all([
  build({
    ...common,
    entryPoints: [path.join(root, "src/index.ts")],
    outfile: path.join(dist, "runtime.js"),
    format: "esm",
    external: ["gsap"],
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "src/index.ts")],
    outfile: path.join(served, "runtime.js"),
    format: "esm",
    plugins: [servedGsap],
    minify: true,
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "src/clock.ts")],
    outfile: path.join(dist, "clock.js"),
    format: "iife",
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "src/clock.ts")],
    outfile: path.join(served, "clock.js"),
    format: "iife",
    minify: true,
  }),
]);

cpSync(path.join(root, "styles", "runtime.css"), path.join(dist, "runtime.css"));
cpSync(path.join(root, "styles", "runtime.css"), path.join(served, "runtime.css"));
for (const style of ["clean", "bold", "soft", "editorial", "terminal"]) {
  cpSync(path.join(root, "styles", `${style}.css`), path.join(dist, "styles", `${style}.css`));
  cpSync(path.join(root, "styles", `${style}.css`), path.join(served, "styles", `${style}.css`));
}

// SPEC §10: runtime under 60 KB min+gz, excluding GSAP.
const size =
  gzipSync(readFileSync(path.join(served, "runtime.js"))).length +
  gzipSync(readFileSync(path.join(served, "clock.js"))).length;
const kb = size / 1024;
process.stdout.write(
  `runtime: ${(statSync(path.join(served, "runtime.js")).size / 1024).toFixed(1)} KB min, ${kb.toFixed(1)} KB min+gz (budget 60 KB)\n`,
);
if (kb > 60) {
  process.stderr.write("runtime exceeds the 60 KB min+gz budget\n");
  process.exit(1);
}
