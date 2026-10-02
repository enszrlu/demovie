import { gsap } from "gsap";
import { loadCaptures } from "./captures.ts";
import { preloadLogos } from "./helpers.ts";
import { inspect } from "./inspect.ts";
import { el, internal, type ShotWindow } from "./state.ts";
import type {
  Beats,
  Brand,
  DemovieHandle,
  FormatId,
  Glossary,
  Insets,
  Shot,
  ShotKind,
  Video,
  VideoJson,
  VoiceManifest,
} from "./types.ts";

export const RUNTIME_VERSION = "0.1.0";

export const FORMATS: Record<FormatId, { width: number; height: number; safe: Insets }> = {
  "16:9": { width: 1920, height: 1080, safe: { top: 5, right: 5, bottom: 5, left: 5 } },
  "9:16": { width: 1080, height: 1920, safe: { top: 12, right: 6, bottom: 20, left: 6 } },
  "1:1": { width: 1080, height: 1080, safe: { top: 6, right: 6, bottom: 6, left: 6 } },
  "4:5": { width: 1080, height: 1350, safe: { top: 6, right: 6, bottom: 8, left: 6 } },
};

const FALLBACK_FONTS = [
  { family: "Inter", file: "/__demovie/fonts/inter-variable.woff2", weight: "100 900" },
  { family: "Geist", file: "/__demovie/fonts/geist-variable.woff2", weight: "100 900" },
  { family: "Geist Mono", file: "/__demovie/fonts/geist-mono-variable.woff2", weight: "100 900" },
];

const DEFAULT_BRAND: Brand = {
  name: "Product",
  tagline: null,
  url: null,
  colors: {
    light: {
      background: "#ffffff",
      foreground: "#0a0a0a",
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      secondary: null,
      accent: null,
      muted: "#f5f5f5",
      mutedForeground: "#737373",
      border: "#e5e5e5",
      ring: null,
      chart: [],
    },
    dark: null,
  },
  fonts: { heading: null, body: null, mono: null },
  radius: { sm: "6px", md: "8px", lg: "12px" },
  shadows: [],
  logo: { mark: null, wordmark: null, onDark: null },
};

