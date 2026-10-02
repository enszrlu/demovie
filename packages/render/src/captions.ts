import { captionCues, toSrt, toVtt } from "@demovie/audio";
import type { VoiceManifest } from "@demovie/core";

/** WebVTT and SRT sidecars from the voice manifest; cues are split the same way as `audio voice` and the runtime. */
export function captionsFromManifest(manifest: VoiceManifest): { vtt: string; srt: string } {
  const cues = captionCues(manifest.lines);
  return { vtt: toVtt(cues), srt: toSrt(cues) };
}
