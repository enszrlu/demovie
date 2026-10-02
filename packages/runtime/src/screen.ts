import { gsap } from "gsap";
import { findElement, getCapture } from "./captures.ts";
import { clamp01, el, internal, nextId } from "./state.ts";
import type { CaptureElement, CaptureState, Rect, Video } from "./types.ts";

export type Device = "browser" | "laptop" | "phone" | "tablet" | "none";

export interface ScreenOptions {
  capture: string;
  parent?: HTMLElement;
  device?: Device;
  width?: number;
  image?: "screen" | "full";
  shadow?: boolean;
  tilt?: { x: number; y: number };
  /** Top-left position in stage px (default: centered in the safe area). */
  x?: number;
  y?: number;
}

interface Cam {
  s: number;
  x: number;
  y: number;
}

interface Segment<T> {
  at: number;
  duration: number;
  ease: (p: number) => number;
  to: T;
}

interface Layer {
  capture: CaptureState;
  img: HTMLImageElement;
  at: number;
  duration: number;
  transition: "cut" | "crossfade" | "slide-left" | "slide-up";
}

export interface ScreenHandle {
  id: string;
  el: HTMLElement;
  capture: CaptureState;
  /**
   * Rect of an element in stage px at the screen's base transform (no camera, no user tweens). With several ids, the
   * box around all of them, e.g. a column heading and its last card.
   */
  rect(...elementIds: [string, ...string[]]): Rect;
  focus(
    target: string | Rect,
    o: { at: number; duration?: number; scale?: number; padding?: number; ease?: string },
  ): void;
  reset(o: { at: number; duration?: number; ease?: string }): void;
  highlight(elementId: string, o: { at: number; duration?: number; style?: "ring" | "glow" | "dim-others" }): void;
  swap(
    capture: string,
    o: { at: number; duration?: number; transition?: "cut" | "crossfade" | "slide-left" | "slide-up" },
  ): void;
  scroll(to: number | string, o: { at: number; duration?: number; ease?: string }): void;
}

/** Internal API used by cursor, typeText, callout and inspect. */
export interface ScreenInternal extends ScreenHandle {
  device: Device;
  /** Content-to-stage scale at base transform (stage px per capture CSS px). */
  k: number;
  displayWidth: number;
  displayHeight: number;
  viewportEl: HTMLElement;
  contentEl: HTMLElement;
  overlayEl: HTMLElement;
  /** The capture shown at time t (the latest swap that has started). */
  captureAt(t: number): CaptureState;
  captures(): CaptureState[];
  findAt(elementId: string, t: number): { capture: CaptureState; element: CaptureElement };
  cameraAt(t: number): Cam;
  scrollAt(t: number): number;
  /** Live rect of an element in stage px under the current transforms (call after seek updates). */
  liveRect(elementId: string, t: number): Rect | null;
  /** Map a content point (capture CSS px) to stage px under the current transforms. */
  livePoint(p: { x: number; y: number }, t: number): { x: number; y: number };
  visible(): boolean;
}

export const screens: ScreenInternal[] = [];

const easeCache = new Map<string, (p: number) => number>();
export function easeFn(name: string | undefined, fallback = "power3.inOut"): (p: number) => number {
  const key = name ?? fallback;
  if (!easeCache.has(key))
    easeCache.set(key, (gsap.parseEase(key) as ((p: number) => number) | undefined) ?? ((p: number) => p));
  return easeCache.get(key)!;
}

function chrome(
  device: Device,
  w: number,
): { top: number; bottom: number; side: number; radius: number; inner: number } {
  switch (device) {
    case "browser":
      return { top: Math.max(30, Math.round(w * 0.034)), bottom: 0, side: 0, radius: Math.round(w * 0.012), inner: 0 };
    case "laptop":
      return {
        top: Math.round(w * 0.03),
        bottom: Math.round(w * 0.075),
        side: Math.round(w * 0.03),
        radius: Math.round(w * 0.022),
        inner: Math.round(w * 0.004),
      };
    case "phone":
      return {
        top: Math.round(w * 0.045),
        bottom: Math.round(w * 0.045),
        side: Math.round(w * 0.045),
        radius: Math.round(w * 0.16),
        inner: Math.round(w * 0.12),
      };
    case "tablet":
      return {
        top: Math.round(w * 0.045),
        bottom: Math.round(w * 0.045),
        side: Math.round(w * 0.045),
        radius: Math.round(w * 0.06),
        inner: Math.round(w * 0.025),
      };
    default:
      return { top: 0, bottom: 0, side: 0, radius: 0, inner: 0 };
  }
}

