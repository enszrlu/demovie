import { z } from "zod";
import { IsoDate, Rect } from "./common.ts";

export const ElementSchema = z.object({
  id: z.string().describe("dm:<data-demovie> or <role>:<slug(name)>, duplicates get #2, #3…"),
  role: z.string(),
  name: z.string(),
  tag: z.string(),
  text: z.string().optional(),
  testId: z.string().optional(),
  demovie: z.string().optional(),
  selector: z.string(),
  bbox: Rect.describe("CSS px from the screenshot's top-left"),
  visible: z.boolean(),
  interactive: z.boolean(),
  inViewport: z.boolean(),
  level: z.number().int().optional().describe("heading level"),
  landmark: z.string().optional().describe("nearest landmark ancestor: nav, main, header, footer, aside, dialog"),
  href: z.string().optional(),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  style: z.object({
    fontFamily: z.string(),
    fontSize: z.number(),
    fontWeight: z.number(),
    color: z.string(),
    background: z.string().nullable(),
    radius: z.number(),
    lineHeight: z.number().optional(),
    paddingLeft: z.number().optional(),
    paddingTop: z.number().optional(),
  }),
});
export type ElementInfo = z.infer<typeof ElementSchema>;

export const ElementMapSchema = z
  .object({
    captureId: z.string(),
    url: z.string(),
    viewport: z.object({ width: z.number(), height: z.number(), deviceScaleFactor: z.number() }),
    document: z.object({ width: z.number(), height: z.number() }),
    elements: z.array(ElementSchema),
  })
  .describe("element map (captures/**/elements.json)");
export type ElementMap = z.infer<typeof ElementMapSchema>;

export const CaptureMetaSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["route", "flow"]),
    url: z.string(),
    path: z.string(),
    route: z.string().nullable().default(null),
    flow: z.string().nullable().default(null),
    step: z.string().nullable().default(null),
    title: z.string().nullable().default(null),
    viewport: z.object({
      name: z.string(),
      width: z.number(),
      height: z.number(),
      deviceScaleFactor: z.number(),
      isMobile: z.boolean().default(false),
    }),
    dpr: z.number(),
    colorScheme: z.enum(["light", "dark"]),
    capturedAt: IsoDate,
    gitSha: z.string().nullable(),
    redactions: z.record(z.string(), z.number()).default({}),
    warnings: z.array(z.string()).default([]),
    fullPage: z
      .object({ width: z.number(), height: z.number() })
      .nullable()
      .default(null)
      .describe("CSS size of full.png"),
    image: z.object({ width: z.number(), height: z.number() }).describe("pixel size of screen.png"),
  })
  .describe("capture metadata (captures/**/meta.json)");
export type CaptureMeta = z.infer<typeof CaptureMetaSchema>;

export const CaptureIndexEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(["route", "flow"]),
  route: z.string().nullable(),
  flow: z.string().nullable(),
  step: z.string().nullable(),
  path: z.string(),
  viewport: z.string(),
  colorScheme: z.enum(["light", "dark"]),
  capturedAt: IsoDate,
  gitSha: z.string().nullable(),
  configHash: z.string(),
  sourceHashes: z.record(z.string(), z.string()).describe("route source file + layout chain → sha256"),
});
export type CaptureIndexEntry = z.infer<typeof CaptureIndexEntrySchema>;

export const CaptureIndexSchema = z
  .object({
    version: z.literal(1),
    updatedAt: IsoDate,
    gitSha: z.string().nullable(),
    configHash: z.string(),
    states: z.array(CaptureIndexEntrySchema),
  })
  .describe("capture index (captures/index.json)");
export type CaptureIndex = z.infer<typeof CaptureIndexSchema>;

export const FlowRunSchema = z
  .object({
    name: z.string(),
    viewport: z.string(),
    start: z.string(),
    capturedAt: IsoDate,
    states: z.array(z.string()).describe("captured state names in order"),
    steps: z.array(
      z.object({
        index: z.number().int(),
        action: z.string(),
        description: z.string(),
        state: z.string().nullable().describe("most recent captured state at action time"),
        target: z
          .object({
            elementId: z.string().nullable(),
            bbox: Rect.nullable(),
            description: z.string(),
          })
          .nullable(),
        value: z.string().optional(),
        url: z.string(),
        at: z.number().describe("ms since the flow started"),
        durationMs: z.number(),
      }),
    ),
  })
  .describe("flow run record (captures/flows/<flow>@<viewport>/flow.json)");
export type FlowRun = z.infer<typeof FlowRunSchema>;
