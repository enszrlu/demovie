import { asInternal, easeFn, type ScreenHandle } from "./screen.ts";
import { clamp01, el, internal, requireVideo } from "./state.ts";
import type { Rect, Shot, Video } from "./types.ts";

/** Overlay typed text in the input's captured font and box (SPEC §10.3). */
export function typeText(
  s: ScreenHandle,
  elementId: string,
  text: string,
  o: { at: number; cps?: number; caret?: boolean },
): void {
  const screen = asInternal(s);
  const { element } = screen.findAt(elementId, o.at);
  const k = screen.k;
  const b = element.bbox;
  const st = element.style;
  const box = el("div", "dm-typed", screen.overlayEl);
  box.dataset.dmUi = "1";
  const inset = 2;
  Object.assign(box.style, {
    left: `${(b.x + inset) * k}px`,
    top: `${(b.y + inset) * k}px`,
    width: `${(b.width - 2 * inset) * k}px`,
    height: `${(b.height - 2 * inset) * k}px`,
    background: st.background ?? "#ffffff",
    borderRadius: `${Math.max(0, st.radius - inset) * k}px`,
    paddingLeft: `${Math.max(0, (st.paddingLeft ?? 12) - inset) * k}px`,
    fontFamily: `"${st.fontFamily}", var(--dm-font-body)`,
    fontSize: `${st.fontSize * k}px`,
    fontWeight: String(st.fontWeight),
    color: st.color,
    lineHeight: `${(b.height - 2 * inset) * k}px`,
  });
  const textNode = el("span", "dm-typed__text", box);
  const caret = el("span", "dm-typed__caret", box);
  caret.style.height = `${st.fontSize * k * 1.15}px`;
  caret.style.background = st.color;
  const cps = o.cps ?? 16;
  const done = o.at + text.length / cps;
  const onCapture = screen.captureAt(o.at).id;
  internal.updaters.push((t) => {
    // The typed overlay belongs to the capture it was typed into; it disappears when the screen swaps away.
    const visible = t >= o.at - 0.05 && screen.captureAt(t).id === onCapture;
    box.style.visibility = visible ? "inherit" : "hidden";
    const n = Math.max(0, Math.min(text.length, Math.floor((t - o.at) * cps + 1e-6)));
    textNode.textContent = text.slice(0, n);
    const typing = t >= o.at && t < done;
    const blinkOn = Math.floor((t - done) / 0.53) % 2 === 0;
    caret.style.visibility =
      o.caret === false || !visible || (!typing && !blinkOn) || t > done + 1.6 ? "hidden" : "inherit";
  });
}

type RevealFrom = "below" | "fade" | "blur" | "mask";

function split(target: HTMLElement, by: "char" | "word" | "line"): HTMLElement[] {
  const text = target.textContent ?? "";
  target.textContent = "";
  target.dataset.dmText = "1";
  target.setAttribute("aria-label", text);
  const words = text.split(/(\s+)/);
  const pieces: HTMLElement[] = [];
  for (const part of words) {
    if (/^\s+$/.test(part)) {
      target.appendChild(document.createTextNode(part));
      continue;
    }
    const word = el("span", "dm-word", target);
    word.dataset.dmSplit = "1";
    if (by === "char") {
      for (const ch of part) {
        const span = el("span", "dm-char", word);
        span.dataset.dmSplit = "1";
        span.textContent = ch;
        pieces.push(span);
      }
    } else {
      word.textContent = part;
      pieces.push(word);
    }
  }
  if (by !== "line") return pieces;
  // Group words into lines by their offsetTop (fonts are loaded before setup runs).
  const lines: HTMLElement[][] = [];
  let lastTop = Number.NaN;
  for (const w of pieces) {
    if (w.offsetTop !== lastTop) {
      lines.push([]);
      lastTop = w.offsetTop;
    }
    lines[lines.length - 1]!.push(w);
  }
  target.textContent = "";
  return lines.map((line, i) => {
    const wrap = el("span", "dm-line", target);
    wrap.dataset.dmSplit = "1";
    const inner = el("span", "dm-line__inner", wrap);
    inner.dataset.dmSplit = "1";
    inner.textContent = line.map((w) => w.textContent).join(" ");
    if (i < lines.length - 1) target.appendChild(document.createTextNode(" "));
    return inner;
  });
}

