/**
 * Global setup for integration tests: seed and start (or reuse) the Harborly dev server once per run.
 */
import type { TestProject } from "vitest/node";
import { ensureHarborly } from "./harborly.ts";

declare module "vitest" {
  export interface ProvidedContext {
    harborlyUrl: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const harborly = await ensureHarborly();
  project.provide("harborlyUrl", harborly.url);
  return async () => {
    await harborly.stop();
  };
}
