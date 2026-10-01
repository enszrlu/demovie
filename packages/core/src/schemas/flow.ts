import { z } from "zod";

const LOCATOR_KEYS = ["role", "label", "text", "testId", "css", "element", "placeholder"] as const;

/** A step target, resolved through Playwright's getByRole/getByLabel/getByText/getByTestId/locator (SPEC §9.7). */
export const TargetSchema = z
  .object({
    role: z.string().optional(),
    name: z.string().optional().describe("accessible name, with `role`"),
    label: z.string().optional(),
    text: z.string().optional(),
    testId: z.string().optional(),
    css: z.string().optional(),
    placeholder: z.string().optional(),
    element: z.string().optional().describe("an element id from an element map"),
    exact: z.boolean().optional(),
    nth: z.number().int().optional(),
  })
  .refine((t) => LOCATOR_KEYS.filter((k) => t[k] !== undefined).length === 1, {
    message: `a target needs exactly one of: ${LOCATOR_KEYS.join(", ")}`,
  });
export type Target = z.infer<typeof TargetSchema>;

const TargetWith = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      role: z.string().optional(),
      name: z.string().optional(),
      label: z.string().optional(),
      text: z.string().optional(),
      testId: z.string().optional(),
      css: z.string().optional(),
      placeholder: z.string().optional(),
      element: z.string().optional(),
      exact: z.boolean().optional(),
      nth: z.number().int().optional(),
      ...shape,
    })
    .refine((t) => LOCATOR_KEYS.filter((k) => (t as Record<string, unknown>)[k] !== undefined).length === 1, {
      message: `a target needs exactly one of: ${LOCATOR_KEYS.join(", ")}`,
    });

export const FlowStepSchema = z.union([
  z.object({ goto: z.string() }).strict(),
  z.object({ click: TargetSchema }).strict(),
  z.object({ dblclick: TargetSchema }).strict(),
  z.object({ hover: TargetSchema }).strict(),
  z.object({ check: TargetSchema }).strict(),
  z.object({ uncheck: TargetSchema }).strict(),
  z.object({ fill: TargetWith({ value: z.string() }) }).strict(),
  z.object({ select: TargetWith({ value: z.union([z.string(), z.array(z.string())]) }) }).strict(),
  z.object({ press: z.union([z.string(), z.object({ key: z.string(), target: TargetSchema.optional() })]) }).strict(),
  z
    .object({
      scroll: z.union([
        z.number(),
        z.object({ y: z.number().optional(), x: z.number().optional(), to: TargetSchema.optional() }),
      ]),
    })
    .strict(),
  z.object({ wait: z.number().nonnegative().describe("milliseconds") }).strict(),
  z
    .object({
      waitFor: z.union([
        TargetSchema,
        z.object({ url: z.string() }).strict(),
        z.object({ hidden: TargetSchema }).strict(),
      ]),
    })
    .strict(),
  z
    .object({
      capture: z.union([z.string(), z.object({ name: z.string(), fullPage: z.boolean().optional() }).strict()]),
    })
    .strict(),
]);
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const FlowSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes")
      .describe("flow name"),
    start: z.string().describe("path to open first"),
    viewport: z.string().optional().describe("default: first of config.capture.defaultViewports"),
    allowDestructive: z.boolean().default(false),
    description: z.string().optional(),
    steps: z.array(FlowStepSchema).min(1),
  })
  .describe("user flow (.demovie/flows/*.flow.yaml)");
export type Flow = z.infer<typeof FlowSchema>;

export const FLOW_ACTIONS = [
  "goto",
  "click",
  "dblclick",
  "fill",
  "press",
  "hover",
  "select",
  "check",
  "uncheck",
  "scroll",
  "wait",
  "waitFor",
  "capture",
] as const;
export type FlowAction = (typeof FLOW_ACTIONS)[number];

export function stepAction(step: FlowStep): FlowAction {
  return Object.keys(step)[0] as FlowAction;
}
