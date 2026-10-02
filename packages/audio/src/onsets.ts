import type { PcmAudio } from "./wav.ts";

/**
 * Simple onset detection for imported/provider music (SPEC §13.1): an energy-flux envelope at 100 Hz, then the beat
 * phase at the requested BPM that collects the most onset strength. Returns the offset of the first beat (seconds).
 */
export function detectBeatOffset(audio: PcmAudio, bpm: number): number {
  const sr = audio.sampleRate;
  const hop = Math.round(sr / 100);
  const frames = Math.floor((audio.channels[0]?.length ?? 0) / hop);
  if (frames < 4) return 0;
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (const ch of audio.channels)
      for (let i = f * hop; i < (f + 1) * hop; i++) {
        const x = ch[i]!;
        e += x * x;
      }
    energy[f] = Math.log1p(1000 * (e / hop));
  }
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, energy[f]! - energy[f - 1]!);
  const period = (60 / bpm) * 100;
  let best = 0;
  let bestScore = -1;
  for (let phase = 0; phase < period; phase += 1) {
    let score = 0;
    for (let t = phase; t < frames; t += period) {
      const i = Math.round(t);
      score += Math.max(flux[i] ?? 0, 0.5 * (flux[i - 1] ?? 0), 0.5 * (flux[i + 1] ?? 0));
    }
    if (score > bestScore) {
      bestScore = score;
      best = phase;
    }
  }
  return Math.round((best / 100) * 1000) / 1000;
}
