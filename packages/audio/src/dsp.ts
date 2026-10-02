import { dbToGain, frameCount, type PcmAudio } from "./wav.ts";

export const TWO_PI = Math.PI * 2;

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export type FilterType = "lowpass" | "highpass" | "bandpass";

/** RBJ-cookbook biquad, transposed direct form II. `set()` may be called while running (filter sweeps). */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(
    private readonly sampleRate: number,
    private type: FilterType,
    freq: number,
    q = Math.SQRT1_2,
  ) {
    this.set(freq, q);
  }

  set(freq: number, q = Math.SQRT1_2, type: FilterType = this.type): void {
    this.type = type;
    const f = Math.min(Math.max(freq, 10), this.sampleRate * 0.45);
    const w = (TWO_PI * f) / this.sampleRate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number;
    let b1: number;
    let b2: number;
    if (type === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (type === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/** One-pole low-pass (gentle tone control). */
export class OnePole {
  private y = 0;
  private readonly a: number;
  constructor(sampleRate: number, freq: number) {
    this.a = Math.exp((-TWO_PI * freq) / sampleRate);
  }
  process(x: number): number {
    this.y = x + this.a * (this.y - x);
    return this.y;
  }
}

function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export type Wave = "sine" | "saw" | "square" | "triangle";

/** Band-limited oscillator (polyBLEP saw/square, integrated triangle). Phase is in cycles (0…1). */
export class Oscillator {
  phase: number;
  constructor(
    private readonly sampleRate: number,
    private readonly wave: Wave,
    phase = 0,
  ) {
    this.phase = phase;
  }

  next(freq: number): number {
    const dt = freq / this.sampleRate;
    const p = this.phase;
    let y: number;
    switch (this.wave) {
      case "sine":
        y = Math.sin(TWO_PI * p);
        break;
      case "saw":
        y = 2 * p - 1 - polyBlep(p, dt);
        break;
      case "square": {
        y = p < 0.5 ? 1 : -1;
        y += polyBlep(p, dt);
        y -= polyBlep((p + 0.5) % 1, dt);
        break;
      }
      case "triangle":
        // naive triangle (its harmonics fall at 12 dB/octave, so aliasing is negligible); zero-mean, no DC
        y = 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5);
        break;
    }
    this.phase = p + dt;
    if (this.phase >= 1) this.phase -= Math.floor(this.phase);
    return y;
  }
}

class Comb {
  private readonly buf: Float32Array;
  private i = 0;
  private store = 0;
  constructor(
    length: number,
    private readonly feedback: number,
    private readonly damp: number,
  ) {
    this.buf = new Float32Array(length);
  }
  process(x: number): number {
    const y = this.buf[this.i]!;
    this.store = y * (1 - this.damp) + this.store * this.damp;
    this.buf[this.i] = x + this.store * this.feedback;
    this.i = (this.i + 1) % this.buf.length;
    return y;
  }
}

class Allpass {
  private readonly buf: Float32Array;
  private i = 0;
  constructor(length: number) {
    this.buf = new Float32Array(length);
  }
  process(x: number): number {
    const b = this.buf[this.i]!;
    this.buf[this.i] = x + b * 0.5;
    this.i = (this.i + 1) % this.buf.length;
    return b - x;
  }
}

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];

/** Freeverb-style stereo reverb. Returns the wet signal only. */
export class Reverb {
  private readonly left: { combs: Comb[]; allpasses: Allpass[] };
  private readonly right: { combs: Comb[]; allpasses: Allpass[] };

  constructor(sampleRate: number, room = 0.82, damp = 0.3) {
    const k = sampleRate / 44_100;
    const build = (spread: number) => ({
      combs: COMBS.map((n) => new Comb(Math.round((n + spread) * k), room, damp)),
      allpasses: ALLPASSES.map((n) => new Allpass(Math.round((n + spread) * k))),
    });
    this.left = build(0);
    this.right = build(23);
  }

  process(l: number, r: number): [number, number] {
    const input = (l + r) * 0.015;
    let wl = 0;
    let wr = 0;
    for (const c of this.left.combs) wl += c.process(input);
    for (const c of this.right.combs) wr += c.process(input);
    for (const a of this.left.allpasses) wl = a.process(wl);
    for (const a of this.right.allpasses) wr = a.process(wr);
    return [wl, wr];
  }
}

/** Apply a reverb to `audio` in place, adding `wet` of the reverberated signal. */
export function addReverb(audio: PcmAudio, wet: number, room = 0.82, damp = 0.3): void {
  const rev = new Reverb(audio.sampleRate, room, damp);
  const [l, r] = audio.channels as [Float32Array, Float32Array];
  for (let i = 0; i < l.length; i++) {
    const [wl, wr] = rev.process(l[i]!, r[i]!);
    l[i]! += wl * wet;
    r[i]! += wr * wet;
  }
}

/** Ping-pong delay in place (wet added to the dry signal). */
export function addPingPong(audio: PcmAudio, delaySeconds: number, feedback: number, wet: number): void {
  const n = Math.max(1, Math.round(delaySeconds * audio.sampleRate));
  const bl = new Float32Array(n);
  const br = new Float32Array(n);
  const [l, r] = audio.channels as [Float32Array, Float32Array];
  let i = 0;
  for (let s = 0; s < l.length; s++) {
    const dl = bl[i]!;
    const dr = br[i]!;
    bl[i] = (l[s]! + r[s]!) * 0.5 + dr * feedback;
    br[i] = dl * feedback;
    l[s]! += dl * wet;
    r[s]! += dr * wet;
    i = (i + 1) % n;
  }
}

/**
 * Offline look-ahead peak limiter. A forward-looking minimum followed by a box average guarantees the gain at every
 * sample is ≤ what that sample needs, with linear ramps over the look-ahead; the release is a one-pole recovery.
 */
export function limit(audio: PcmAudio, ceilingDb: number, lookaheadMs = 4, releaseMs = 120): void {
  const n = frameCount(audio);
  if (n === 0) return;
  const ceiling = dbToGain(ceilingDb);
  const la = Math.max(1, Math.round((lookaheadMs / 1000) * audio.sampleRate));
  const required = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (const ch of audio.channels) peak = Math.max(peak, Math.abs(ch[i]!));
    required[i] = peak > ceiling ? ceiling / peak : 1;
  }
  // forward min over [i, i + la] with a monotonic deque (head = smallest)
  const fmin = new Float32Array(n);
  const deque = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && required[deque[tail - 1]!]! >= required[i]!) tail--;
    deque[tail++] = i;
    while (deque[head]! > i + la) head++;
    fmin[i] = required[deque[head]!]!;
  }
  // box average over [i - la, i]; then release smoothing that never exceeds the averaged gain
  const release = 1 - Math.exp(-1 / ((releaseMs / 1000) * audio.sampleRate));
  let sum = 0;
  let g = 1;
  for (let i = 0; i < n; i++) {
    sum += fmin[i]!;
    if (i - la - 1 >= 0) sum -= fmin[i - la - 1]!;
    const count = Math.min(i + 1, la + 1);
    const avg = Math.min(sum / count, fmin[i]!);
    g = Math.min(avg, g + (1 - g) * release);
    for (const ch of audio.channels) ch[i]! *= g;
  }
}

/** Mix `src` into `dst` starting at `atSeconds` with `gain`; sources with fewer channels are spread to all. */
export function mixInto(dst: PcmAudio, src: PcmAudio, atSeconds: number, gain = 1): void {
  const start = Math.round(atSeconds * dst.sampleRate);
  const frames = frameCount(src);
  for (let c = 0; c < dst.channels.length; c++) {
    const d = dst.channels[c]!;
    const s = src.channels[Math.min(c, src.channels.length - 1)]!;
    for (let i = Math.max(0, -start); i < frames; i++) {
      const j = start + i;
      if (j >= d.length) break;
      d[j]! += s[i]! * gain;
    }
  }
}
