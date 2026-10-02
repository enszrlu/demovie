import type { Beats, StoryboardRow, StyleId } from "@demovie/core";
import { addPingPong, addReverb, Biquad, limit, midiToFreq, OnePole, Oscillator, TWO_PI, type Wave } from "./dsp.ts";
import { noiseSource, seededRandom } from "./random.ts";
import { createAudio, dbToGain, frameCount, type PcmAudio, peakDb, SAMPLE_RATE, scale } from "./wav.ts";

export const MOODS = ["uplifting", "tech", "calm", "energetic", "minimal"] as const;
export type Mood = (typeof MOODS)[number];
export type SectionName = "intro" | "build" | "main" | "outro";
export interface Section {
  name: SectionName;
  start: number;
  end: number;
}

export interface MusicOptions {
  bpm: number;
  mood: Mood;
  duration: number;
  seed: string | number;
  /** e.g. "C", "F#m", "Eb major"; default: picked from the seed in the mood's mode. */
  key?: string | null;
  sections?: Section[] | null;
  /** The ending hit (seconds); default: the start of the outro section. A bar line is placed exactly here. */
  endHit?: number | null;
  sampleRate?: number;
  /** Also return the processed buses (analysis and tests). */
  stems?: boolean;
}

export interface MusicResult {
  audio: PcmAudio;
  beats: Beats;
  key: string;
  sections: Section[];
  endHit: number | null;
  stems?: Record<"drums" | "room" | "bass" | "pad" | "arp" | "fx", PcmAudio>;
}

interface MoodPreset {
  mode: "major" | "minor";
  /** Scale degrees (0-based), one chord per bar. */
  progression: number[];
  bpm: number;
  kick: "four" | "half" | "none";
  clap: boolean;
  hats: "offbeat" | "eighths" | "sixteenths" | "shaker";
  bass: "eighths" | "offbeats" | "roots" | "pulse";
  bassWave: Wave;
  arp: "sixteenths" | "eighths" | "sparse";
  arpWave: Wave;
  padCutoff: number;
  sevenths: boolean;
  pump: number;
  levels: { kick: number; drums: number; bass: number; pad: number; arp: number };
}

const PRESETS: Record<Mood, MoodPreset> = {
  uplifting: {
    mode: "major",
    progression: [0, 4, 5, 3],
    bpm: 112,
    kick: "four",
    clap: true,
    hats: "offbeat",
    bass: "eighths",
    bassWave: "saw",
    arp: "sixteenths",
    arpWave: "triangle",
    padCutoff: 2200,
    sevenths: false,
    pump: 0.35,
    levels: { kick: 0.5, drums: 0.85, bass: 0.5, pad: 0.75, arp: 0.42 },
  },
  tech: {
    mode: "minor",
    progression: [0, 5, 2, 6],
    bpm: 120,
    kick: "four",
    clap: true,
    hats: "sixteenths",
    bass: "offbeats",
    bassWave: "saw",
    arp: "sixteenths",
    arpWave: "square",
    padCutoff: 1500,
    sevenths: true,
    pump: 0.4,
    levels: { kick: 0.55, drums: 0.85, bass: 0.55, pad: 0.6, arp: 0.32 },
  },
  calm: {
    mode: "major",
    progression: [0, 5, 3, 4],
    bpm: 88,
    kick: "none",
    clap: false,
    hats: "shaker",
    bass: "roots",
    bassWave: "sine",
    arp: "eighths",
    arpWave: "triangle",
    padCutoff: 1300,
    sevenths: true,
    pump: 0,
    levels: { kick: 0, drums: 0.6, bass: 0.35, pad: 0.8, arp: 0.5 },
  },
  energetic: {
    mode: "major",
    progression: [5, 3, 0, 4],
    bpm: 128,
    kick: "four",
    clap: true,
    hats: "eighths",
    bass: "pulse",
    bassWave: "saw",
    arp: "sixteenths",
    arpWave: "saw",
    padCutoff: 2800,
    sevenths: false,
    pump: 0.45,
    levels: { kick: 0.6, drums: 0.9, bass: 0.5, pad: 0.6, arp: 0.3 },
  },
  minimal: {
    mode: "minor",
    progression: [0, 0, 5, 6],
    bpm: 100,
    kick: "half",
    clap: false,
    hats: "offbeat",
    bass: "roots",
    bassWave: "sine",
    arp: "sparse",
    arpWave: "triangle",
    padCutoff: 1100,
    sevenths: true,
    pump: 0.2,
    levels: { kick: 0.5, drums: 0.7, bass: 0.4, pad: 0.7, arp: 0.45 },
  },
};