export const text = {
  /** Staggered reveal of a text element by char, word or line. */
  reveal(
    target: HTMLElement,
    o: {
      at: number;
      by?: "char" | "word" | "line";
      stagger?: number;
      duration?: number;
      ease?: string;
      from?: RevealFrom;
    },
  ): void {
    const v = requireVideo();
    const by = o.by ?? "word";
    const from = o.from ?? "below";
    const pieces = split(target, by);
    if (from === "mask") for (const p of pieces) p.parentElement?.classList.add("dm-mask");
    const start: gsap.TweenVars =
      from === "below"
        ? { yPercent: 60, opacity: 0 }
        : from === "blur"
          ? { filter: "blur(12px)", opacity: 0 }
          : from === "mask"
            ? { yPercent: 105 }
            : { opacity: 0 };
    const end: gsap.TweenVars =
      from === "below"
        ? { yPercent: 0, opacity: 1 }
        : from === "blur"
          ? { filter: "blur(0px)", opacity: 1 }
          : from === "mask"
            ? { yPercent: 0 }
            : { opacity: 1 };
    v.timeline.fromTo(
      pieces,
      { ...start },
      {
        ...end,
        duration: o.duration ?? 0.7,
        ease: o.ease ?? "expo.out",
        stagger: o.stagger ?? (by === "char" ? 0.022 : by === "word" ? 0.06 : 0.12),
        immediateRender: true,
      },
      o.at,
    );
  },
  /** Count from → to. Values must come from the brief, seed data or captures (QA DM-G04 checks the final value). */
  counter(
    target: HTMLElement,
    o: { at: number; from: number; to: number; duration: number; format?: Intl.NumberFormatOptions },
  ): void {
    const fmt = new Intl.NumberFormat("en-US", o.format ?? { maximumFractionDigits: 0 });
    target.dataset.dmCounter = "1";
    target.dataset.dmCounterTo = fmt.format(o.to);
    const ease = easeFn("power2.out");
    internal.updaters.push((t) => {
      const p = ease(clamp01((t - o.at) / o.duration));
      target.textContent = fmt.format(o.from + (o.to - o.from) * p);
    });
  },
};

/** A labelled pointer next to a real element (stage overlay; follows the camera). */
export function callout(
  s: ScreenHandle,
  elementId: string,
  o: { label: string; at: number; duration: number; side?: "top" | "right" | "bottom" | "left" },
): void {
  const v = requireVideo();
  const screen = asInternal(s);
  screen.findAt(elementId, o.at);
  const layer = el("div", "dm-callout", v.stage);
  const label = el("div", "dm-callout__label", layer);
  label.textContent = o.label;
  const line = el("div", "dm-callout__line", layer);
  const dot = el("div", "dm-callout__dot", layer);
  internal.updaters.push((t) => {
    const fade = 0.3;
    const op =
      t < o.at || t >= o.at + o.duration
        ? 0
        : Math.min(clamp01((t - o.at) / fade), clamp01((o.at + o.duration - t) / fade));
    layer.style.opacity = String(op);
    layer.style.visibility = op > 0 ? "inherit" : "hidden";
    if (op <= 0) return;
    const r = screen.liveRect(elementId, t);
    if (!r) return;
    const lw = label.offsetWidth;
    const lh = label.offsetHeight;
    const gap = v.unit * 4.5;
    let side = o.side;
    if (!side) {
      if (r.x + r.width + gap + lw < v.width - v.safe.right) side = "right";
      else if (r.x - gap - lw > v.safe.left) side = "left";
      else if (r.y - gap - lh > v.safe.top) side = "top";
      else side = "bottom";
    }
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    let lx = cx - lw / 2;
    let ly = cy - lh / 2;
    let ax = cx;
    let ay = cy;
    if (side === "right") {
      lx = r.x + r.width + gap;
      ax = r.x + r.width;
    } else if (side === "left") {
      lx = r.x - gap - lw;
      ax = r.x;
    } else if (side === "top") {
      ly = r.y - gap - lh;
      ay = r.y;
    } else {
      ly = r.y + r.height + gap;
      ay = r.y + r.height;
    }
    lx = Math.min(Math.max(lx, v.safe.left), v.width - v.safe.right - lw);
    ly = Math.min(Math.max(ly, v.safe.top), v.height - v.safe.bottom - lh);
    const slide = (1 - op) * v.unit * 1.2;
    label.style.transform = `translate(${lx + (side === "right" ? slide : side === "left" ? -slide : 0)}px, ${ly + (side === "bottom" ? slide : side === "top" ? -slide : 0)}px)`;
    const tx = side === "right" ? lx : side === "left" ? lx + lw : lx + lw / 2;
    const ty = side === "top" ? ly + lh : side === "bottom" ? ly : ly + lh / 2;
    const len = Math.hypot(tx - ax, ty - ay);
    const angle = Math.atan2(ty - ay, tx - ax);
    Object.assign(line.style, { width: `${len}px`, transform: `translate(${ax}px, ${ay}px) rotate(${angle}rad)` });
    dot.style.transform = `translate(${ax - 5}px, ${ay - 5}px)`;
  });
}

