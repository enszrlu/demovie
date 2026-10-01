/**
 * clock.js — MUST be the first script of a composition (SPEC §10.1).
 * Installs virtual time: performance.now, Date.now/new Date(), requestAnimationFrame, seeded Math.random,
 * and timers that only run during setup. The renderer drives time through `window.__DEMOVIE_CLOCK__`.
 */

interface ClockApi {
  readonly installed: true;
  /** Virtual time in seconds. */
  readonly t: number;
  readonly epoch: number;
  readonly isReady: boolean;
  set(seconds: number): void;
  /** Run queued rAF callbacks once with timestamp `t * 1000`. */
  flushRaf(): number;
  markReady(): void;
  /** setTimeout/setInterval calls after ready() (DM-R05). */
  timersAfterReady: { kind: string; stack: string }[];
  native: {
    raf: (cb: FrameRequestCallback) => number;
    caf: (id: number) => void;
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
    performanceNow: () => number;
    DateNow: () => number;
    Date: DateConstructor;
    random: () => number;
  };
  /** A seeded PRNG stream. */
  prng(seed: string | number): () => number;
}

declare global {
  interface Window {
    __DEMOVIE_CLOCK__?: ClockApi;
    __DEMOVIE_EPOCH__?: number;
  }
}

(() => {
  const w = window;
  if (w.__DEMOVIE_CLOCK__) return;
  const NativeDate = Date;
  const native: ClockApi["native"] = {
    raf: w.requestAnimationFrame.bind(w),
    caf: w.cancelAnimationFrame.bind(w),
    setTimeout: w.setTimeout.bind(w) as typeof setTimeout,
    clearTimeout: w.clearTimeout.bind(w) as typeof clearTimeout,
    performanceNow: performance.now.bind(performance),
    DateNow: NativeDate.now.bind(NativeDate),
    Date: NativeDate,
    random: Math.random.bind(Math),
  };
  const params = new URLSearchParams(location.search);
  const epochParam = Number(params.get("epoch"));
  const epoch =
    typeof w.__DEMOVIE_EPOCH__ === "number"
      ? w.__DEMOVIE_EPOCH__
      : Number.isFinite(epochParam) && epochParam > 0
        ? epochParam
        : NativeDate.UTC(2026, 0, 1);
  let t = 0;
  let ready = false;

  // Seeded PRNG (mulberry32) keyed by a string hash.
  const hashSeed = (seed: string | number): number => {
    const s = String(seed);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  };
  const prng = (seed: string | number): (() => number) => {
    let a = hashSeed(seed);
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  Math.random = prng("demovie");

  performance.now = () => t * 1000;

  class VirtualDate extends NativeDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(epoch + t * 1000);
      else super(...(args as [string | number | Date]));
    }
    static override now(): number {
      return epoch + t * 1000;
    }
  }
  Object.defineProperty(VirtualDate, "name", { value: "Date" });
  (VirtualDate as unknown as { parse: typeof Date.parse }).parse = NativeDate.parse;
  (VirtualDate as unknown as { UTC: typeof Date.UTC }).UTC = NativeDate.UTC;
  w.Date = VirtualDate as unknown as DateConstructor;

  // rAF callbacks are queued and flushed by the runtime during seek(), never by the browser.
  let rafId = 0;
  let queue = new Map<number, FrameRequestCallback>();
  w.requestAnimationFrame = (cb: FrameRequestCallback) => {
    rafId += 1;
    queue.set(rafId, cb);
    return rafId;
  };
  w.cancelAnimationFrame = (id: number) => {
    queue.delete(id);
  };

  const timersAfterReady: ClockApi["timersAfterReady"] = [];
  const guard = <T extends (...args: any[]) => any>(kind: string, fn: T): T =>
    ((...args: Parameters<T>) => {
      if (!ready) return fn(...args);
      timersAfterReady.push({ kind, stack: (new Error().stack ?? "").split("\n").slice(2, 5).join("\n") });
      return 0;
    }) as T;
  w.setTimeout = guard("setTimeout", w.setTimeout.bind(w)) as typeof setTimeout;
  w.setInterval = guard("setInterval", w.setInterval.bind(w)) as typeof setInterval;

  const api: ClockApi = {
    installed: true,
    get t() {
      return t;
    },
    epoch,
    get isReady() {
      return ready;
    },
    set(seconds: number) {
      t = seconds;
    },
    flushRaf() {
      const pending = queue;
      queue = new Map();
      for (const cb of pending.values()) {
        try {
          cb(t * 1000);
        } catch (error) {
          console.error(error);
        }
      }
      return pending.size;
    },
    markReady() {
      ready = true;
    },
    timersAfterReady,
    native,
    prng,
  };
  Object.defineProperty(w, "__DEMOVIE_CLOCK__", { value: api, configurable: false, writable: false });
})();

export {};