/** Per-section instrument levels (0 = silent). The outro is the ending hit plus a sustained tonic chord. */
const ARRANGEMENT: Record<SectionName, { kick: number; clap: number; hats: number; bass: number; arp: number }> = {
  intro: { kick: 0, clap: 0, hats: 0, bass: 0, arp: 0.5 },
  build: { kick: 0.75, clap: 0, hats: 0.6, bass: 0.8, arp: 0.75 },
  main: { kick: 1, clap: 1, hats: 1, bass: 1, arp: 1 },
  outro: { kick: 0, clap: 0, hats: 0, bass: 0, arp: 0 },
};

export const MOOD_BPM: Record<Mood, number> = Object.fromEntries(MOODS.map((m) => [m, PRESETS[m].bpm])) as Record<
  Mood,
  number
>;

/** The default mood for a style preset (DECISIONS). */
export function moodForStyle(style: StyleId): Mood {
  const map: Record<StyleId, Mood> = {
    clean: "uplifting",
    bold: "energetic",
    soft: "calm",
    editorial: "minimal",
    terminal: "tech",
  };
  return map[style];
}

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

export interface Key {
  root: number;
  mode: "major" | "minor";
  name: string;
}

export function parseKey(text: string): Key | null {
  const m = text.trim().match(/^([A-Ga-g])([#♯b♭]?)\s*(m|min|minor|maj|major)?$/);
  if (!m) return null;
  let root = LETTERS[m[1]!.toLowerCase()]!;
  if (m[2] === "#" || m[2] === "♯") root += 1;
  if (m[2] === "b" || m[2] === "♭") root -= 1;
  root = (root + 12) % 12;
  const mode = m[3] && /^m(in(or)?)?$/.test(m[3]) ? "minor" : "major";
  return { root, mode, name: `${NOTE_NAMES[root]} ${mode}` };
}

export function defaultSections(duration: number, bpm: number): Section[] {
  const bar = 240 / bpm;
  const introEnd = Math.min(duration * 0.15, 2 * bar);
  const outroStart = duration - Math.min(Math.max(2, duration * 0.12), 4.5);
  const buildEnd = introEnd + Math.min(2 * bar, (outroStart - introEnd) * 0.3);
  return [
    { name: "intro", start: 0, end: introEnd },
    { name: "build", start: introEnd, end: buildEnd },
    { name: "main", start: buildEnd, end: outroStart },
    { name: "outro", start: outroStart, end: duration },
  ];
}

/**
 * Sections from the storyboard (DECISIONS): the first shot is the intro (unless it is a product shot), a final
 * logo/title/text shot is the outro and gets the ending hit, the first ≤ 2 bars after the intro build up.
 */
export function sectionsFromStoryboard(rows: StoryboardRow[], duration: number, bpm: number): Section[] {
  if (rows.length < 2) return defaultSections(duration, bpm);
  const bar = 240 / bpm;
  const sorted = [...rows].sort((a, b) => a.start - b.start);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const introEnd = first.kind === "product" ? Math.min(2 * bar, duration * 0.15) : first.start + first.dur;
  const outroStart =
    ["logo", "title", "text"].includes(last.kind) && last.start > introEnd + bar
      ? last.start
      : duration - Math.min(4.5, duration * 0.12);
  const buildEnd = introEnd + Math.min(2 * bar, (outroStart - introEnd) * 0.3);
  return [
    { name: "intro", start: 0, end: introEnd },
    { name: "build", start: introEnd, end: buildEnd },
    { name: "main", start: buildEnd, end: outroStart },
    { name: "outro", start: outroStart, end: duration },
  ];
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** 16th-step → arp tone index for the "sparse" pattern. */
const SPARSE_ARP: Record<number, number> = { 0: 0, 3: 2, 6: 1, 10: 3, 12: 2 };

/** Snap inner section boundaries to bar lines; the outro start (ending hit) is a bar line by construction. */
function snapSections(sections: Section[], duration: number, offset: number, bar: number): Section[] {
  const sorted = [...sections].sort((a, b) => a.start - b.start);
  const out: Section[] = [];
  let prev = 0;
  sorted.forEach((s, i) => {
    let start = i === 0 ? 0 : offset + Math.round((s.start - offset) / bar) * bar;
    start = Math.min(Math.max(start, prev), duration);
    if (out.length) out[out.length - 1]!.end = start;
    out.push({ name: s.name, start, end: duration });
    prev = start;
  });
  return out.filter((s) => s.end - s.start > 1e-6).map((s) => ({ ...s, start: round3(s.start), end: round3(s.end) }));
}

/** beats.json (SPEC §13.1): every beat and bar line from `offset` to the end, plus the sections. */
export function beatGrid(bpm: number, offset: number, duration: number, sections: Section[]): Beats {
  const spb = 60 / bpm;
  const beats: number[] = [];
  for (let k = 0; offset + k * spb < duration - 1e-6; k++) beats.push(round3(offset + k * spb));
  const bars: number[] = [];
  for (let k = 0; offset + k * 4 * spb < duration - 1e-6; k++) bars.push(round3(offset + k * 4 * spb));
  return {
    bpm,
    offset: round3(offset),
    beats,
    bars,
    sections: sections.map((s) => ({ name: s.name, start: round3(s.start), end: round3(s.end) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Instruments: each renders one note into a stereo bus.

type Noise = () => number;

function span(bus: PcmAudio, t0: number, seconds: number): { start: number; len: number } {
  const start = Math.round(t0 * bus.sampleRate);
  return { start, len: Math.round(seconds * bus.sampleRate) };
}

function kick(bus: PcmAudio, t0: number, vel: number, noise: Noise): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, 0.42);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    phase += (44 + 110 * Math.exp(-t * 32)) / sr;
    let x = Math.sin(TWO_PI * phase) * Math.exp(-t * 7) * Math.min(1, t / 0.0015);
    if (t < 0.004) x += noise() * 0.12 * (1 - t / 0.004);
    x = Math.tanh(1.6 * x) / Math.tanh(1.6);
    if (j < 0) continue;
    l[j]! += x * vel;
    r[j]! += x * vel;
  }
}

function clap(bus: PcmAudio, t0: number, vel: number, noise: Noise): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, 0.26);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const bp = new Biquad(sr, "bandpass", 1400, 0.8);
  const hp = new Biquad(sr, "highpass", 500);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    let env = 0;
    for (const d of [0, 0.009, 0.018]) if (t >= d) env = Math.max(env, Math.exp(-(t - d) * 160));
    if (t >= 0.018) env = Math.max(env, 0.5 * Math.exp(-(t - 0.018) * 20));
    const x = hp.process(bp.process(noise())) * env * 2.4 * vel;
    if (j < 0) continue;
    l[j]! += x * 0.92;
    r[j]! += x;
  }
}

function hat(bus: PcmAudio, t0: number, vel: number, noise: Noise, kind: "closed" | "shaker"): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, kind === "closed" ? 0.06 : 0.1);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const f1 = kind === "closed" ? new Biquad(sr, "highpass", 7500, 0.7) : new Biquad(sr, "bandpass", 6000, 1.1);
  const f2 = new OnePole(sr, 12_000);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    const env =
      kind === "closed" ? Math.exp(-t * 70) * Math.min(1, t / 0.0008) : Math.exp(-t * 40) * Math.min(1, t / 0.006);
    const x = f2.process(f1.process(noise())) * env * vel * (kind === "shaker" ? 3 : 1);
    if (j < 0) continue;
    l[j]! += x * 0.72;
    r[j]! += x;
  }
}

