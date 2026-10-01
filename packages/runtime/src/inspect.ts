import { gsap } from "gsap";
import { screens } from "./screen.ts";
import { internal, nextId } from "./state.ts";
import type { InspectResult, Rect, TextBox } from "./types.ts";

function toHex(color: string): string {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const p = m[1]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  return `#${p
    .slice(0, 3)
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")}${
    p.length > 3 && p[3]! < 1
      ? Math.round(p[3]! * 255)
          .toString(16)
          .padStart(2, "0")
      : ""
  }`;
}

function rel(r: DOMRect | Rect, origin: DOMRect): Rect {
  return { x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height };
}

function union(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width);
    y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

const opacityCache = new Map<Element, number>();

function effectiveOpacity(node: Element | null, stage: Element): number {
  if (!node) return 1;
  const cached = opacityCache.get(node);
  if (cached !== undefined) return cached;
  const style = getComputedStyle(node);
  let o = Number(style.opacity);
  if (style.visibility === "hidden" || style.display === "none") o = 0;
  const value = node === stage ? o : o * effectiveOpacity(node.parentElement, stage);
  opacityCache.set(node, value);
  return value;
}

function blockOf(node: Element): HTMLElement {
  let block = node as HTMLElement;
  while (block.parentElement && (block.dataset.dmSplit || getComputedStyle(block).display === "inline"))
    block = block.parentElement;
  return block;
}

function clipRectOf(node: Element, stage: Element): DOMRect | null {
  let current = node.parentElement;
  while (current && current !== stage) {
    const s = getComputedStyle(current);
    if (s.overflow !== "visible" || s.clipPath !== "none") return current.getBoundingClientRect();
    current = current.parentElement;
  }
  return null;
}