function hostOf(brandUrl: string | null): string {
  if (!brandUrl) return "";
  try {
    return new URL(brandUrl.includes("://") ? brandUrl : `https://${brandUrl}`).host;
  } catch {
    return brandUrl;
  }
}

function interp(a: Cam, b: Cam, p: number): Cam {
  return { s: a.s + (b.s - a.s) * p, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

/** Show a real capture inside a CSS-drawn device frame (SPEC §10.3). */
export function screen(v: Video, o: ScreenOptions): ScreenHandle {
  const capture = getCapture(o.capture);
  const device = o.device ?? "browser";
  const image = o.image ?? "screen";
  if (image === "full" && !capture.fullUrl)
    throw new Error(`demovie: capture "${capture.id}" has no full.png (capture it with --full-page)`);
  const cw = capture.viewport.width;
  const ch = capture.viewport.height;
  const aspect = ch / cw;
  const availW = v.width - v.safe.left - v.safe.right;
  const availH = v.height - v.safe.top - v.safe.bottom;
  // Solve for the display width that fits the frame (chrome scales with width) inside the safe area.
  const probe = chrome(device, 1000);
  const perW = { x: 1 + (2 * probe.side) / 1000, y: aspect + (probe.top + probe.bottom) / 1000 };
  const fitW = Math.floor(Math.min(availW / perW.x, availH / perW.y));
  const W = Math.round(o.width ?? fitW);
  const H = Math.round(W * aspect);
  const c = chrome(device, W);
  const frameW = W + 2 * c.side;
  const frameH = H + c.top + c.bottom;
  const k = W / cw;
  const contentH = image === "full" ? Math.round((capture.fullPage!.height / cw) * W) : H;

  const id = nextId("screen");
  const root = el("div", "dm-screen", o.parent ?? v.stage);
  root.dataset.device = device;
  root.dataset.screen = id;
  const left = o.x ?? Math.round((v.width - frameW) / 2);
  const top = o.y ?? Math.round(v.safe.top + (availH - frameH) / 2);
  Object.assign(root.style, { left: `${left}px`, top: `${top}px`, width: `${frameW}px`, height: `${frameH}px` });
  if (o.tilt) root.style.transform = `perspective(2400px) rotateX(${o.tilt.x}deg) rotateY(${o.tilt.y}deg)`;
  if (o.shadow === false) root.classList.add("dm-screen--flat");

  const frame = el("div", "dm-screen__frame", root);
  frame.style.borderRadius = `${c.radius}px`;
  frame.style.padding = `${c.top}px ${c.side}px ${c.bottom}px`;
  let urlBox: HTMLElement | null = null;
  const urlFor = (cap: CaptureState) => {
    const host = hostOf(v.brand.url);
    return `${host}${cap.path === "/" && host ? "" : cap.path}`;
  };
  if (device === "browser") {
    const bar = el("div", "dm-screen__bar", frame);
    bar.style.height = `${c.top}px`;
    const dots = el("div", "dm-screen__dots", bar);
    for (let i = 0; i < 3; i++) el("span", "", dots);
    urlBox = el("div", "dm-screen__url", bar);
    urlBox.dataset.dmUi = "1";
    urlBox.textContent = urlFor(capture);
    urlBox.style.fontSize = `${Math.max(11, Math.round(c.top * 0.42))}px`;
  }
  if (device === "laptop") {
    const base = el("div", "dm-screen__base", root);
    base.style.height = `${Math.round(W * 0.028)}px`;
  }
  if (device === "phone") {
    const island = el("div", "dm-screen__island", frame);
    Object.assign(island.style, {
      width: `${Math.round(W * 0.3)}px`,
      height: `${Math.round(W * 0.085)}px`,
      top: `${c.top + Math.round(W * 0.03)}px`,
    });
  }
  const viewport = el("div", "dm-screen__viewport", frame);
  Object.assign(viewport.style, { width: `${W}px`, height: `${H}px`, borderRadius: `${c.inner}px` });
  const content = el("div", "dm-screen__content", viewport);
  Object.assign(content.style, { width: `${W}px`, height: `${contentH}px` });
  const overlay = el("div", "dm-screen__overlay", content);
  overlay.dataset.dmUi = "1";

  const makeLayer = (cap: CaptureState): HTMLImageElement => {
    const img = el("img", "dm-screen__img");
    img.src = image === "full" ? (cap.fullUrl ?? cap.screenUrl) : cap.screenUrl;
    img.alt = "";
    img.draggable = false;
    img.style.width = `${W}px`;
    content.insertBefore(img, overlay);
    return img;
  };
  const layers: Layer[] = [
    { capture, img: makeLayer(capture), at: Number.NEGATIVE_INFINITY, duration: 0, transition: "cut" },
  ];
  const camera: Segment<Cam>[] = [];
  const scrolls: Segment<number>[] = [];

  const captureAt = (t: number): CaptureState => {
    let current = layers[0]!.capture;
    for (const layer of layers) if (t >= layer.at) current = layer.capture;
    return current;
  };
  const findAt = (elementId: string, t: number) => {
    const preferred = captureAt(t);
    const hit = preferred.elements.find((e) => e.id === elementId);
    if (hit) return { capture: preferred, element: hit };
    for (const layer of layers) {
      const other = layer.capture.elements.find((e) => e.id === elementId);
      if (other) return { capture: layer.capture, element: other };
    }
    return { capture: preferred, element: findElement(preferred, elementId) };
  };
  const evaluate = <T>(segments: Segment<T>[], start: T, mix: (a: T, b: T, p: number) => T, t: number): T => {
    let current = start;
    for (const seg of segments) {
      if (t < seg.at) break;
      if (t >= seg.at + seg.duration || seg.duration <= 0) current = seg.to;
      else return mix(current, seg.to, seg.ease((t - seg.at) / seg.duration));
    }
    return current;
  };
  const cameraAt = (t: number): Cam => evaluate(camera, { s: 1, x: 0, y: 0 }, interp, t);
  const scrollAt = (t: number): number => evaluate(scrolls, 0, (a, b, p) => a + (b - a) * p, t);
  const toContent = (r: Rect): Rect => ({ x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k });

  const livePoint = (p: { x: number; y: number }, t: number) => {
    const cam = cameraAt(t);
    const scroll = scrollAt(t);
    const vr = viewport.getBoundingClientRect();
    const sr = v.stage.getBoundingClientRect();
    const sx = vr.width / W;
    const sy = vr.height / H;
    const lx = cam.x + cam.s * p.x * k;
    const ly = cam.y + cam.s * (p.y * k - scroll);
    return { x: vr.left - sr.left + lx * sx, y: vr.top - sr.top + ly * sy };
  };

  const handle: ScreenInternal = {
    id,
    el: root,
    capture,
    device,
    k,
    displayWidth: W,
    displayHeight: H,
    viewportEl: viewport,
    contentEl: content,
    overlayEl: overlay,
    captureAt,
    captures: () => layers.map((l) => l.capture),
    findAt,
    cameraAt,
    scrollAt,
    livePoint,
    liveRect(elementId: string, t: number) {
      const { element } = findAt(elementId, t);
      const a = livePoint({ x: element.bbox.x, y: element.bbox.y }, t);
      const b = livePoint({ x: element.bbox.x + element.bbox.width, y: element.bbox.y + element.bbox.height }, t);
      return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
    },
    visible() {
      const style = getComputedStyle(root);
      if (style.visibility === "hidden" || style.display === "none") return false;
      let node: HTMLElement | null = root;
      while (node) {
        const s = getComputedStyle(node);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.02) return false;
        node = node.parentElement;
      }
      return true;
    },
    rect(...elementIds: [string, ...string[]]): Rect {
      const boxes = elementIds.map((id) => findAt(id, 0).element.bbox);
      const x = Math.min(...boxes.map((b) => b.x));
      const y = Math.min(...boxes.map((b) => b.y));
      const right = Math.max(...boxes.map((b) => b.x + b.width));
      const bottom = Math.max(...boxes.map((b) => b.y + b.height));
      return { x: left + c.side + x * k, y: top + c.top + y * k, width: (right - x) * k, height: (bottom - y) * k };
    },
    focus(target, opts) {
      const t = opts.at;
      const duration = opts.duration ?? 0.9;
      // A Rect is in stage px at the base transform (the space of rect()); element ids come from the element map.
      const r =
        typeof target === "string"
          ? toContent(findAt(target, t + duration).element.bbox)
          : { x: target.x - (left + c.side), y: target.y - (top + c.top), width: target.width, height: target.height };
      const pad = opts.padding ?? 32;
      const s = Math.max(1, opts.scale ?? Math.min(W / (r.width + 2 * pad), H / (r.height + 2 * pad), 2.2));
      const scroll = scrollAt(t + duration);
      let x = W / 2 - (r.x + r.width / 2) * s;
      let y = H / 2 - (r.y + r.height / 2 - scroll) * s;
      x = Math.min(0, Math.max(W - W * s, x));
      y = Math.min(scroll * s, Math.max(H - (contentH - scroll) * s, y));
      y = Math.min(0, y);
      camera.push({ at: t, duration, ease: easeFn(opts.ease, "power3.inOut"), to: { s, x, y } });
      camera.sort((a, b) => a.at - b.at);
    },
    reset(opts) {
      camera.push({
        at: opts.at,
        duration: opts.duration ?? 0.8,
        ease: easeFn(opts.ease, "power3.inOut"),
        to: { s: 1, x: 0, y: 0 },
      });
      camera.sort((a, b) => a.at - b.at);
    },
    highlight(elementId, opts) {
      const duration = opts.duration ?? 1.5;
      const style = opts.style ?? "ring";
      const { element } = findAt(elementId, opts.at);
      const r = toContent(element.bbox);
      const box = el("div", `dm-highlight dm-highlight--${style}`, overlay);
      const pad = 6;
      Object.assign(box.style, {
        left: `${r.x - pad}px`,
        top: `${r.y - pad}px`,
        width: `${r.width + 2 * pad}px`,
        height: `${r.height + 2 * pad}px`,
        borderRadius: `${element.style.radius * k + pad}px`,
      });
      const from = opts.at;
      const to = opts.at + duration;
      internal.highlights.push({
        screenId: id,
        elementId,
        from,
        to,
        rect: () => handle.liveRect(elementId, internal.t),
      });
      internal.updaters.push((tt) => {
        const fade = 0.25;
        const o = tt < from || tt >= to ? 0 : Math.min(clamp01((tt - from) / fade), clamp01((to - tt) / fade));
        box.style.opacity = String(o);
        box.style.transform = `scale(${0.96 + 0.04 * o})`;
      });
    },
    swap(captureId, opts) {
      const cap = getCapture(captureId);
      if (Math.abs(cap.viewport.width - cw) > 1 || Math.abs(cap.viewport.height - ch) > 1) {
        internal.console.push({
          level: "warn",
          text: `swap: ${captureId} has a different viewport than ${capture.id}; element maps may not line up`,
        });
      }
      layers.push({
        capture: cap,
        img: makeLayer(cap),
        at: opts.at,
        duration: opts.duration ?? (opts.transition === "cut" ? 0 : 0.5),
        transition: opts.transition ?? "crossfade",
      });
      layers.sort((a, b) => a.at - b.at);
    },
    scroll(to, opts) {
      const target = typeof to === "number" ? to * k : Math.max(0, findAt(to, opts.at).element.bbox.y * k - H * 0.2);
      const maxScroll = Math.max(0, contentH - H);
      scrolls.push({
        at: opts.at,
        duration: opts.duration ?? 1.2,
        ease: easeFn(opts.ease, "power2.inOut"),
        to: Math.min(maxScroll, Math.max(0, target)),
      });
      scrolls.sort((a, b) => a.at - b.at);
    },
  };

  // Per-seek: camera transform and capture layers (pure functions of t).
  internal.updaters.push((t) => {
    // The browser bar shows the path of the capture on screen.
    if (urlBox) {
      const url = urlFor(captureAt(t));
      if (urlBox.textContent !== url) urlBox.textContent = url;
      root.dataset.url = url;
    }
    const cam = cameraAt(t);
    const scroll = scrollAt(t);
    content.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s}) translate(0px, ${-scroll}px)`;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!;
      const next = layers[i + 1];
      let opacity = t >= layer.at ? 1 : 0;
      let transform = "none";
      if (layer.at > Number.NEGATIVE_INFINITY && t >= layer.at && layer.duration > 0 && t < layer.at + layer.duration) {
        const p = easeFn("power2.inOut")((t - layer.at) / layer.duration);
        if (layer.transition === "crossfade") opacity = p;
        if (layer.transition === "slide-left") transform = `translateX(${(1 - p) * W}px)`;
        if (layer.transition === "slide-up") transform = `translateY(${(1 - p) * H}px)`;
      }
      if (next && t >= next.at) {
        const done = next.duration <= 0 || t >= next.at + next.duration;
        if (done || next.transition === "cut") opacity = 0;
        else if (next.transition === "slide-left")
          transform = `translateX(${-easeFn("power2.inOut")((t - next.at) / next.duration) * W}px)`;
        else if (next.transition === "slide-up")
          transform = `translateY(${-easeFn("power2.inOut")((t - next.at) / next.duration) * H}px)`;
      }
      layer.img.style.opacity = String(opacity);
      layer.img.style.transform = transform;
      layer.img.style.visibility = opacity > 0 ? "inherit" : "hidden";
    }
  });
  screens.push(handle);
  return handle;
}

export function screenById(id: string): ScreenInternal | undefined {
  return screens.find((s) => s.id === id);
}

export function asInternal(s: ScreenHandle): ScreenInternal {
  const found = screens.find((x) => x.id === s.id);
  if (!found) throw new Error("demovie: not a screen() handle");
  return found;
}
