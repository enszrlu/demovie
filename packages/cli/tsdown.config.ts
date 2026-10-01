import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  platform: "node",
  target: "node20.19",
  outDir: "dist",
  clean: true,
  dts: false,
  fixedExtension: false,
  define: { __DEMOVIE_VERSION__: JSON.stringify(pkg.version) },
  // Workspace packages are private and get bundled; every third-party package stays an npm dependency.
  deps: { onlyBundle: [/^@demovie\//] },
});
