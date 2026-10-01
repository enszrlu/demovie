import type { FormatId, Glossary, ProvenanceEntry, Rect, Video, VoiceManifest } from "@demovie/core";

/** What `window.__DEMOVIE__.inspect()` returns (packages/runtime/src/types.ts), as plain data. */
export interface InspectText {
  id: string;
  text: string;
  words: number;
  bbox: Rect;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  opacity: number;
  clipped: boolean;
  overflowing: boolean;
  ui: boolean;
  caption: boolean;
  counter: boolean;
  role: "text" | "logo" | "cta";
}

export interface InspectData {
  t: number;
  format: FormatId;
  width: number;
  height: number;
  safe: { top: number; right: number; bottom: number; left: number };
  texts: InspectText[];
  shots: {
    id: string;
    start: number;
    end: number;
    kind: string;
    active: boolean;
    screens: number;
    window: [number, number];
  }[];
  screens: {
    id: string;
    capture: string;
    captures: string[];
    bbox: Rect;
    visible: boolean;
    cameraScale: number;
    upscale: number;
  }[];
  cursor: { visible: boolean; x: number; y: number }[];
  clicks: { at: number; screen: string; elementId: string; point: { x: number; y: number }; rect: Rect | null }[];
  highlights: { screen: string; elementId: string; rect: Rect }[];
  logos: { bbox: Rect; visible: boolean }[];
  animations: { registered: number; unregistered: { name: string; target: string }[] };
  strayTweens: { targets: string; duration: number }[];
  timersAfterReady: number;
  console: { level: string; text: string }[];
  fonts: { declared: string[]; loaded: string[]; failed: string[] };
  images: { broken: string[] };
  transitions: { at: number; end: number; kind: string }[];
}

/** RGBA pixels of a sampled frame at `scale` × stage size. */
export interface Pixels {
  width: number;
  height: number;
  scale: number;
  data: Uint8Array;
}

export interface Sample {
  t: number;
  inspect: InspectData;
  pixels?: Pixels;
}

export interface QaInputs {
  format: FormatId;
  video: Video;
  sampleFps: number;
  samples: Sample[];
  /** inspect() evaluated exactly at each click time (DM-G01). */
  clicks: InspectData["clicks"];
  network: { blocked: string[]; failed: { url: string; status: number | null }[] };
  /** DM-R01: frames rendered twice in different seek orders. */
  determinism: { times: number[]; mismatches: { t: number; diffRatio: number }[] } | null;
  /** DM-P05 (hero-loop): first vs last frame. */
  loop: { diffRatio: number } | null;
  vocabulary: Vocabulary;
  audio: AudioFacts;
}

export interface Vocabulary {
  glossary: Glossary | null;
  /** Lowercased words from the glossary, the brief and captured UI text. */
  words: Set<string>;
  /** Number tokens from the brief, the glossary and captured UI text. */
  numbers: Set<string>;
  /** Lowercased full phrases (glossary terms, UI labels). */
  phrases: Set<string>;
}

export interface AudioFacts {
  /** Audio files in the video's audio/ folder (relative names) and assets it uses. */
  files: string[];
  provenance: ProvenanceEntry[];
  loudness: { integrated: number; truePeak: number } | null;
  target: { lufs: number; truePeak: number };
  voice: VoiceManifest | null;
}

export interface Occurrence {
  t: number;
  /** For violations that persist: the last sampled time they still hold. */
  until?: number;
  bbox?: Rect;
  detail: string;
  severity?: "error" | "warn";
}

export interface RuleOutcome {
  occurrences: Occurrence[];
  /** Why the rule did not apply (e.g. no audio). */
  skipped?: string;
}

export interface Rule {
  id: string;
  severity: "error" | "warn";
  /** For warn/error rules: which threshold is the error. */
  title: string;
  measurement: string;
  fix: string;
  check(input: QaInputs): RuleOutcome;
}
