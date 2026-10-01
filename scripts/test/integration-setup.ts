/**
 * Global setup for integration tests: prepares shared fixtures once per run.
 * Individual suites start the apps they need through the helpers in scripts/test/harborly.ts.
 */
export default async function setup(): Promise<() => Promise<void>> {
  return async () => {};
}