/** Burned-in captions from the voice manifest (SPEC §11.5). Only burns in for formats in video.json `captions.burnIn`. */
export function captions(
  v: Video,
  o: { style?: "clean" | "bold" | "karaoke"; position?: "bottom" | "top" } = {},
): void {
  const lines = v.voice?.lines ?? [];
  const cfg = v.meta.captions ?? {};
  if (cfg.enabled === false || lines.length === 0) return;
  const burnIn = cfg.burnIn ?? ["9:16"];
  if (!burnIn.includes(v.format)) return;
  const style = o.style ?? "clean";
  const box = el("div", `dm-captions dm-captions--${style} dm-captions--${o.position ?? "bottom"}`, v.stage);
  box.dataset.dmCaption = "1";
  const textEl = el("div", "dm-captions__text", box);
  textEl.dataset.dmCaption = "1";
  internal.updaters.push((t) => {
    const line = lines.find((l) => t >= l.start && t < l.start + l.duration);
    box.style.visibility = line ? "inherit" : "hidden";
    if (!line) return;
    if (style === "karaoke" && line.words.length) {
      textEl.innerHTML = "";
      for (const w of line.words) {
        const span = el("span", "dm-captions__word", textEl);
        span.dataset.dmCaption = "1";
        span.textContent = `${w.text} `;
        if (t >= line.start + w.start) span.classList.add("is-spoken");
      }
    } else if (textEl.textContent !== line.text) {
      textEl.textContent = line.text;
    }
  });
}

function windowOf(shot: Shot) {
  const w = internal.shots.find((x) => x.shot === shot);
  if (!w) throw new Error(`demovie: transition needs shots created with v.shot() (got "${shot.id}")`);
  return w;
}

function overlapWindows(a: Shot, b: Shot, at: number, duration: number): void {
  const wa = windowOf(a);
  const wb = windowOf(b);
  wa.to = Math.max(wa.to, at + duration);
  wb.from = Math.min(wb.from, at);
  internal.transitions.push({ at, end: at + duration, kind: "transition" });
}