function bassNote(bus: PcmAudio, t0: number, dur: number, midi: number, vel: number, wave: Wave): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, dur + 0.05);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const f = midiToFreq(midi);
  const osc = new Oscillator(sr, wave === "sine" ? "sine" : "saw");
  const sub = new Oscillator(sr, "sine");
  const lp = new Biquad(sr, "lowpass", 600, 1.0);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    if (i % 32 === 0) lp.set(wave === "sine" ? 700 : 170 + 1000 * Math.exp(-t * 11), 1.05);
    const env =
      Math.min(1, t / 0.004) * (t < dur ? 1 - 0.2 * Math.min(1, t / 0.3) : Math.max(0, 0.8 - (t - dur) / 0.06));
    const x = wave === "sine" ? osc.next(f) * 0.5 : osc.next(f) * 0.7 + sub.next(f) * 0.3;
    const y = lp.process(x) * env * vel;
    if (j < 0) continue;
    l[j]! += y;
    r[j]! += y;
  }
}

function padChord(
  bus: PcmAudio,
  t0: number,
  t1: number,
  notes: number[],
  vel: number,
  o: { cutoff: number; attack: number; release: number },
  rand: () => number,
): void {
  const sr = bus.sampleRate;
  const hold = t1 - t0;
  const { start, len } = span(bus, t0, hold + o.release);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const oscL = notes.map(() => new Oscillator(sr, "saw", rand()));
  const oscR = notes.map(() => new Oscillator(sr, "saw", rand()));
  const freqL = notes.map((n) => midiToFreq(n) * 2 ** (-7 / 1200));
  const freqR = notes.map((n) => midiToFreq(n) * 2 ** (7 / 1200));
  const fl = new Biquad(sr, "lowpass", o.cutoff, 0.6);
  const fr = new Biquad(sr, "lowpass", o.cutoff, 0.6);
  const gain = (0.2 / Math.sqrt(notes.length)) * vel;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    if (i % 64 === 0) {
      const c = o.cutoff * (1 + 0.15 * Math.sin(TWO_PI * 0.11 * (t0 + t)));
      fl.set(c, 0.6);
      fr.set(c * 1.04, 0.6);
    }
    const a = t < o.attack ? Math.sin((Math.PI / 2) * (t / o.attack)) : 1;
    const env = a * (t > hold ? Math.max(0, 1 - (t - hold) / o.release) : 1);
    let sl = 0;
    let sr2 = 0;
    for (let k = 0; k < notes.length; k++) {
      sl += oscL[k]!.next(freqL[k]!);
      sr2 += oscR[k]!.next(freqR[k]!);
    }
    const yl = fl.process(sl) * env * gain;
    const yr = fr.process(sr2) * env * gain;
    if (j < 0) continue;
    l[j]! += yl;
    r[j]! += yr;
  }
}

