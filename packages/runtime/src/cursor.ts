import { asInternal, easeFn, type ScreenHandle, type ScreenInternal } from "./screen.ts";
import { clamp01, el, internal } from "./state.ts";
import type { Video } from "./types.ts";

export interface CursorHandle {
  moveTo(
    s: ScreenHandle,
    elementId: string,
    o: { at: number; duration?: number; ease?: string; anchor?: "center" | [number, number] },
  ): void;
  click(o: { at: number; ripple?: boolean }): void;
  show(o: { at: number }): void;
  hide(o: { at: number }): void;
}

type Pt = { x: number; y: number };

interface Move {
  at: number;
  duration: number;
  ease: (p: number) => number;
  screen: ScreenInternal;
  elementId: string;
  anchor: [number, number];
}

const SVG: Record<string, { svg: string; tip: [number, number]; size: number }> = {
  mac: {
    size: 28,
    tip: [3, 2],
    svg: '<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><path d="M3 2 L3 22 L8.6 16.9 L12.4 25.4 L16 23.8 L12.3 15.5 L19.6 15.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  },
  pointer: {
    size: 30,
    tip: [11, 2],
    svg: '<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><path d="M11 2.5c1.4 0 2.4 1 2.4 2.4v8.2l1-.2c1.3-.2 2.3.6 2.5 1.8l.1.5 1-.2c1.2-.2 2.3.6 2.5 1.8l.1.4.8-.1c1.3-.2 2.4.8 2.4 2.1v4.6c0 3.4-2.8 6.2-6.2 6.2h-3.8c-2 0-3.9-1-5-2.7L5 20.6c-.7-1.1-.4-2.6.7-3.3 1-.6 2.3-.4 3 .5l.9 1.2V4.9c0-1.4 1-2.4 2.4-2.4z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  },
  dot: {
    size: 26,
    tip: [13, 13],
    svg: '<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="13" r="10" fill="rgba(17,17,17,.35)" stroke="#fff" stroke-width="2.5"/></svg>',
  },
};

/** A truthful cursor: every target comes from an element map, and it follows the screen's camera (SPEC §10.3). */
export function cursor(v: Video, o: { style?: "mac" | "pointer" | "dot"; size?: number } = {}): CursorHandle {
  const kind = SVG[o.style ?? "mac"]!;
  const size = o.size ?? Math.round(kind.size * Math.max(1, v.unit / 10.8) * 1.25);
  const scale = size / kind.size;
  const root = el("div", "dm-cursor", v.stage);
  root.innerHTML = kind.svg;
  root.style.width = `${size}px`;
  root.style.height = `${size}px`;
  root.dataset.dmUi = "1";
  const ripples: { at: number; node: HTMLElement }[] = [];
  const moves: Move[] = [];
  const clicks: { at: number; ripple: boolean }[] = [];
  const visibility: { at: number; visible: boolean }[] = [];

  const anchorPoint = (m: Move, t: number): Pt => {
    const r = m.screen.liveRect(m.elementId, t);
    if (!r) return { x: v.width / 2, y: v.height / 2 };
    return { x: r.x + r.width * m.anchor[0], y: r.y + r.height * m.anchor[1] };
  };

  /** Where the tip is at time t: glides along a curve between anchors, then sticks to the element. */
  const tipAt = (t: number): Pt | null => {
    const sorted = moves;
    const firstIdx = sorted.findIndex((m) => t < m.at + m.duration);
    const current = firstIdx === -1 ? sorted[sorted.length - 1] : sorted[firstIdx];
    if (!current) return null;
    if (firstIdx === -1 || t < current.at) {
      // Resting: at the last finished move, or (before the first move) waiting off the target.
      const prev = firstIdx === -1 ? current : sorted[firstIdx - 1];
      if (prev) return anchorPoint(prev, t);
      const target = anchorPoint(current, t);
      return { x: target.x + v.width * 0.12, y: target.y + v.height * 0.16 };
    }
    const prev = sorted[firstIdx - 1];
    const end = anchorPoint(current, t);
    const start = prev ? anchorPoint(prev, t) : { x: end.x + v.width * 0.12, y: end.y + v.height * 0.16 };
    const p = current.ease(clamp01((t - current.at) / current.duration));
    // Quadratic Bézier with a control point off the straight line: a natural, consistent arc.
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(160, len * 0.2);
    const cx = (start.x + end.x) / 2 + (-dy / len) * bend;
    const cy = (start.y + end.y) / 2 + (dx / len) * bend;
    const q = 1 - p;
    return { x: q * q * start.x + 2 * q * p * cx + p * p * end.x, y: q * q * start.y + 2 * q * p * cy + p * p * end.y };
  };

  const visibleAt = (t: number): boolean => {
    let visible = false;
    if (moves[0] && t >= moves[0].at) visible = true;
    for (const vis of visibility) if (t >= vis.at) visible = vis.visible;
    return visible;
  };

  internal.updaters.push((t) => {
    const tip = tipAt(t);
    const visible = Boolean(tip) && visibleAt(t);
    root.style.visibility = visible ? "inherit" : "hidden";
    root.dataset.visible = visible ? "1" : "0";
    if (!tip) return;
    let press = 1;
    for (const c of clicks) {
      const d = t - c.at;
      if (d >= -0.08 && d < 0.22) press = Math.min(press, 1 - 0.14 * Math.sin(clamp01((d + 0.08) / 0.3) * Math.PI));
    }
    root.style.transform = `translate(${tip.x - kind.tip[0] * scale}px, ${tip.y - kind.tip[1] * scale}px) scale(${press})`;
    root.style.transformOrigin = `${kind.tip[0] * scale}px ${kind.tip[1] * scale}px`;
    root.dataset.x = tip.x.toFixed(1);
    root.dataset.y = tip.y.toFixed(1);
    for (const r of ripples) {
      const d = t - r.at;
      const live = d >= 0 && d < 0.55;
      r.node.style.visibility = live ? "inherit" : "hidden";
      if (!live) continue;
      const p = easeFn("power2.out")(clamp01(d / 0.55));
      const where = tipAt(r.at) ?? tip;
      const rs = 18 + 46 * p;
      Object.assign(r.node.style, {
        left: `${where.x - rs / 2}px`,
        top: `${where.y - rs / 2}px`,
        width: `${rs}px`,
        height: `${rs}px`,
        opacity: String(0.55 * (1 - p)),
      });
    }
  });

  return {
    moveTo(s, elementId, opts) {
      const screen = asInternal(s);
      screen.findAt(elementId, opts.at + (opts.duration ?? 0.8)); // validates the id now, with a helpful error
      const prev = moves[moves.length - 1];
      let duration = opts.duration;
      if (duration === undefined) {
        const a = prev ? screen.rect(prev.elementId) : null;
        const b = screen.rect(elementId);
        const dist = a ? Math.hypot(a.x - b.x, a.y - b.y) : 400;
        duration = Math.min(1.1, Math.max(0.5, 0.45 + dist / 1800));
      }
      const anchor: [number, number] = opts.anchor === undefined || opts.anchor === "center" ? [0.5, 0.5] : opts.anchor;
      moves.push({ at: opts.at, duration, ease: easeFn(opts.ease, "power2.inOut"), screen, elementId, anchor });
      moves.sort((a, b) => a.at - b.at);
    },
    click(opts) {
      clicks.push({ at: opts.at, ripple: opts.ripple !== false });
      if (opts.ripple !== false) {
        const node = el("div", "dm-ripple", v.stage);
        node.dataset.dmUi = "1";
        ripples.push({ at: opts.at, node });
      }
      // The target is the element of the latest move that starts before the click (QA DM-G01).
      const target = [...moves].filter((m) => m.at <= opts.at).pop();
      internal.clicks.push({
        at: opts.at,
        screenId: target?.screen.id ?? "",
        elementId: target?.elementId ?? "",
        point: () => tipAt(opts.at) ?? { x: -1, y: -1 },
        rect: () => (target ? target.screen.liveRect(target.elementId, opts.at) : null),
      });
    },
    show(opts) {
      visibility.push({ at: opts.at, visible: true });
      visibility.sort((a, b) => a.at - b.at);
    },
    hide(opts) {
      visibility.push({ at: opts.at, visible: false });
      visibility.sort((a, b) => a.at - b.at);
    },
  };
}
