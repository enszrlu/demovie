import { z } from "zod";
import { BrandSchema } from "./brand.ts";
import { CaptureIndexSchema, CaptureMetaSchema, ElementMapSchema, FlowRunSchema } from "./capture.ts";
import { ConfigSchema } from "./config.ts";
import { FlowSchema } from "./flow.ts";
import { AssetsSchema, GlossarySchema, RoutesSchema } from "./project-files.ts";
import { ChangesSchema, QaFileSchema } from "./reports.ts";
import {
  BeatsSchema,
  BriefFrontmatterSchema,
  ProvenanceSchema,
  StoryboardSchema,
  VideoSchema,
  VoiceManifestSchema,
} from "./video.ts";

export * from "./brand.ts";
export * from "./capture.ts";
export * from "./common.ts";
export * from "./config.ts";
export * from "./flow.ts";
export * from "./plugin.ts";
export * from "./project-files.ts";
export * from "./reports.ts";
export * from "./video.ts";

/** Every `.demovie/` file format, keyed by JSON Schema file name (SPEC §6). */
export const SCHEMAS = {
  config: ConfigSchema,
  brand: BrandSchema,
  glossary: GlossarySchema,
  routes: RoutesSchema,
  flow: FlowSchema,
  assets: AssetsSchema,
  video: VideoSchema,
  brief: BriefFrontmatterSchema,
  storyboard: StoryboardSchema,
  beats: BeatsSchema,
  voice: VoiceManifestSchema,
  provenance: ProvenanceSchema,
  qa: QaFileSchema,
  "capture-index": CaptureIndexSchema,
  elements: ElementMapSchema,
  "capture-meta": CaptureMetaSchema,
  "flow-run": FlowRunSchema,
  changes: ChangesSchema,
} as const;
export type SchemaName = keyof typeof SCHEMAS;

/** JSON Schema generated from the zod schema (never hand-written). */
export function jsonSchemaFor(name: SchemaName): Record<string, unknown> {
  const schema = z.toJSONSchema(SCHEMAS[name], { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://unpkg.com/demovie/schema/${name}.schema.json`,
    title: `demovie ${name}`,
    ...schema,
  };
}