/** Transitions between Shot containers (SPEC §10.3). */
export const transition = {
  crossfade(a: Shot, b: Shot, o: { at: number; duration?: number }): void {
    const v = requireVideo();
    const d = o.duration ?? 0.6;
    overlapWindows(a, b, o.at, d);
    v.timeline.fromTo(
      b.el,
      { opacity: 0 },
      { opacity: 1, duration: d, ease: "power1.inOut", immediateRender: false },
      o.at,
    );
    v.timeline.fromTo(
      a.el,
      { opacity: 1 },
      { opacity: 0, duration: d, ease: "power1.inOut", immediateRender: false },
      o.at,
    );
  },
  wipe(a: Shot, b: Shot, o: { at: number; duration?: number; direction?: "left" | "right" | "up" | "down" }): void {
    const v = requireVideo();
    const d = o.duration ?? 0.7;
    overlapWindows(a, b, o.at, d);
    const dir = o.direction ?? "left";
    const hidden = {
      left: "inset(0 0 0 100%)",
      right: "inset(0 100% 0 0)",
      up: "inset(100% 0 0 0)",
      down: "inset(0 0 100% 0)",
    }[dir];
    b.el.style.zIndex = String(Number(a.el.style.zIndex || 0) + 1);
    v.timeline.fromTo(
      b.el,
      { clipPath: hidden },
      { clipPath: "inset(0 0 0 0)", duration: d, ease: "power3.inOut", immediateRender: false },
      o.at,
    );
  },
  push(a: Shot, b: Shot, o: { at: number; duration?: number; direction?: "left" | "right" | "up" | "down" }): void {
    const v = requireVideo();
    const d = o.duration ?? 0.7;
    overlapWindows(a, b, o.at, d);
    const dir = o.direction ?? "left";
    const axis = dir === "left" || dir === "right" ? "xPercent" : "yPercent";
    const sign = dir === "left" || dir === "up" ? -1 : 1;
    v.timeline.fromTo(
      a.el,
      { [axis]: 0 },
      { [axis]: sign * 100, duration: d, ease: "power3.inOut", immediateRender: false },
      o.at,
    );
    v.timeline.fromTo(
      b.el,
      { [axis]: -sign * 100 },
      { [axis]: 0, duration: d, ease: "power3.inOut", immediateRender: false },
      o.at,
    );
  },
  zoomThrough(a: Shot, b: Shot, o: { at: number; duration?: number; target?: Rect }): void {
    const v = requireVideo();
    const d = o.duration ?? 0.8;
    overlapWindows(a, b, o.at, d);
    const target = o.target ?? { x: v.width / 2 - 1, y: v.height / 2 - 1, width: 2, height: 2 };
    const origin = `${target.x + target.width / 2}px ${target.y + target.height / 2}px`;
    v.timeline.fromTo(
      a.el,
      { scale: 1, opacity: 1, transformOrigin: origin },
      { scale: 5, opacity: 0, duration: d, ease: "power3.in", immediateRender: false },
      o.at,
    );
    v.timeline.fromTo(
      b.el,
      { scale: 0.92, opacity: 0 },
      { scale: 1, opacity: 1, duration: d * 0.6, ease: "power3.out", immediateRender: false },
      o.at + d * 0.4,
    );
  },
  colorFlash(a: Shot, b: Shot, o: { at: number; duration?: number; color?: string }): void {
    const v = requireVideo();
    const d = o.duration ?? 0.5;
    const wa = windowOf(a);
    const wb = windowOf(b);
    wa.to = Math.max(wa.to, o.at + d / 2);
    wb.from = Math.min(wb.from, o.at + d / 2);
    internal.transitions.push({ at: o.at, end: o.at + d, kind: "colorFlash" });
    const flash = el("div", "dm-flash", v.stage);
    flash.style.background = o.color ?? "var(--dm-primary)";
    v.timeline.fromTo(
      flash,
      { opacity: 0 },
      { opacity: 1, duration: d / 2, ease: "power2.in", immediateRender: true },
      o.at,
    );
    v.timeline.to(flash, { opacity: 0, duration: d / 2, ease: "power2.out" }, o.at + d / 2);
  },
};

/** The brand logo (wordmark or mark) with a soft entrance at `at`. */
export function logo(v: Video, o: { at: number; variant?: "mark" | "wordmark"; parent?: HTMLElement }): HTMLElement {
  const variant = o.variant ?? (v.brand.logo.wordmark ? "wordmark" : "mark");
  const src =
    variant === "wordmark"
      ? (v.brand.logo.wordmark ?? v.brand.logo.mark)
      : (v.brand.logo.mark ?? v.brand.logo.wordmark);
  const wrap = el("div", `dm-logo dm-logo--${variant}`, o.parent ?? v.stage);
  wrap.dataset.dmLogo = "1";
  const url = src ? `/${src.replace(/^\/+/, "")}` : null;
  const svg = url?.endsWith(".svg") ? (svgCache.get(url) ?? null) : null;
  if (svg) {
    // Inline SVG so <text> in a wordmark uses the registered brand fonts (an <img> can't see page fonts).
    wrap.innerHTML = svg;
    wrap.querySelector("svg")?.classList.add("dm-logo__img");
    wrap.querySelector("svg")?.setAttribute("role", "img");
  } else if (url) {
    const img = el("img", "dm-logo__img", wrap);
    img.src = url;
    img.alt = v.brand.name;
  } else {
    wrap.textContent = v.brand.name;
    wrap.classList.add("dm-logo--text");
  }
  v.timeline.fromTo(
    wrap,
    { opacity: 0, y: v.unit * 2, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "expo.out", immediateRender: true },
    o.at,
  );
  return wrap;
}

const svgCache = new Map<string, string>();

/** Fetch SVG logos up front (createVideo) so logo() can inline them synchronously. */
export async function preloadLogos(files: (string | null)[]): Promise<void> {
  await Promise.all(
    files
      .filter((f): f is string => Boolean(f?.endsWith(".svg")))
      .map(async (file) => {
        const url = `/${file.replace(/^\/+/, "")}`;
        const res = await fetch(url).catch(() => null);
        if (!res?.ok) return;
        const text = await res.text();
        if (text.includes("<svg"))
          svgCache.set(url, text.replace(/<\?xml[^>]*>/, "").replace(/<script[\s\S]*?<\/script>/gi, ""));
      }),
  );
}
