import path from "node:path";
import {
  type FormatId,
  type Project,
  type QaFile,
  QaFileSchema,
  type QaReport,
  type QaRuleResult,
  writeJson,
} from "@demovie/core";
import { launchRenderer, startServer, type VideoContext } from "@demovie/render";
import { collect } from "./collect.ts";
import { RULES } from "./rules.ts";
import type { QaInputs } from "./types.ts";

/** Evaluate every rule on collected inputs (pure; unit-testable with synthetic samples). */
export function evaluate(inputs: QaInputs, o: { strict?: boolean; ignore?: string[]; slug?: string } = {}): QaReport {
  const ignore = new Set(o.ignore ?? inputs.video.qa.ignore);
  const rules: QaRuleResult[] = RULES.map((rule) => {
    const outcome = rule.check(inputs);
    const occ = outcome.occurrences;
    const hasError = occ.some((x) => (x.severity ?? rule.severity) === "error");
    let severity: "error" | "warn" = occ.length === 0 ? rule.severity : hasError ? "error" : "warn";
    if (o.strict && occ.length > 0) severity = "error";
    const status: QaRuleResult["status"] =
      occ.length === 0 ? (outcome.skipped ? "skipped" : "pass") : ignore.has(rule.id) ? "waived" : "fail";
    return {
      id: rule.id,
      severity,
      status,
      title: rule.title,
      message:
        occ.length === 0
          ? outcome.skipped
            ? `skipped: ${outcome.skipped}`
            : "ok"
          : `${occ.length} occurrence${occ.length === 1 ? "" : "s"}: ${occ[0]!.detail}`,
      occurrences: occ.map(({ severity: _s, ...rest }) => rest),
      fix: rule.fix,
    };
  });
  return {
    slug: o.slug ?? inputs.video.slug,
    format: inputs.format,
    sampledFps: inputs.sampleFps,
    rules,
    summary: {
      errors: rules.filter((r) => r.status === "fail" && r.severity === "error").length,
      warnings: rules.filter((r) => r.status === "fail" && r.severity === "warn").length,
      waived: rules.filter((r) => r.status === "waived").length,
    },
  };
}

export interface QaOptions {
  formats: FormatId[];
  strict?: boolean | undefined;
  sampleFps?: number | undefined;
  write?: boolean | undefined;
  onFormat?: ((format: FormatId) => void) | undefined;
}

/** `demovie qa`: load the composition as the renderer does, sample at 10 fps, run every rule, write qa.json (SPEC §12). */
export async function runQa(project: Project, video: VideoContext, o: QaOptions): Promise<QaFile> {
  const sampleFps = o.sampleFps ?? video.video.qa.sampleFps ?? 10;
  const server = await startServer({ project, video });
  const browser = await launchRenderer();
  const reports: QaReport[] = [];
  try {
    for (const format of o.formats) {
      o.onFormat?.(format);
      const inputs = await collect(project, video, { browser, server, format, sampleFps });
      reports.push(evaluate(inputs, { strict: Boolean(o.strict), slug: video.slug }));
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const file: QaFile = QaFileSchema.parse({
    slug: video.slug,
    generatedAt: new Date().toISOString(),
    strict: Boolean(o.strict),
    reports,
    summary: {
      errors: reports.reduce((n, r) => n + r.summary.errors, 0),
      warnings: reports.reduce((n, r) => n + r.summary.warnings, 0),
      waived: reports.reduce((n, r) => n + r.summary.waived, 0),
    },
  });
  if (o.write !== false) await writeJson(path.join(video.dir, "qa.json"), file);
  return file;
}