function pluck(bus: PcmAudio, t0: number, midi: number, vel: number, wave: Wave, pan: number): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, 0.5);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const f = midiToFreq(midi);
  const osc = new Oscillator(sr, wave);
  const lp = new Biquad(sr, "lowpass", 3000, 0.8);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    if (i % 16 === 0) lp.set(500 + 3200 * Math.exp(-t * 18), 0.9);
    const y = lp.process(osc.next(f)) * Math.min(1, t / 0.003) * Math.exp(-t * 7.5) * 0.5 * vel;
    if (j < 0) continue;
    l[j]! += y * (1 - pan);
    r[j]! += y * (1 + pan);
  }
}

function riser(bus: PcmAudio, t0: number, t1: number, vel: number, nl: Noise, nr: Noise): void {
  const sr = bus.sampleRate;
  const d = t1 - t0;
  const { start, len } = span(bus, t0, d);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const bl = new Biquad(sr, "bandpass", 300, 1.6);
  const br = new Biquad(sr, "bandpass", 300, 1.6);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const p = i / len;
    if (i % 32 === 0) {
      const fc = 300 * 20 ** p;
      bl.set(fc, 1.6);
      br.set(fc * 1.03, 1.6);
    }
    const env = p * p * (p > 0.97 ? (1 - p) / 0.03 : 1) * vel;
    const yl = bl.process(nl()) * env;
    const yr = br.process(nr()) * env;
    if (j < 0) continue;
    l[j]! += yl;
    r[j]! += yr;
  }
}

