import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const cliPkg = JSON.parse(readFileSync(new URL("./packages/cli/package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  define: { __DEMOVIE_VERSION__: JSON.stringify(cliPkg.version) },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["packages/*/test/**/*.test.ts", "scripts/test/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "**/node_modules/**", "**/fixtures/**"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["packages/*/test/**/*.int.test.ts"],
          exclude: ["**/node_modules/**", "**/fixtures/**"],
          testTimeout: 300_000,
          hookTimeout: 600_000,
          fileParallelism: false,
          globalSetup: ["./scripts/test/integration-setup.ts"],
        },
      },
    ],
  },
});