function texts(stage: HTMLElement, origin: DOMRect): TextBox[] {
  const groups = new Map<HTMLElement, Text[]>();
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style")) continue;
    const block = blockOf(parent);
    if (!groups.has(block)) groups.set(block, []);
    groups.get(block)!.push(node);
  }
  const out: TextBox[] = [];
  const range = document.createRange();
  for (const [block, nodes] of groups) {
    const rects: Rect[] = [];
    let weighted = 0;
    let total = 0;
    let visibleLen = 0;
    for (const node of nodes) {
      range.selectNodeContents(node);
      const len = node.nodeValue!.trim().length;
      const op = effectiveOpacity(node.parentElement, stage);
      weighted += op * len;
      total += len;
      if (op > 0.05) {
        visibleLen += len;
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(rel(r, origin));
      }
    }
    const bbox = union(rects);
    if (!bbox || visibleLen === 0) continue;
    const parent = nodes[0]!.parentElement!;
    const style = getComputedStyle(parent);
    const blockStyle = getComputedStyle(block);
    // Visual scale from the block (ancestor/own transforms), not from animated inline pieces inside it.
    const layoutW = block.offsetWidth || 0;
    const visualW = block.getBoundingClientRect().width;
    const scale = layoutW > 0 && visualW > 0 ? visualW / layoutW : 1;
    const fontSize = Math.round(Number.parseFloat(style.fontSize) * scale * 10) / 10;
    const text =
      (block.dataset.dmCounter
        ? block.dataset.dmCounterTo
        : block.getAttribute("aria-label") && block.dataset.dmText
          ? block.getAttribute("aria-label")
          : nodes.map((n) => n.nodeValue).join("")
      )
        ?.replace(/\s+/g, " ")
        .trim() ?? "";
    const clip = clipRectOf(block, stage);
    const clipRel = clip ? rel(clip, origin) : null;
    const outsideClip =
      clipRel !== null &&
      (bbox.x < clipRel.x - 1 ||
        bbox.y < clipRel.y - 1 ||
        bbox.x + bbox.width > clipRel.x + clipRel.width + 1 ||
        bbox.y + bbox.height > clipRel.y + clipRel.height + 1);
    const outsideStage =
      bbox.x < -1 || bbox.y < -1 || bbox.x + bbox.width > origin.width + 1 || bbox.y + bbox.height > origin.height + 1;
    const overflowing =
      (blockStyle.overflow !== "visible" || blockStyle.textOverflow === "ellipsis") &&
      (block.scrollWidth > block.clientWidth + 1 || block.scrollHeight > block.clientHeight + 1);
    block.dataset.dmTid ||= nextId("txt");
    const ui = Boolean(block.closest("[data-dm-ui], .dm-screen"));
    const caption = Boolean(block.closest("[data-dm-caption]"));
    out.push({
      id: block.dataset.dmTid,
      text,
      words: text.split(/\s+/).filter(Boolean).length,
      bbox,
      fontSize,
      fontFamily: style.fontFamily
        .split(",")[0]!
        .trim()
        .replace(/^["']|["']$/g, ""),
      fontWeight: Number(style.fontWeight) || 400,
      color: toHex(style.color),
      opacity: total > 0 ? weighted / total : 1,
      clipped: outsideClip || outsideStage,
      overflowing,
      ui,
      caption,
      counter: Boolean(block.dataset.dmCounter),
      role: block.closest("[data-dm-logo]") ? "logo" : block.closest("[data-dm-cta]") ? "cta" : "text",
    });
  }
  return out;
}

function describe(target: unknown): string {
  if (target instanceof Element)
    return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ""}${target.classList.length ? `.${[...target.classList].join(".")}` : ""}`;
  return String(target);
}

/** Registries plus visible text/layout at the current t (SPEC §12). */
export function inspect(): InspectResult {
  const v = internal.video;
  if (!v) throw new Error("demovie: inspect() before createVideo()");
  opacityCache.clear();
  const stage = v.stage;
  const origin = stage.getBoundingClientRect();
  const t = internal.t;
  const activeShots = internal.shots.filter((w) => t >= w.from && t < w.to);
  const registered = new Set(internal.cssAnimations.map((a) => a.anim));
  const children = gsap.globalTimeline.getChildren(false, true, true);
  const stray = children.filter((c) => c !== v.timeline && c.duration() > 0 && !(c as gsap.core.Timeline).getChildren);
  const strayTimelines = children.filter(
    (c) => c !== v.timeline && (c as gsap.core.Timeline).getChildren && c.duration() > 0,
  );
  const fonts = [...document.fonts];
  return {
    t,
    format: v.format,
    width: v.width,
    height: v.height,
    safe: v.safe,
    texts: texts(stage, origin),
    shots: internal.shots.map((w) => ({
      id: w.shot.id,
      start: w.shot.start,
      end: w.shot.end,
      kind: w.shot.kind,
      active: activeShots.includes(w),
      screens: screens.filter((s) => w.shot.el.contains(s.el)).length,
      window: [w.from, w.to] as [number, number],
    })),
    screens: screens.map((s) => {
      const r = rel(s.el.getBoundingClientRect(), origin);
      const vr = s.viewportEl.getBoundingClientRect();
      const cam = s.cameraAt(t);
      const cap = s.captureAt(t);
      const imageWidth = s.el.querySelector<HTMLImageElement>(".dm-screen__img")?.naturalWidth || cap.image.width;
      return {
        id: s.id,
        capture: cap.id,
        captures: s.captures().map((c) => c.id),
        bbox: r,
        visible: s.visible(),
        cameraScale: cam.s,
        upscale: (vr.width * cam.s * v.scale) / imageWidth,
      };
    }),
    cursor: [...stage.querySelectorAll<HTMLElement>(".dm-cursor")].map((c) => ({
      visible: c.dataset.visible === "1" && effectiveOpacity(c, stage) > 0.05,
      x: Number(c.dataset.x ?? -1),
      y: Number(c.dataset.y ?? -1),
    })),
    clicks: internal.clicks.map((c) => ({
      at: c.at,
      screen: c.screenId,
      elementId: c.elementId,
      point: c.point(),
      rect: c.rect(),
    })),
    highlights: internal.highlights
      .filter((h) => t >= h.from && t < h.to)
      .flatMap((h) => {
        const r = h.rect();
        return r ? [{ screen: h.screenId, elementId: h.elementId, rect: r }] : [];
      }),
    logos: [...stage.querySelectorAll<HTMLElement>("[data-dm-logo]")].map((l) => ({
      bbox: rel(l.getBoundingClientRect(), origin),
      visible: effectiveOpacity(l, stage) > 0.05,
    })),
    animations: {
      registered: internal.cssAnimations.length,
      unregistered: document
        .getAnimations()
        .filter((a) => !registered.has(a))
        .map((a) => ({
          name: (a as CSSAnimation).animationName ?? a.id ?? "animation",
          target: describe((a.effect as KeyframeEffect | null)?.target),
        })),
    },
    strayTweens: [...stray, ...strayTimelines].map((c) => ({
      targets: ((c as gsap.core.Tween).targets?.() ?? []).map(describe).join(", ") || "timeline",
      duration: c.duration(),
    })),
    timersAfterReady: window.__DEMOVIE_CLOCK__?.timersAfterReady.length ?? 0,
    console: [...internal.console],
    fonts: {
      declared: [...internal.declaredFonts],
      loaded: [...new Set(fonts.filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, "")))],
      failed: [...new Set(fonts.filter((f) => f.status === "error").map((f) => f.family.replace(/^["']|["']$/g, "")))],
    },
    images: {
      broken: [...stage.querySelectorAll("img")]
        .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute("src"))
        .map((img) => img.getAttribute("src")!),
    },
    transitions: [...internal.transitions],
  };
}
