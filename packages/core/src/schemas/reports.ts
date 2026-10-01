import { z } from "zod";
import { FormatId, IsoDate, Rect } from "./common.ts";

export const QaRuleResultSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warn"]),
  status: z.enum(["pass", "fail", "waived", "skipped"]),
  title: z.string(),
  message: z.string(),
  occurrences: z
    .array(
      z.object({
        t: z.number(),
        until: z.number().optional().describe("end of a persistent violation"),
        bbox: Rect.optional(),
        detail: z.string(),
      }),
    )
    .default([]),
  fix: z.string(),
});
export type QaRuleResult = z.infer<typeof QaRuleResultSchema>;

export const QaReportSchema = z.object({
  slug: z.string(),
  format: FormatId,
  sampledFps: z.number(),
  rules: z.array(QaRuleResultSchema),
  summary: z.object({ errors: z.number().int(), warnings: z.number().int(), waived: z.number().int() }),
});
export type QaReport = z.infer<typeof QaReportSchema>;

export const QaFileSchema = z
  .object({
    slug: z.string(),
    generatedAt: IsoDate,
    strict: z.boolean().default(false),
    reports: z.array(QaReportSchema),
    summary: z.object({ errors: z.number().int(), warnings: z.number().int(), waived: z.number().int() }),
  })
  .describe("QA results (videos/<slug>/qa.json)");
export type QaFile = z.infer<typeof QaFileSchema>;

export const ChangesSchema = z
  .object({
    since: z.string(),
    sinceSha: z.string(),
    head: z.string(),
    generatedAt: IsoDate,
    commits: z.array(
      z.object({
        sha: z.string(),
        type: z.string().nullable(),
        scope: z.string().nullable(),
        subject: z.string(),
        breaking: z.boolean(),
        prs: z.array(z.number().int()),
        userVisible: z.boolean(),
        pr: z.object({ title: z.string(), body: z.string() }).nullable().optional(),
      }),
    ),
    files: z.array(z.object({ path: z.string(), status: z.string() })),
    routes: z.array(
      z.object({
        path: z.string(),
        file: z.string().nullable(),
        reason: z.enum(["direct", "import"]),
        via: z.array(z.string()).describe("import chain from a changed file to the page"),
      }),
    ),
    suggestions: z.object({
      captures: z.array(z.string()),
      flows: z.array(z.string()),
      story: z.string(),
    }),
  })
  .describe("change summary (.demovie/.cache/changes.json)");
export type Changes = z.infer<typeof ChangesSchema>;
