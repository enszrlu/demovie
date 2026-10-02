/**
 * `import { defineFlow } from "demovie/flow"` in `.demovie/flows/<name>.flow.ts`: types a TypeScript flow for the
 * editor. `demovie capture` and `flow run` load flows without it (the import is shimmed), so installing demovie in the
 * project is optional. Mirrors TsFlowDefinition in packages/capture (packages/cli/test/flow-types.test.ts keeps them
 * in sync).
 */
import type { Locator, Page } from "playwright-core";

export interface FlowDefinition {
  /** The flow's name: captures are written to `flows/<name>@<viewport>/<state>`. */
  name: string;
  /** The route the flow starts on, e.g. "/app/projects". */
  start: string;
  /** A viewport from `capture.viewports` (default: the first default viewport). */
  viewport?: string;
  /** Allow steps whose target looks destructive (delete, sign out, billing…). */
  allowDestructive?: boolean;
  description?: string;
  run: (helpers: {
    page: Page;
    /** Capture the page as it is now, as a named state. */
    capture: (name: string, options?: { fullPage?: boolean }) => Promise<void>;
    /** A recorded interaction on a target (checked against the destructive-target guard). */
    step: (
      action: string,
      target: Locator,
      perform: (target: Locator) => Promise<unknown>,
      value?: string,
    ) => Promise<void>;
  }) => Promise<void>;
}

export function defineFlow(flow: FlowDefinition): FlowDefinition {
  return flow;
}
