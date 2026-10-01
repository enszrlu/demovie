import { z } from "zod";

export const FORMAT_IDS = ["16:9", "9:16", "1:1", "4:5"] as const;
export const FormatId = z.enum(FORMAT_IDS);
export type FormatId = z.infer<typeof FormatId>;

export const STYLE_IDS = ["clean", "bold", "soft", "editorial", "terminal"] as const;
export const StyleId = z.enum(STYLE_IDS);
export type StyleId = z.infer<typeof StyleId>;

export const VIDEO_TYPES = ["launch", "feature", "changelog", "teaser", "walkthrough", "hero-loop"] as const;
export const VideoType = z.enum(VIDEO_TYPES);
export type VideoType = z.infer<typeof VideoType>;

export const AGENT_IDS = ["claude", "codex", "cursor"] as const;
export const AgentId = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof AgentId>;

export const SHOT_KINDS = ["product", "title", "text", "logo", "other"] as const;
export const ShotKind = z.enum(SHOT_KINDS);
export type ShotKind = z.infer<typeof ShotKind>;

export const HexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/, "lowercase sRGB hex, e.g. #2563eb")
  .describe("sRGB hex color");

export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type Rect = z.infer<typeof Rect>;

export const IsoDate = z.string().describe("ISO 8601 timestamp");

/** Pixel size and safe-area insets per format at scale 1 (SPEC §10.2). */
export const FORMATS: Record<
  FormatId,
  { width: number; height: number; safe: { top: number; right: number; bottom: number; left: number } }
> = {
  "16:9": { width: 1920, height: 1080, safe: { top: 5, right: 5, bottom: 5, left: 5 } },
  "9:16": { width: 1080, height: 1920, safe: { top: 12, right: 6, bottom: 20, left: 6 } },
  "1:1": { width: 1080, height: 1080, safe: { top: 6, right: 6, bottom: 6, left: 6 } },
  "4:5": { width: 1080, height: 1350, safe: { top: 6, right: 6, bottom: 8, left: 6 } },
};

/** File-name friendly format id: "16:9" → "16x9". */
export function formatSlug(format: FormatId): string {
  return format.replace(":", "x");
}

export interface TypePreset {
  defaultDuration: number;
  range: [number, number];
  formats: FormatId[];
  voice: "off" | "optional" | "recommended";
  music: "on" | "low" | "none";
  /** Average shot length floor in seconds for DM-P01. */
  shotFloor: number;
}

/** Type presets (SPEC §11.3) and pacing floors (SPEC §12, DM-P01). */
export const TYPE_PRESETS: Record<VideoType, TypePreset> = {
  changelog: {
    defaultDuration: 15,
    range: [10, 20],
    formats: ["16:9", "1:1"],
    voice: "off",
    music: "on",
    shotFloor: 1.5,
  },
  teaser: { defaultDuration: 12, range: [8, 15], formats: ["9:16", "1:1"], voice: "off", music: "on", shotFloor: 1.2 },
  feature: {
    defaultDuration: 25,
    range: [20, 35],
    formats: ["16:9", "9:16"],
    voice: "optional",
    music: "on",
    shotFloor: 1.8,
  },
  launch: {
    defaultDuration: 35,
    range: [25, 50],
    formats: ["16:9", "9:16"],
    voice: "optional",
    music: "on",
    shotFloor: 1.8,
  },
  walkthrough: {
    defaultDuration: 75,
    range: [60, 120],
    formats: ["16:9"],
    voice: "recommended",
    music: "low",
    shotFloor: 2.5,
  },
  "hero-loop": {
    defaultDuration: 10,
    range: [6, 15],
    formats: ["16:9", "4:5"],
    voice: "off",
    music: "none",
    shotFloor: 1.8,
  },
};
