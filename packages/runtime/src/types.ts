import type { gsap as GsapNs } from "gsap";

export type FormatId = "16:9" | "9:16" | "1:1" | "4:5";
export type ShotKind = "product" | "title" | "text" | "logo" | "other";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** `video.json` as the runtime sees it (SPEC §6.6). */
export interface VideoJson {
  slug: string;
  title: string;
  type: string;
  fps: number;
  duration: number;
  formats: FormatId[];
  style: string;
  poster?: number | null;
  status?: string;
  audio?: {
    music?: { src: string; gain?: number; beats?: string | null } | null;
    voice?: { manifest: string } | null;
    sfx?: { name: string; at: number; gain?: number }[];
  };
  captions?: { enabled?: boolean; burnIn?: FormatId[] };
  captures?: string[];
  qa?: { ignore?: string[] };
}

export interface BrandColors {
  background: string | null;
  foreground: string | null;
  primary: string | null;
  primaryForeground: string | null;
  secondary: string | null;
  accent: string | null;
  muted: string | null;
  mutedForeground: string | null;
  border: string | null;
  ring: string | null;
  chart: string[];
}

export interface BrandFont {
  family: string;
  weights: number[];
  files: string[];
}

export interface Brand {
  name: string;
  tagline: string | null;
  url: string | null;
  colors: { light: BrandColors; dark: BrandColors | null };
  fonts: { heading: BrandFont | null; body: BrandFont | null; mono: BrandFont | null };
  radius: { sm: string | null; md: string | null; lg: string | null };
  shadows: string[];
  logo: { mark: string | null; wordmark: string | null; onDark: string | null };
}

export interface Glossary {
  productName: string;
  tagline: string | null;
  features: { term: string; source: string | null }[];
  uiLabels: string[];
  entities: string[];
  people: string[];
  ctaUrl: string | null;
  avoid: string[];
}

export interface Beats {
  bpm: number;
  offset: number;
  beats: number[];
  bars: number[];
  sections: { name: string; start: number; end: number }[];
}

export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export interface VoiceManifest {
  provider: string;
  voice: string;
  lines: {
    id: string;
    text: string;
    start: number;
    duration: number;
    file: string;
    words: WordTiming[];
    estimated?: boolean;
  }[];
}

/** One captured element (subset of `elements.json`). */
export interface CaptureElement {
  id: string;
  role: string;
  name: string;
  tag: string;
  text?: string;
  bbox: Rect;
  visible: boolean;
  interactive: boolean;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    background: string | null;
    radius: number;
    lineHeight?: number;
    paddingLeft?: number;
    paddingTop?: number;
  };
  value?: string;
  placeholder?: string;
}

/** A loaded capture state (SPEC §6.5). */
export interface CaptureState {
  id: string;
  url: string;
  path: string;
  title: string | null;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  dpr: number;
  image: { width: number; height: number };
  fullPage: { width: number; height: number } | null;
  elements: CaptureElement[];
  screenUrl: string;
  fullUrl: string | null;
}

export interface Shot {
  id: string;
  start: number;
  end: number;
  kind: ShotKind;
  el: HTMLElement;
}

export type Gsap = typeof GsapNs;
export type Timeline = gsap.core.Timeline;

export interface Video {
  meta: VideoJson;
  format: FormatId;
  width: number;
  height: number;
  fps: number;
  duration: number;
  scale: number;
  stage: HTMLElement;
  safe: Insets;
  unit: number;
  brand: Brand;
  glossary: Glossary | null;
  beats?: Beats;
  voice?: VoiceManifest;
  gsap: Gsap;
  timeline: Timeline;
  shot(id: string, start: number, end: number, o?: { kind?: ShotKind; el?: HTMLElement }): Shot;
  css(
    el: Element,
    keyframes: Keyframe[],
    o: { start: number; duration: number; easing?: string; fill?: FillMode },
  ): void;
  onSeek(fn: (t: number) => void): void;
  random(seed: string | number): () => number;
  beat(n: number): number;
  bar(n: number): number;
  ready(): void;
}

export interface TextBox {
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

export interface InspectResult {
  t: number;
  format: FormatId;
  width: number;
  height: number;
  safe: Insets;
  texts: TextBox[];
  shots: {
    id: string;
    start: number;
    end: number;
    kind: ShotKind;
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
    /** Image pixels per output pixel; > 1 means upscaled (DM-G05). */
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

export interface DemovieHandle {
  version: string;
  ready: boolean;
  error?: string;
  meta: { fps: number; duration: number; width: number; height: number; format: FormatId; scale: number };
  seek(t: number): Promise<void>;
  inspect(): InspectResult;
}

declare global {
  interface Window {
    __DEMOVIE__?: DemovieHandle;
  }
}
