import { z } from "zod";
import { FormatId, IsoDate, ShotKind, StyleId, VideoType } from "./common.ts";

export const VIDEO_STATUSES = ["brief", "storyboard", "styleframes", "animating", "qa-pass", "rendered"] as const;

export const VideoSchema = z
  .object({
    $schema: z.string().optional(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes"),
    title: z.string(),
    type: VideoType,
    fps: z.number().int().min(1).max(120).default(30),
    duration: z.number().positive(),
    formats: z.array(FormatId).min(1),
    style: StyleId.default("clean"),
    poster: z.number().nonnegative().nullable().default(null).describe("seconds; default 40% of the duration"),
    status: z.enum(VIDEO_STATUSES).default("brief"),
    audio: z
      .object({
        music: z
          .object({
            src: z.string(),
            gain: z.number().default(-14),
            beats: z.string().nullable().default(null),
          })
          .nullable()
          .default(null),
        voice: z.object({ manifest: z.string() }).nullable().default(null),
        sfx: z
          .array(z.object({ name: z.string(), at: z.number().nonnegative(), gain: z.number().default(-10) }))
          .default([]),
        loudness: z.object({ targetLufs: z.number().default(-16), truePeak: z.number().default(-1.5) }).prefault({}),
      })
      .prefault({}),
    captions: z
      .object({
        enabled: z.boolean().default(true),
        burnIn: z.array(FormatId).default(["9:16"]),
      })
      .prefault({}),
    captures: z.array(z.string()).default([]).describe("capture ids preloaded by the runtime"),
    qa: z
      .object({
        ignore: z.array(z.string()).default([]).describe("rule ids the user explicitly waives"),
        sampleFps: z.number().positive().optional(),
      })
      .prefault({}),
  })
  .describe("video definition (.demovie/videos/<slug>/video.json)");
export type Video = z.infer<typeof VideoSchema>;
export type VideoInput = z.input<typeof VideoSchema>;

export const BriefFrontmatterSchema = z
  .object({
    type: VideoType,
    duration: z.number().positive(),
    formats: z.array(FormatId).min(1),
    style: StyleId,
    audience: z.string().nullable().default(null),
    goal: z.string().nullable().default(null),
    message: z.string().nullable().default(null),
    cta: z.string().nullable().default(null),
    voice: z.boolean().default(false),
    music: z.boolean().default(true),
    references: z.array(z.string()).default([]),
    resources: z.array(z.string()).default([]),
    about: z.string().nullable().default(null),
  })
  .describe("brief.md frontmatter");
export type BriefFrontmatter = z.infer<typeof BriefFrontmatterSchema>;

export const StoryboardRowSchema = z.object({
  index: z.number().int(),
  start: z.number().nonnegative(),
  dur: z.number().positive(),
  kind: ShotKind,
  visual: z.string(),
  text: z.string().default(""),
  vo: z.string().default(""),
  captures: z.array(z.string()).default([]).describe("capture ids and element ids (capture#element)"),
  transition: z.string().default(""),
  notes: z.string().default(""),
});
export type StoryboardRow = z.infer<typeof StoryboardRowSchema>;

export const StoryboardSchema = z
  .object({
    bpm: z.number().min(40).max(220).nullable().default(null),
    rows: z.array(StoryboardRowSchema),
  })
  .describe("storyboard.md (frontmatter bpm + shot table)");
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const BeatsSchema = z
  .object({
    bpm: z.number().positive(),
    offset: z.number().nonnegative().default(0),
    beats: z.array(z.number()),
    bars: z.array(z.number()),
    sections: z.array(z.object({ name: z.string(), start: z.number(), end: z.number() })).default([]),
  })
  .describe("beat grid (audio/beats.json)");
export type Beats = z.infer<typeof BeatsSchema>;

export const WordTimingSchema = z.object({ text: z.string(), start: z.number(), end: z.number() });
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const VoiceManifestSchema = z
  .object({
    provider: z.enum(["elevenlabs", "openai"]),
    voice: z.string(),
    model: z.string().nullable().default(null),
    lines: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        start: z.number().nonnegative(),
        duration: z.number().positive(),
        file: z.string(),
        words: z.array(WordTimingSchema).default([]),
        estimated: z.boolean().optional(),
      }),
    ),
  })
  .describe("voiceover manifest (audio/voice.json)");
export type VoiceManifest = z.infer<typeof VoiceManifestSchema>;

export const PROVENANCE_GENERATORS = [
  "demovie-synth",
  "demovie-sfx",
  "demovie-mix",
  "elevenlabs",
  "openai",
  "user-licensed",
] as const;

export const ProvenanceEntrySchema = z.object({
  file: z.string().describe("file name relative to the folder holding provenance.json"),
  kind: z.enum(["music", "sfx", "voice", "mix", "import"]),
  generator: z.enum(PROVENANCE_GENERATORS),
  license: z.string().nullable().default(null),
  createdAt: IsoDate,
  details: z.record(z.string(), z.unknown()).default({}),
});
export type ProvenanceEntry = z.infer<typeof ProvenanceEntrySchema>;

export const ProvenanceSchema = z
  .object({ files: z.array(ProvenanceEntrySchema).default([]) })
  .describe("audio provenance (audio/provenance.json)");
export type Provenance = z.infer<typeof ProvenanceSchema>;