async function fetchJson<T>(url: string, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (fallback !== undefined) return fallback;
      throw new Error(`${url}: HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

function fail(message: string): never {
  const handle = window.__DEMOVIE__;
  if (handle) handle.error = message;
  throw new Error(`demovie: ${message}`);
}

function fontWeightFromFile(file: string): string {
  if (/-variable\.[a-z0-9]+$/i.test(file) || /variable|vf/i.test(file)) return "100 900";
  const m = file.match(/-(\d{3})(?:-italic)?\.[a-z0-9]+$/i);
  return m ? m[1]! : "400";
}

async function registerFonts(brand: Brand): Promise<string[]> {
  const declared: string[] = [];
  const faces: FontFace[] = [];
  const brandFamilies = new Set<string>();
  for (const spec of [brand.fonts.heading, brand.fonts.body, brand.fonts.mono]) {
    if (!spec) continue;
    for (const file of spec.files) {
      faces.push(
        new FontFace(spec.family, `url("/${file.replace(/^\/+/, "")}")`, {
          weight: fontWeightFromFile(file),
          display: "block",
        }),
      );
      brandFamilies.add(spec.family);
    }
    if (!declared.includes(spec.family)) declared.push(spec.family);
  }
  for (const f of FALLBACK_FONTS) {
    if (brandFamilies.has(f.family)) continue;
    faces.push(new FontFace(f.family, `url("${f.file}")`, { weight: f.weight, display: "block" }));
    if (!declared.includes(f.family)) declared.push(f.family);
  }
  await Promise.all(
    faces.map(async (face) => {
      try {
        await face.load();
        document.fonts.add(face);
      } catch {
        internal.console.push({ level: "error", text: `font failed to load: ${face.family}` });
      }
    }),
  );
  return declared;
}

function stack(primary: string | undefined, fallback: string): string {
  const quote = (f: string) => (/\s/.test(f) ? `"${f}"` : f);
  return [primary, fallback, "Inter", "Geist", "system-ui", "sans-serif"]
    .filter((f, i, a): f is string => Boolean(f) && a.indexOf(f) === i)
    .map(quote)
    .join(", ");
}

function applyCssVars(
  root: HTMLElement,
  v: { width: number; height: number; safe: Insets; unit: number; brand: Brand },
): void {
  const c = v.brand.colors.light;
  const s = root.style;
  s.setProperty("--dm-w", `${v.width}px`);
  s.setProperty("--dm-h", `${v.height}px`);
  s.setProperty("--dm-safe-top", `${v.safe.top}px`);
  s.setProperty("--dm-safe-right", `${v.safe.right}px`);
  s.setProperty("--dm-safe-bottom", `${v.safe.bottom}px`);
  s.setProperty("--dm-safe-left", `${v.safe.left}px`);
  s.setProperty("--dm-unit", `${v.unit}px`);
  s.setProperty("--dm-bg", c.background ?? "#ffffff");
  s.setProperty("--dm-fg", c.foreground ?? "#0a0a0a");
  s.setProperty("--dm-primary", c.primary ?? "#2563eb");
  s.setProperty("--dm-primary-fg", c.primaryForeground ?? "#ffffff");
  s.setProperty("--dm-accent", c.accent ?? c.primary ?? "#2563eb");
  s.setProperty("--dm-muted", c.muted ?? "#f5f5f5");
  s.setProperty("--dm-muted-fg", c.mutedForeground ?? "#737373");
  s.setProperty("--dm-border", c.border ?? "#e5e5e5");
  // The brand's chart palette (often darker and lighter tints of the primary): --dm-chart-1 … --dm-chart-5.
  for (const [i, color] of (c.chart ?? []).slice(0, 5).entries()) s.setProperty(`--dm-chart-${i + 1}`, color);
  s.setProperty("--dm-font-heading", stack(v.brand.fonts.heading?.family, "Geist"));
  s.setProperty("--dm-font-body", stack(v.brand.fonts.body?.family, "Geist"));
  s.setProperty("--dm-font-mono", stack(v.brand.fonts.mono?.family, "Geist Mono"));
  s.setProperty("--dm-radius", v.brand.radius.lg ?? "12px");
}

async function injectStyle(style: string): Promise<void> {
  const href = `/__demovie/styles/${style}.css`;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = el("link");
  link.rel = "stylesheet";
  link.href = href;
  const runtimeCss = document.querySelector('link[href$="/__demovie/runtime.css"]');
  if (runtimeCss?.nextSibling) runtimeCss.parentNode!.insertBefore(link, runtimeCss.nextSibling);
  else document.head.appendChild(link);
  await new Promise<void>((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
  });
}

function nativeFrames(n: number): Promise<void> {
  const raf = window.__DEMOVIE_CLOCK__!.native.raf;
  return new Promise((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : raf(() => step(left - 1)));
    step(n);
  });
}

async function decodePending(root: ParentNode): Promise<void> {
  const images = [...root.querySelectorAll("img")].filter((img) => img.src && !(img.complete && img.naturalWidth > 0));
  await Promise.all(images.map((img) => img.decode().catch(() => {})));
}

function shotVisibility(t: number): void {
  for (const w of internal.shots) {
    const visible = t >= w.from && t < w.to;
    w.shot.el.style.visibility = visible ? "inherit" : "hidden";
    w.shot.el.dataset.dmActive = visible ? "1" : "0";
  }
}

/** Create the video: load video.json/brand/glossary/beats, size the stage, register fonts, preload captures. */
export async function createVideo(opts: { stage?: HTMLElement } = {}): Promise<Video> {
  const clock = window.__DEMOVIE_CLOCK__;
  const handle: DemovieHandle = {
    version: RUNTIME_VERSION,
    ready: false,
    meta: { fps: 30, duration: 0, width: 0, height: 0, format: "16:9", scale: 1 },
    seek: async () => {},
    inspect: () => inspect(),
  };
  window.__DEMOVIE__ = handle;
  window.addEventListener("error", (e) => {
    handle.error ??= `${e.message}${e.filename ? ` (${e.filename.replace(location.origin, "")}:${e.lineno})` : ""}`;
  });
  window.addEventListener("unhandledrejection", (e) => {
    handle.error ??= `unhandled rejection: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`;
  });
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      internal.console.push({
        level,
        text: args
          .map((a) => (a instanceof Error ? a.message : String(a)))
          .join(" ")
          .slice(0, 300),
      });
      original(...args);
    };
  }
  if (!clock) fail('clock.js must be the first script in <head>: <script src="/__demovie/clock.js"></script>');
  if (internal.video) fail("createVideo() was called twice");

  const meta = await fetchJson<VideoJson>("/video.json").catch((error: Error) =>
    fail(`could not load /video.json: ${error.message}`),
  );
  const brand = { ...DEFAULT_BRAND, ...(await fetchJson<Partial<Brand>>("/brand/brand.json", {})) } as Brand;
  const glossary = await fetchJson<Glossary | null>("/glossary.json", null);
  const params = new URLSearchParams(location.search);
  const format = (params.get("format") ?? meta.formats[0] ?? "16:9") as FormatId;
  const dims = FORMATS[format];
  if (!dims) fail(`unknown format "${format}"`);
  const scale = Number(params.get("scale") ?? 1) || 1;
  const width = dims.width;
  const height = dims.height;
  const safe: Insets = {
    top: Math.round((height * dims.safe.top) / 100),
    right: Math.round((width * dims.safe.right) / 100),
    bottom: Math.round((height * dims.safe.bottom) / 100),
    left: Math.round((width * dims.safe.left) / 100),
  };
  const unit = Math.min(width, height) / 100;

  const root = document.documentElement;
  root.dataset.format = format;
  root.dataset.style = meta.style;
  applyCssVars(root, { width, height, safe, unit, brand });
  const stage = opts.stage ?? document.getElementById("stage") ?? el("div", "", document.body);
  stage.id ||= "stage";
  stage.classList.add("dm-stage");
  Object.assign(stage.style, { width: `${width}px`, height: `${height}px` });

  // Only what video.json declares is fetched: a probe for a missing file would be a 404 (QA DM-A02).
  const beatsPath = meta.audio?.music?.beats ?? null;
  const beats = beatsPath ? await fetchJson<Beats | null>(`/${beatsPath.replace(/^\/+/, "")}`, null) : null;
  const voicePath = meta.audio?.voice?.manifest;
  const voice = voicePath ? await fetchJson<VoiceManifest | null>(`/${voicePath.replace(/^\/+/, "")}`, null) : null;

  await injectStyle(meta.style ?? "clean");
  internal.declaredFonts = await registerFonts(brand);
  await loadCaptures(meta.captures ?? []);
  await preloadLogos([brand.logo.mark, brand.logo.wordmark, brand.logo.onDark]);

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.remove(gsap.updateRoot);
  gsap.config({ autoSleep: 60, force3D: false, nullTargetWarn: false });
  const timeline = gsap.timeline({ paused: true });

  const video: Video = {
    meta,
    format,
    width,
    height,
    fps: meta.fps,
    duration: meta.duration,
    scale,
    stage,
    safe,
    unit,
    brand,
    glossary,
    ...(beats ? { beats } : {}),
    ...(voice ? { voice } : {}),
    gsap,
    timeline,
    shot(id: string, start: number, end: number, o: { kind?: ShotKind; el?: HTMLElement } = {}): Shot {
      if (internal.shots.some((w) => w.shot.id === id)) throw new Error(`demovie: shot "${id}" is declared twice`);
      if (!(end > start)) throw new Error(`demovie: shot "${id}" must end after it starts (${start} → ${end})`);
      const container = o.el ?? el("section", "dm-shot", stage);
      container.classList.add("dm-shot");
      container.dataset.shot = id;
      container.dataset.kind = o.kind ?? "other";
      const shot: Shot = { id, start, end, kind: o.kind ?? "other", el: container };
      const w: ShotWindow = { shot, from: start, to: end };
      internal.shots.push(w);
      return shot;
    },
    css(
      target: Element,
      keyframes: Keyframe[],
      o: { start: number; duration: number; easing?: string; fill?: FillMode },
    ) {
      const anim = target.animate(keyframes, {
        duration: o.duration * 1000,
        easing: o.easing ?? "ease",
        fill: o.fill ?? "both",
      });
      anim.pause();
      internal.cssAnimations.push({ anim, start: o.start, duration: o.duration });
    },
    onSeek(fn: (t: number) => void) {
      internal.seekFns.push(fn);
    },
    random(seed: string | number) {
      return clock.prng(seed);
    },
    beat(n: number) {
      if (!beats) throw new Error("demovie: v.beat() needs audio/beats.json (run `npx demovie audio music <slug>`)");
      const i = Math.floor(n);
      const spb = 60 / beats.bpm;
      const base = beats.beats[i] ?? beats.offset + i * spb;
      return base + (n - i) * spb;
    },
    bar(n: number) {
      if (!beats) throw new Error("demovie: v.bar() needs audio/beats.json (run `npx demovie audio music <slug>`)");
      const i = Math.floor(n);
      const spbar = (60 / beats.bpm) * 4;
      return (beats.bars[i] ?? beats.offset + i * spbar) + (n - i) * spbar;
    },
    ready() {
      if (internal.readyCalled) {
        handle.error ??= "v.ready() was called more than once";
        return;
      }
      internal.readyCalled = true;
      void (async () => {
        try {
          await document.fonts.ready;
          await decodePending(document);
          clock.markReady();
          await seek(0);
          handle.ready = true;
        } catch (error) {
          handle.error ??= `ready failed: ${(error as Error).message}`;
        }
      })();
    },
  };
  internal.video = video;

  const seek = async (t: number) => {
    internal.t = t;
    clock.set(t);
    timeline.seek(t, false);
    for (const a of internal.cssAnimations) a.anim.currentTime = (t - a.start) * 1000;
    // Unregistered CSS animations are pinned to t (from 0) so frames stay deterministic; QA flags them (DM-R04).
    for (const anim of document.getAnimations()) {
      if (internal.cssAnimations.some((a) => a.anim === anim)) continue;
      anim.pause();
      anim.currentTime = t * 1000;
    }
    shotVisibility(t);
    for (const update of internal.updaters) update(t);
    for (const fn of internal.seekFns) fn(t);
    await Promise.all(
      internal.videos.map(
        ({ el: video, start }) =>
          new Promise<void>((resolve) => {
            const target = Math.max(0, t - start);
            if (Math.abs(video.currentTime - target) < 1e-4) return resolve();
            video.addEventListener("seeked", () => resolve(), { once: true });
            video.currentTime = target;
          }),
      ),
    );
    clock.flushRaf();
    await document.fonts.ready;
    await decodePending(stage);
    await nativeFrames(2);
  };
  handle.seek = seek;
  handle.meta = { fps: meta.fps, duration: meta.duration, width, height, format, scale };
  return video;
}

/** Register a <video> element so seek() drives it (it starts playing at `start`). */
export function registerVideoElement(video: HTMLVideoElement, start = 0): void {
  video.muted = true;
  video.pause();
  internal.videos.push({ el: video, start });
}