function crash(bus: PcmAudio, t0: number, vel: number, length: number, nl: Noise, nr: Noise): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, length);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  const hl = new Biquad(sr, "highpass", 3500, 0.7);
  const hr = new Biquad(sr, "highpass", 3500, 0.7);
  const tl = new OnePole(sr, 11_000);
  const tr = new OnePole(sr, 11_000);
  const k = 6.9 / length;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    const env = Math.min(1, t / 0.002) * Math.exp(-t * k) * vel;
    const yl = tl.process(hl.process(nl())) * env;
    const yr = tr.process(hr.process(nr())) * env;
    if (j < 0) continue;
    l[j]! += yl;
    r[j]! += yr;
  }
}

function boom(bus: PcmAudio, t0: number, vel: number): void {
  const sr = bus.sampleRate;
  const { start, len } = span(bus, t0, 2.2);
  const [l, r] = bus.channels as [Float32Array, Float32Array];
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j >= l.length) break;
    const t = i / sr;
    phase += (36 + 22 * Math.exp(-t * 3)) / sr;
    const y = Math.tanh(1.4 * Math.sin(TWO_PI * phase) * Math.exp(-t * 2.6) * Math.min(1, t / 0.004)) * vel;
    if (j < 0) continue;
    l[j]! += y;
    r[j]! += y;
  }
}

/** Sidechain-style pump after each kick (gain dips by `depth`, recovers over ~110 ms). */
function pump(bus: PcmAudio, kicks: number[], depth: number): void {
  if (depth <= 0 || kicks.length === 0) return;
  const sr = bus.sampleRate;
  const n = frameCount(bus);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    while (k + 1 < kicks.length && kicks[k + 1]! <= t) k++;
    const dt = t - kicks[k]!;
    if (dt < 0) continue;
    const g = 1 - depth * Math.min(1, dt / 0.005) * Math.exp(-dt / 0.11);
    for (const ch of bus.channels) ch[i]! *= g;
  }
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Synthesize a music bed (SPEC §13.1): 48 kHz stereo, deterministic for a seed. Kick, clap, hats, bass, pad and
 * pluck arp follow intro → build → main → outro, with an ending hit on the final shot.
 */
