import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { assetDir, ProvenanceSchema } from "@demovie/core";
import { addReverb, Biquad, OnePole, TWO_PI } from "./dsp.ts";
import { noiseSource, seededRandom } from "./random.ts";
import { audioDuration, createAudio, dbToGain, decodeWav, type PcmAudio, peakDb, SAMPLE_RATE, scale } from "./wav.ts";

export const SFX_NAMES = [
  "whoosh-short",
  "whoosh-long",
  "swipe",
  "click",
  "soft-click",
  "pop",
  "tick",
  "type-key",
  "riser-2s",
  "impact",
  "shimmer",
  "notification",
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export const SFX_INFO: Record<SfxName, { description: string; peakDb: number }> = {
  "whoosh-short": { description: "short air whoosh for cuts and pushes", peakDb: -3 },
  "whoosh-long": { description: "longer whoosh for slow camera moves and wipes", peakDb: -3 },
  swipe: { description: "quick bright swipe for slides and swaps", peakDb: -4 },
  click: { description: "UI mouse click", peakDb: -3 },
  "soft-click": { description: "softer, lower UI click", peakDb: -6 },
  pop: { description: "pop for elements appearing", peakDb: -4 },
  tick: { description: "tiny tick for counters and toggles", peakDb: -6 },
  "type-key": { description: "one keyboard key press (cue one per typed character)", peakDb: -6 },
  "riser-2s": { description: "2 s noise riser ending on its last sample", peakDb: -3 },
  impact: { description: "low impact for logo hits and big reveals", peakDb: -2 },
  shimmer: { description: "airy bell shimmer for logos and success states", peakDb: -5 },
  notification: { description: "two-note chime", peakDb: -4 },
};

export function isSfxName(name: string): name is SfxName {
  return (SFX_NAMES as readonly string[]).includes(name);
}

type Render = (audio: PcmAudio, noise: { l: () => number; r: () => number }, rand: () => number) => void;

function each(audio: PcmAudio, fn: (t: number, i: number) => [number, number]): void {
  const [l, r] = audio.channels as [Float32Array, Float32Array];
  for (let i = 0; i < l.length; i++) {
    const [a, b] = fn(i / audio.sampleRate, i);
    l[i] = a;
    r[i] = b;
  }
}

function whoosh(seconds: number, low: number, high: number, end: number): Render {
  return (audio, noise) => {
    const sr = audio.sampleRate;
    const bl = new Biquad(sr, "bandpass", low, 1.2);
    const br = new Biquad(sr, "bandpass", low, 1.2);
    each(audio, (t, i) => {
      const p = t / seconds;
      if (i % 32 === 0) {
        const fc = p < 0.55 ? low * (high / low) ** (p / 0.55) : high * (end / high) ** ((p - 0.55) / 0.45);
        bl.set(fc, 1.2);
        br.set(fc * 1.05, 1.2);
      }
      const env = Math.sin(Math.PI * Math.min(1, p)) ** 2;
      const pan = 0.5 + 0.4 * (p - 0.5);
      return [bl.process(noise.l()) * env * (1 - pan) * 2, br.process(noise.r()) * env * pan * 2];
    });
  };
}

function blip(freqs: number[], decay: number, transient: number, transientHz: number): Render {
  return (audio, noise) => {
    const hp = new Biquad(audio.sampleRate, "highpass", transientHz, 0.7);
    each(audio, (t) => {
      let x = 0;
      for (const f of freqs) x += Math.sin(TWO_PI * f * t);
      x = (x / freqs.length) * Math.exp(-t * decay) * Math.min(1, t / 0.0005);
      if (t < 0.003) x += hp.process(noise.l()) * transient * (1 - t / 0.003);
      return [x, x];
    });
  };
}

const RENDERERS: Record<SfxName, { seconds: number; render: Render }> = {
  "whoosh-short": { seconds: 0.45, render: whoosh(0.45, 500, 3500, 1200) },
  "whoosh-long": { seconds: 1.2, render: whoosh(1.2, 300, 2500, 800) },
  swipe: {
    seconds: 0.28,
    render: (audio, noise) => {
      const sr = audio.sampleRate;
      const hp = new Biquad(sr, "highpass", 2000, 0.7);
      const bp = new Biquad(sr, "bandpass", 2000, 1.4);
      each(audio, (t, i) => {
        const p = t / 0.28;
        if (i % 16 === 0) bp.set(2000 * 3.5 ** p, 1.4);
        const env = Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.03) * 14);
        const x = bp.process(hp.process(noise.l())) * env * 2.5;
        return [x * (0.4 + 0.6 * p), x * (1 - 0.6 * p)];
      });
    },
  },
  click: { seconds: 0.06, render: blip([2200, 3300], 90, 0.6, 3000) },
  "soft-click": { seconds: 0.08, render: blip([1100, 1650], 60, 0.25, 1500) },
  pop: {
    seconds: 0.14,
    render: (audio) => {
      let phase = 0;
      each(audio, (t) => {
        phase += (250 + 650 * Math.exp(-t * 40)) / audio.sampleRate;
        const x = Math.sin(TWO_PI * phase) * Math.min(1, t / 0.002) * Math.exp(-t * 28);
        return [x, x];
      });
    },
  },
  tick: { seconds: 0.03, render: blip([3200], 200, 0.2, 4000) },
  "type-key": {
    seconds: 0.07,
    render: (audio, noise, rand) => {
      const sr = audio.sampleRate;
      const bp = new Biquad(sr, "bandpass", 2400 + rand() * 400, 2);
      const bp2 = new Biquad(sr, "bandpass", 3200, 2.5);
      each(audio, (t) => {
        let x = bp.process(noise.l()) * Math.exp(-t * 120) * 1.6;
        x += Math.sin(TWO_PI * 180 * t) * Math.exp(-t * 60) * 0.5;
        if (t > 0.015) x += bp2.process(noise.l()) * Math.exp(-(t - 0.015) * 200) * 0.9;
        x *= Math.min(1, t / 0.0005);
        return [x, x];
      });
    },
  },
  "riser-2s": {
    seconds: 2,
    render: (audio, noise) => {
      const sr = audio.sampleRate;
      const bl = new Biquad(sr, "bandpass", 300, 2);
      const br = new Biquad(sr, "bandpass", 300, 2);
      let phase = 0;
      each(audio, (t, i) => {
        const p = t / 2;
        if (i % 32 === 0) {
          bl.set(300 * 20 ** p, 2);
          br.set(310 * 20 ** p, 2);
        }
        phase += (220 * 4 ** p) / sr;
        const env = p * p * (p > 0.99 ? (1 - p) / 0.01 : 1);
        const tone = Math.sin(TWO_PI * phase) * 0.15;
        return [(bl.process(noise.l()) * 2 + tone) * env, (br.process(noise.r()) * 2 + tone) * env];
      });
    },
  },
  impact: {
    seconds: 1.6,
    render: (audio, noise) => {
      const sr = audio.sampleRate;
      const lp = new Biquad(sr, "lowpass", 800, 0.8);
      const tl = new OnePole(sr, 3000);
      const tr = new OnePole(sr, 3000);
      let phase = 0;
      each(audio, (t) => {
        phase += (38 + 32 * Math.exp(-t * 6)) / sr;
        const attack = Math.min(1, t / 0.003);
        const body = Math.sin(TWO_PI * phase) * Math.exp(-t * 2.5) * attack;
        const thump = lp.process(noise.l()) * Math.exp(-t * 18) * attack * 1.5;
        const tail = Math.exp(-t * 3) * 0.08;
        const x = Math.tanh(1.5 * (body + thump));
        return [x + tl.process(noise.l()) * tail, x + tr.process(noise.r()) * tail];
      });
      addReverb(audio, 0.25, 0.75, 0.4);
    },
  },
  shimmer: {
    seconds: 1.8,
    render: (audio, _noise, rand) => {
      const partials = [1318.51, 1567.98, 1975.53, 2637.02, 3135.96].map((f, k) => ({
        f,
        phase: rand(),
        at: k * 0.06,
        pan: k % 2 === 0 ? 0.3 : 0.7,
      }));
      each(audio, (t) => {
        let l = 0;
        let r = 0;
        for (const p of partials) {
          if (t < p.at) continue;
          const u = t - p.at;
          const x =
            Math.sin(TWO_PI * (p.f * u + p.phase)) *
            Math.min(1, u / 0.01) *
            Math.exp(-u * 2.6) *
            (0.85 + 0.15 * Math.sin(TWO_PI * 6 * u));
          l += x * (1 - p.pan);
          r += x * p.pan;
        }
        return [l * 0.5, r * 0.5];
      });
      addReverb(audio, 0.5, 0.85, 0.2);
    },
  },
  notification: {
    seconds: 0.9,
    render: (audio) => {
      const bell = (f: number, u: number) =>
        u < 0
          ? 0
          : (Math.sin(TWO_PI * f * u) + 0.3 * Math.sin(TWO_PI * 2 * f * u) + 0.1 * Math.sin(TWO_PI * 3 * f * u)) *
            Math.min(1, u / 0.005) *
            Math.exp(-u * 5);
      each(audio, (t) => {
        const x = bell(880, t) * 0.5 + bell(1318.51, t - 0.14) * 0.5;
        return [x, x];
      });
    },
  },
};

