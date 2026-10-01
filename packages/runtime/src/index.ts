/**
 * @demovie/runtime — the browser runtime for demovie compositions (SPEC §10).
 * Load `/__demovie/clock.js` first, then import this module from the composition's main.js.
 */
export { type CursorHandle, cursor } from "./cursor.ts";
export { callout, captions, logo, text, transition, typeText } from "./helpers.ts";
export { inspect } from "./inspect.ts";
export { type Device, type ScreenHandle, type ScreenOptions, screen } from "./screen.ts";
export type {
  Beats,
  Brand,
  CaptureElement,
  CaptureState,
  DemovieHandle,
  FormatId,
  Glossary,
  Insets,
  InspectResult,
  Rect,
  Shot,
  ShotKind,
  TextBox,
  Video,
  VideoJson,
  VoiceManifest,
} from "./types.ts";
export { createVideo, FORMATS, RUNTIME_VERSION, registerVideoElement } from "./video.ts";
