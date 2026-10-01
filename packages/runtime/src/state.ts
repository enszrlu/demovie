import type { Rect, Shot, Video } from "./types.ts";

/** A pure function of time run on every seek, in registration order (after GSAP and onSeek). */
export type Updater = (t: number) => void;

export interface ShotWindow {
  shot: Shot;
  /** Visible interval, widened by transitions. */
  from: number;
  to: number;
}

export interface ClickRecord {
  at: number;
  screenId: string;
  elementId: string;
  /** Stage point where the cursor clicks (computed per seek). */
  point: () => { x: number; y: number };
  /** Element rect under the current screen transform (computed per seek). */
  rect: () => Rect | null;
}

export interface Internal {
  video: Video | null;
  readyCalled: boolean;
  shots: ShotWindow[];
  cssAnimations: { anim: Animation; start: number; duration: number }[];
  videos: { el: HTMLVideoElement; start: number }[];
  seekFns: ((t: number) => void)[];
  updaters: Updater[];
  clicks: ClickRecord[];
  highlights: { screenId: string; elementId: string; from: number; to: number; rect: () => Rect | null }[];
  transitions: { at: number; end: number; kind: string }[];
  console: { level: string; text: string }[];
  declaredFonts: string[];
  /** Hidden-by-design text (e.g. offscreen measuring nodes) the inspector must skip. */
  t: number;
  idCounter: number;
}

export const internal: Internal = {
  video: null,
  readyCalled: false,
  shots: [],
  cssAnimations: [],
  videos: [],
  seekFns: [],
  updaters: [],
  clicks: [],
  highlights: [],
  transitions: [],
  console: [],
  declaredFonts: [],
  t: 0,
  idCounter: 0,
};

export function nextId(prefix: string): string {
  internal.idCounter += 1;
  return `${prefix}${internal.idCounter}`;
}

export function requireVideo(): Video {
  if (!internal.video) throw new Error("demovie: call `await createVideo()` before using runtime helpers");
  return internal.video;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

/** Clamp to [0, 1]. */
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
