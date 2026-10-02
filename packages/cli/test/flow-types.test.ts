import type { TsFlowDefinition } from "@demovie/capture";
import { describe, expect, it } from "vitest";
import { defineFlow, type FlowDefinition } from "../src/flow.ts";

// Compile-time: the published `demovie/flow` type and the capture package's flow type stay interchangeable.
const toCapture = (f: FlowDefinition): TsFlowDefinition => f;
const toPublic = (f: TsFlowDefinition): FlowDefinition => f;

describe("demovie/flow", () => {
  it("defineFlow returns the flow it is given", () => {
    const flow = defineFlow({ name: "x", start: "/", run: async () => {} });
    expect(toPublic(toCapture(flow))).toBe(flow);
  });
});
