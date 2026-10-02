import { z } from "zod";

const ActionStepSchema = z
  .object({
    name: z.string().optional(),
    id: z.string().optional(),
    if: z.string().optional(),
    uses: z.string().optional(),
    with: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    run: z.string().optional(),
    shell: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    "working-directory": z.string().optional(),
    "continue-on-error": z.union([z.boolean(), z.string()]).optional(),
  })
  .strict()
  .refine((s) => Boolean(s.uses) !== Boolean(s.run), { message: "a step needs exactly one of `uses` or `run`" })
  .refine((s) => !s.run || Boolean(s.shell), { message: "composite `run` steps need `shell`" });

/** GitHub Action metadata (action.yml) for composite actions — the subset demovie's action uses. */
export const ActionMetadataSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    author: z.string().optional(),
    branding: z.object({ icon: z.string(), color: z.string() }).optional(),
    inputs: z.record(
      z.string(),
      z.object({ description: z.string(), required: z.boolean().optional(), default: z.string().optional() }).strict(),
    ),
    outputs: z.record(z.string(), z.object({ description: z.string(), value: z.string() }).strict()).optional(),
    runs: z.object({ using: z.literal("composite"), steps: z.array(ActionStepSchema).min(1) }).strict(),
  })
  .strict()
  .describe("GitHub composite action metadata (packages/action/action.yml)");
export type ActionMetadata = z.infer<typeof ActionMetadataSchema>;