/** Generate one bundled SFX (deterministic DSP, CC0; SPEC §13.2), normalized to its catalog peak. */
export function generateSfx(name: SfxName, sampleRate = SAMPLE_RATE): PcmAudio {
  const { seconds, render } = RENDERERS[name];
  const audio = createAudio(seconds, sampleRate);
  render(audio, { l: noiseSource(`sfx:${name}:l`), r: noiseSource(`sfx:${name}:r`) }, seededRandom(`sfx:${name}`));
  const peak = peakDb(audio);
  if (Number.isFinite(peak)) scale(audio, dbToGain(SFX_INFO[name].peakDb - peak));
  return audio;
}

export interface SfxEntry {
  name: SfxName;
  file: string;
  duration: number;
  description: string;
  license: string | null;
}

/** The bundled SFX folder (packages/audio/sfx in the repo, assets/sfx in the package). */
export function sfxDir(): string {
  return assetDir("sfx");
}

export function sfxFile(name: SfxName): string {
  return path.join(sfxDir(), `${name}.wav`);
}

export function listSfx(): SfxEntry[] {
  const dir = sfxDir();
  const provFile = path.join(dir, "provenance.json");
  const provenance = existsSync(provFile)
    ? ProvenanceSchema.parse(JSON.parse(readFileSync(provFile, "utf8"))).files
    : [];
  return SFX_NAMES.map((name) => {
    const file = path.join(dir, `${name}.wav`);
    return {
      name,
      file,
      duration: existsSync(file) ? Math.round(audioDuration(decodeWav(readFileSync(file))) * 1000) / 1000 : 0,
      description: SFX_INFO[name].description,
      license: provenance.find((p) => p.file === `${name}.wav`)?.license ?? null,
    };
  });
}