export function synthMusic(o: MusicOptions): MusicResult {
  const sr = o.sampleRate ?? SAMPLE_RATE;
  const preset = PRESETS[o.mood];
  const rand = seededRandom(`music:${o.seed}`);
  const noise = noiseSource(`noise:${o.seed}`);
  const noiseR = noiseSource(`noise-r:${o.seed}`);
  const key = (o.key ? parseKey(o.key) : null) ?? {
    root: [0, 2, 3, 5, 7, 9][Math.floor(rand() * 6)]!,
    mode: preset.mode,
    name: "",
  };
  if (!key.name) key.name = `${NOTE_NAMES[key.root]} ${key.mode}`;
  const duration = o.duration;
  const spb = 60 / o.bpm;
  const bar = 4 * spb;
  const step = spb / 4;
  const rawSections = o.sections?.length ? o.sections : defaultSections(duration, o.bpm);
  const endHit = o.endHit !== undefined ? o.endHit : (rawSections.find((s) => s.name === "outro")?.start ?? null);
  const offset = endHit !== null && endHit > 0 ? ((endHit % bar) + bar) % bar : 0;
  const sections = snapSections(rawSections, duration, offset, bar);
  const sectionAt = (t: number): Section =>
    sections.find((s) => t >= s.start - 1e-6 && t < s.end - 1e-6) ?? sections[sections.length - 1]!;
  const outroStart = endHit ?? sections.find((s) => s.name === "outro")?.start ?? duration;
  const mainStart = sections.find((s) => s.name === "main")?.start ?? 0;

  const barTimes: number[] = [];
  for (let k = 0; offset + k * bar < duration - 1e-6; k++) barTimes.push(offset + k * bar);
  const mainBar = Math.max(0, Math.round((mainStart - offset) / bar));

  const scaleSteps = SCALES[key.mode];
  const degreeNote = (d: number) => scaleSteps[((d % 7) + 7) % 7]! + 12 * Math.floor(d / 7);
  const chordAt = (barIndex: number): number[] => {
    const prog = preset.progression;
    const deg = prog[(((barIndex - mainBar) % prog.length) + prog.length) % prog.length]!;
    const tones = [degreeNote(deg), degreeNote(deg + 2), degreeNote(deg + 4)];
    if (preset.sevenths) tones.push(degreeNote(deg + 6));
    return tones.map((x) => key.root + x);
  };
  const inWindow = (notes: number[], low: number) =>
    notes.map((n) => low + ((((n - low) % 12) + 12) % 12)).sort((a, b) => a - b);
  const bassRoot = (chord: number[]) => {
    const pc = ((chord[0]! % 12) + 12) % 12;
    const n = 36 + pc;
    return n > 43 ? n - 12 : n;
  };

  const make = () => createAudio(duration, sr);
  const drums = make();
  const room = make();
  const bass = make();
  const pad = make();
  const arp = make();
  const fx = make();
  const kicks: number[] = [];
  const jitter = () => 0.94 + rand() * 0.12;

  // pad: one segment per chord change, the first starting at 0 (covers a pickup before the first bar line)
  const segments: { start: number; end: number; chord: number[]; section: SectionName }[] = [];
  barTimes.forEach((t, k) => {
    if (t >= outroStart - 1e-6) return;
    const chord = chordAt(k);
    const section = sectionAt(t).name;
    const last = segments[segments.length - 1];
    if (last && last.chord.join() === chord.join() && last.section === section)
      last.end = Math.min(t + bar, outroStart);
    else segments.push({ start: k === 0 ? 0 : t, end: Math.min(t + bar, outroStart), chord, section });
  });
  if (segments.length === 0 && outroStart > 0)
    segments.push({ start: 0, end: outroStart, chord: chordAt(0), section: "intro" });
  segments.forEach((s, i) => {
    padChord(
      pad,
      s.start,
      s.end,
      inWindow(s.chord, 55),
      s.section === "main" ? 0.8 : 0.9,
      { cutoff: preset.padCutoff, attack: i === 0 ? Math.min(1.6, s.end - s.start) : 0.35, release: 0.6 },
      rand,
    );
  });

  // rhythm section and arp, per 16th step
  const arpNotes = (chord: number[]) => {
    const tones = inWindow(chord.slice(0, 3), 67);
    return [...tones, tones[0]! + 12];
  };
  const arpPattern: Record<MoodPreset["arp"], (s: number) => number | null> = {
    sixteenths: (s) => s % 4,
    eighths: (s) => (s % 2 === 0 ? [0, 1, 2, 3, 2, 1, 0, 1][s / 2]! : null),
    sparse: (s) => SPARSE_ARP[s] ?? null,
  };
  barTimes.forEach((tb, k) => {
    const section = sectionAt(tb + 1e-6).name;
    if (section === "outro") return;
    const lv = ARRANGEMENT[section];
    const chord = chordAt(k);
    const root = bassRoot(chord);
    const notes = arpNotes(chord);
    for (let s = 0; s < 16; s++) {
      const t = tb + s * step;
      if (t >= outroStart - 1e-6 || t >= duration) break;
      // kick
      const kickPattern = section === "main" ? preset.kick : preset.kick === "none" ? "none" : "half";
      if (lv.kick > 0 && kickPattern !== "none" && (kickPattern === "four" ? s % 4 === 0 : s % 8 === 0)) {
        kick(drums, t, lv.kick * preset.levels.kick, noise);
        kicks.push(t);
      }
      if (lv.clap > 0 && preset.clap && (s === 4 || s === 12))
        clap(room, t, lv.clap * 0.5 * preset.levels.drums, noise);
      // hats
      if (lv.hats > 0) {
        const pattern = section === "main" ? preset.hats : preset.hats === "shaker" ? "shaker" : "offbeat";
        const hit =
          pattern === "offbeat" ? s % 4 === 2 : pattern === "eighths" || pattern === "shaker" ? s % 2 === 0 : true;
        if (hit) {
          const accent = pattern === "sixteenths" ? (s % 4 === 2 ? 1 : 0.55) : s % 4 === 2 ? 1 : 0.7;
          hat(
            drums,
            t,
            lv.hats * accent * 0.28 * preset.levels.drums * jitter(),
            noise,
            pattern === "shaker" ? "shaker" : "closed",
          );
        }
      }
      // bass
      if (lv.bass > 0) {
        const pattern = section === "main" ? preset.bass : "roots";
        const v = lv.bass * preset.levels.bass;
        if (pattern === "roots" && s % 8 === 0)
          bassNote(bass, t, Math.min(bar / 2, outroStart - t) * 0.95, root, v, preset.bassWave);
        if (pattern === "eighths" && s % 2 === 0)
          bassNote(bass, t, step * 1.8, root, v * (s % 4 === 0 ? 1 : 0.8), preset.bassWave);
        if (pattern === "offbeats" && s % 4 === 2) bassNote(bass, t, step * 1.6, root, v, preset.bassWave);
        if (pattern === "pulse" && s % 2 === 0)
          bassNote(bass, t, step * 1.6, s % 4 === 2 ? root + 12 : root, v * 0.9, preset.bassWave);
      }
      // arp
      if (lv.arp > 0) {
        const idx = arpPattern[preset.arp](s);
        if (idx !== null) {
          const pan = (idx % 2 === 0 ? -1 : 1) * 0.25;
          pluck(arp, t, notes[idx]!, lv.arp * preset.levels.arp * jitter(), preset.arpWave, pan);
        }
      }
    }
  });

  // build riser into the main section, a crash on its downbeat
  const build = sections.find((s) => s.name === "build");
  if (build && mainStart > 0 && mainStart < outroStart) {
    const length = Math.min(bar, 2, build.end - build.start);
    if (length > 0.5) riser(fx, mainStart - length, mainStart, 0.22, noise, noiseR);
    crash(fx, mainStart, 0.1, 1.6, noise, noiseR);
  }

  // the ending hit: kick + boom + crash + chord stab, then the tonic chord rings out
  if (endHit !== null && endHit < duration) {
    kick(drums, endHit, Math.max(0.5, preset.levels.kick), noise);
    boom(fx, endHit, 0.45);
    crash(fx, endHit, 0.16, Math.min(2.6, duration - endHit + 0.5), noise, noiseR);
    const tonic = [key.root, key.root + (key.mode === "major" ? 4 : 3), key.root + 7];
    for (const n of arpNotes(tonic)) pluck(arp, endHit, n, 0.7 * preset.levels.arp, preset.arpWave, 0);
    padChord(
      pad,
      endHit,
      duration,
      inWindow(tonic, 55),
      1,
      { cutoff: preset.padCutoff * 1.2, attack: 0.02, release: 0.01 },
      rand,
    );
  }

  // buses → master
  pump(pad, kicks, preset.pump);
  pump(arp, kicks, preset.pump * 0.7);
  pump(bass, kicks, preset.pump * 0.5);
  addReverb(room, 0.35);
  addPingPong(arp, step * 3, 0.32, 0.28);
  addReverb(arp, 0.3);
  addReverb(pad, 0.4);
  const master = make();
  const gains: [PcmAudio, number][] = [
    [drums, 1],
    [room, 1],
    [bass, 1],
    [pad, preset.levels.pad],
    [arp, 1],
    [fx, 1],
  ];
  for (let c = 0; c < 2; c++) {
    const out = master.channels[c]!;
    const tone = new OnePole(sr, 15_000);
    for (let i = 0; i < out.length; i++) {
      let x = 0;
      for (const [bus, g] of gains) x += bus.channels[c]![i]! * g;
      out[i] = tone.process(x);
    }
  }
  limit(master, -1.5);
  const peak = peakDb(master);
  if (Number.isFinite(peak)) scale(master, dbToGain(-1 - peak));

  return {
    audio: master,
    beats: beatGrid(o.bpm, offset, duration, sections),
    key: key.name,
    sections,
    endHit: endHit === null ? null : round3(endHit),
    ...(o.stems ? { stems: { drums, room, bass, pad, arp, fx } } : {}),
  };
}
