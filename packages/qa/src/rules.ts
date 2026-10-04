import { contrastRatio, parseColor, type Rect, TYPE_PRESETS } from "@demovie/core";
import type { InspectData, InspectText, Occurrence, QaInputs, Rule, RuleOutcome, Sample } from "./types.ts";
import { COMMON, capitalizedTerms, numbers } from "./vocabulary.ts";

const PROVENANCE_OK = new Set(["demovie-synth", "demovie-sfx", "demovie-mix", "elevenlabs", "openai", "user-licensed"]);
/** DM-R01: share of visibly different pixels a frame may have between renders (Chromium raster noise; D145). */
export const DETERMINISM_VISIBLE_RATIO = 0.0001;
const GENERIC_CHIPS =
  /^(done|saved|success|successful|completed|complete|synced|all set|great job|yay|live|ok|okay|confirmed|approved|✓|✔|✅)[.!]?$/i;
const HUD = [
  { re: /\b\d{1,2}:\d{2}(?::\d{2})?(?:[:.;]\d{2,3})?\b/, what: "timecode" },
  { re: /\b\d{2,3}\s?BPM\b|\bBPM\b/i, what: "BPM label" },
  { re: /\bframe\s*#?\s*\d+/i, what: '"frame N" label' },
  { re: /\b(?:REC|LIVE)\b\s*[●•]?|[●•]\s*(?:REC|LIVE)\b/, what: "HUD recording badge" },
  { re: /\b(?:FPS|ISO|f\/\d)\b\s*\d*/i, what: "camera HUD readout" },
  { re: /\bv\d+\.\d+\.\d+\b.*\bbuild\b/i, what: "build/version HUD" },
];

/** Visible non-UI text: opacity above 0.3 and on stage. */
function isVisible(t: InspectText, s: InspectData): boolean {
  if (t.ui || t.opacity < 0.3) return false;
  const b = t.bbox;
  return b.x + b.width > 0 && b.y + b.height > 0 && b.x < s.width && b.y < s.height;
}

function inTransition(s: InspectData, t: number): boolean {
  return s.transitions.some((tr) => t >= tr.at - 0.05 && t <= tr.end + 0.05);
}

function area(r: Rect): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

function intersect(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function fullyOutside(r: Rect, s: InspectData): boolean {
  return r.x + r.width <= 0 || r.y + r.height <= 0 || r.x >= s.width || r.y >= s.height;
}

function outsideSafe(r: Rect, s: InspectData): boolean {
  const tol = 1;
  return (
    r.x < s.safe.left - tol ||
    r.y < s.safe.top - tol ||
    r.x + r.width > s.width - s.safe.right + tol ||
    r.y + r.height > s.height - s.safe.bottom + tol
  );
}

interface Hit {
  key: string;
  detail: string;
  bbox?: Rect;
  severity?: "error" | "warn";
}

/** Report a violation only when it holds for `minSeconds` of consecutive samples (filters entrance/transition frames). */
function persistent(input: QaInputs, minSeconds: number, fn: (s: Sample) => Hit[]): Occurrence[] {
  const need = Math.max(1, Math.round(minSeconds * input.sampleFps));
  const runs = new Map<string, { count: number; first: Sample; hit: Hit; occurrence: Occurrence | null }>();
  const out: Occurrence[] = [];
  const seenThisFrame = new Set<string>();
  for (const s of input.samples) {
    seenThisFrame.clear();
    for (const hit of fn(s)) {
      seenThisFrame.add(hit.key);
      const run = runs.get(hit.key);
      if (run) run.count++;
      else runs.set(hit.key, { count: 1, first: s, hit, occurrence: null });
      const r = runs.get(hit.key)!;
      if (!r.occurrence && r.count >= need) {
        r.occurrence = {
          t: round(r.first.t),
          until: round(s.t),
          detail: r.hit.detail,
          ...(r.hit.bbox ? { bbox: r.hit.bbox } : {}),
          ...(r.hit.severity ? { severity: r.hit.severity } : {}),
        };
        out.push(r.occurrence);
      } else if (r.occurrence) {
        r.occurrence.until = round(s.t);
      }
    }
    for (const key of [...runs.keys()]) if (!seenThisFrame.has(key)) runs.delete(key);
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
const shortSide = (s: InspectData) => Math.min(s.width, s.height);
const quote = (text: string) => `"${text.length > 48 ? `${text.slice(0, 45)}…` : text}"`;

function lastSample(input: QaInputs): InspectData | null {
  return input.samples[input.samples.length - 1]?.inspect ?? null;
}

function pixelAt(p: NonNullable<Sample["pixels"]>, x: number, y: number): [number, number, number] | null {
  const px = Math.round(x * p.scale);
  const py = Math.round(y * p.scale);
  if (px < 0 || py < 0 || px >= p.width || py >= p.height) return null;
  const i = (py * p.width + px) * 4;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!];
}

/** Median color of a ring just outside a text box. */
export function ringBackground(
  p: NonNullable<Sample["pixels"]>,
  r: Rect,
  gap = 5,
): { r: number; g: number; b: number } | null {
  const pts: [number, number, number][] = [];
  const step = 6;
  const x0 = r.x - gap;
  const y0 = r.y - gap;
  const x1 = r.x + r.width + gap;
  const y1 = r.y + r.height + gap;
  for (let x = x0; x <= x1; x += step) {
    for (const y of [y0, y1]) {
      const c = pixelAt(p, x, y);
      if (c) pts.push(c);
    }
  }
  for (let y = y0; y <= y1; y += step) {
    for (const x of [x0, x1]) {
      const c = pixelAt(p, x, y);
      if (c) pts.push(c);
    }
  }
  if (pts.length < 4) return null;
  const med = (i: 0 | 1 | 2) => {
    const v = pts.map((c) => c[i]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)]!;
  };
  return { r: med(0), g: med(1), b: med(2) };
}

/** Share of the frame covered by its most common color (5-bit quantized). */
export function dominantShare(p: NonNullable<Sample["pixels"]>): number {
  const counts = new Map<number, number>();
  const total = p.width * p.height;
  let best = 0;
  for (let i = 0; i < p.data.length; i += 4 * 3) {
    const key = ((p.data[i]! >> 3) << 10) | ((p.data[i + 1]! >> 3) << 5) | (p.data[i + 2]! >> 3);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > best) best = n;
  }
  return best / Math.ceil(total / 3);
}

function nonUiTexts(input: QaInputs): { text: InspectText; t: number }[] {
  const seen = new Map<string, { text: InspectText; t: number }>();
  for (const s of input.samples) {
    for (const t of s.inspect.texts) {
      if (!isVisible(t, s.inspect)) continue;
      const key = `${t.id}|${t.text}`;
      if (!seen.has(key)) seen.set(key, { text: t, t: s.t });
    }
  }
  return [...seen.values()];
}

const ok = (): RuleOutcome => ({ occurrences: [] });

export const RULES: Rule[] = [
  {
    id: "DM-T01",
    severity: "error",
    title: "Text stays on screen long enough to read",
    measurement: "Each distinct non-UI text block is continuously visible for ≥ 0.5 + words/3 s and ≥ 1.2 s",
    fix: "hold the text longer (or cut words): give it at least 0.5 s + 1/3 s per word, and never less than 1.2 s",
    check(input) {
      const dt = 1 / input.sampleFps;
      const runs = new Map<string, { start: number; last: number; text: InspectText }[]>();
      for (const s of input.samples) {
        for (const t of s.inspect.texts) {
          if (t.caption || !isVisible(t, s.inspect)) continue;
          const key = t.counter ? t.id : `${t.id}|${t.text}`;
          const list = runs.get(key) ?? [];
          const current = list[list.length - 1];
          if (current && s.t - current.last <= dt * 1.5 + 1e-6) current.last = s.t;
          else list.push({ start: s.t, last: s.t, text: t });
          runs.set(key, list);
        }
      }
      const out: Occurrence[] = [];
      for (const list of runs.values()) {
        for (const run of list) {
          const shown = run.last - run.start + dt;
          const need = Math.max(1.2, 0.5 + run.text.words / 3);
          if (shown + dt * 0.5 < need) {
            out.push({
              t: round(run.start),
              bbox: run.text.bbox,
              detail: `${quote(run.text.text)} is readable for ${shown.toFixed(1)} s; ${run.text.words} words need ${need.toFixed(1)} s`,
            });
          }
        }
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-T02",
    severity: "error",
    title: "Minimum text size",
    measurement: "Font size ≥ 3.0% of the frame's short side (captions ≥ 3.8%), at scale 1",
    fix: "set the font size to at least 3% of the frame's short side (calc(var(--dm-unit) * 3)); captions need 3.8%",
    check(input) {
      return {
        occurrences: persistent(input, 0.3, (s) =>
          s.inspect.texts
            .filter((t) => isVisible(t, s.inspect) && t.role !== "logo")
            .flatMap((t) => {
              const min = shortSide(s.inspect) * (t.caption ? 0.038 : 0.03);
              return t.fontSize + 0.05 < min
                ? [
                    {
                      key: t.id,
                      bbox: t.bbox,
                      detail: `${quote(t.text)} is ${t.fontSize.toFixed(1)} px; minimum is ${min.toFixed(1)} px`,
                    },
                  ]
                : [];
            }),
        ),
      };
    },
  },
  {
    id: "DM-T03",
    severity: "error",
    title: "No text overflow or clipping",
    measurement: "scrollWidth > clientWidth, or the text box extends beyond its container or the stage",
    fix: "shorten the copy, let it wrap (max-width in ch), or enlarge the container so no glyph is cut",
    check(input) {
      return {
        occurrences: persistent(input, 0.3, (s) =>
          inTransition(s.inspect, s.t)
            ? []
            : s.inspect.texts
                .filter((t) => isVisible(t, s.inspect) && (t.clipped || t.overflowing))
                .map((t) => ({
                  key: t.id,
                  bbox: t.bbox,
                  detail: `${quote(t.text)} is ${t.overflowing ? "overflowing its box" : "clipped by its container or the stage"}`,
                })),
        ),
      };
    },
  },
  {
    id: "DM-T04",
    severity: "error",
    title: "Contrast",
    measurement: "WCAG ratio of text color vs. a sampled background ring: < 4.5 warns, < 3.0 errors",
    fix: "darken/lighten the text or its background (brand fg on bg), or put the text on a solid panel",
    check(input) {
      return {
        occurrences: persistent(input, 0.2, (s) => {
          const p = s.pixels;
          if (!p) return [];
          const hits: Hit[] = [];
          for (const t of s.inspect.texts) {
            if (!isVisible(t, s.inspect) || t.opacity < 0.95 || t.role === "logo") continue;
            const bg = ringBackground(p, t.bbox);
            const fg = parseColor(t.color);
            if (!bg || !fg) continue;
            const blended =
              fg.a < 1
                ? {
                    r: fg.r * fg.a + bg.r * (1 - fg.a),
                    g: fg.g * fg.a + bg.g * (1 - fg.a),
                    b: fg.b * fg.a + bg.b * (1 - fg.a),
                  }
                : fg;
            const ratio = contrastRatio(blended, bg);
            if (ratio < 4.5) {
              hits.push({
                key: `${t.id}|${ratio < 3 ? "e" : "w"}`,
                bbox: t.bbox,
                severity: ratio < 3 ? "error" : "warn",
                detail: `${quote(t.text)} contrast ${ratio.toFixed(2)}:1 (${t.color} on ~#${[bg.r, bg.g, bg.b].map((v) => v.toString(16).padStart(2, "0")).join("")})`,
              });
            }
          }
          return hits;
        }),
      };
    },
  },
  {
    id: "DM-T05",
    severity: "warn",
    title: "Too much text at once",
    measurement: "More than 2 non-UI text blocks, or more than 18 words, visible at once",
    fix: "show one idea at a time: at most 2 text blocks and 18 words on screen together",
    check(input) {
      return {
        occurrences: persistent(input, 0.3, (s) => {
          const visible = s.inspect.texts.filter((t) => isVisible(t, s.inspect) && t.role !== "logo");
          const wordsOnScreen = visible.reduce((n, t) => n + t.words, 0);
          return visible.length > 2 || wordsOnScreen > 18
            ? [{ key: "too-much", detail: `${visible.length} text blocks, ${wordsOnScreen} words on screen` }]
            : [];
        }),
      };
    },
  },
  {
    id: "DM-L01",
    severity: "error",
    title: "Safe area",
    measurement: "Non-UI text, logos and the CTA stay inside the format's safe area",
    fix: "move it inside the safe area: position with var(--dm-safe-top/right/bottom/left), check with `preview` safe guides",
    check(input) {
      return {
        occurrences: persistent(input, 0.3, (s) => {
          if (inTransition(s.inspect, s.t)) return [];
          const hits: Hit[] = [];
          for (const t of s.inspect.texts) {
            if (isVisible(t, s.inspect) && outsideSafe(t.bbox, s.inspect))
              hits.push({
                key: t.id,
                bbox: t.bbox,
                detail: `${quote(t.text)} leaves the ${s.inspect.format} safe area`,
              });
          }
          s.inspect.logos.forEach((l, i) => {
            if (l.visible && !fullyOutside(l.bbox, s.inspect) && outsideSafe(l.bbox, s.inspect))
              hits.push({ key: `logo${i}`, bbox: l.bbox, detail: "the logo leaves the safe area" });
          });
          return hits;
        }),
      };
    },
  },
  {
    id: "DM-L02",
    severity: "error",
    title: "Overlaps",
    measurement:
      "Two visible non-UI text boxes intersect by more than 5% of the smaller one, or text covers a highlighted product element",
    fix: "give each text block its own space, and keep text off the element you highlight",
    check(input) {
      return {
        occurrences: persistent(input, 0.3, (s) => {
          if (inTransition(s.inspect, s.t)) return [];
          const visible = s.inspect.texts.filter((t) => isVisible(t, s.inspect));
          const hits: Hit[] = [];
          for (let i = 0; i < visible.length; i++) {
            for (let j = i + 1; j < visible.length; j++) {
              const a = visible[i]!;
              const b = visible[j]!;
              if (intersect(a.bbox, b.bbox) > 0.05 * Math.min(area(a.bbox), area(b.bbox))) {
                hits.push({
                  key: `${a.id}x${b.id}`,
                  bbox: a.bbox,
                  detail: `${quote(a.text)} overlaps ${quote(b.text)}`,
                });
              }
            }
            for (const h of s.inspect.highlights) {
              const a = visible[i]!;
              if (intersect(a.bbox, h.rect) > 0.05 * Math.min(area(a.bbox), area(h.rect))) {
                hits.push({
                  key: `${a.id}x${h.elementId}`,
                  bbox: a.bbox,
                  detail: `${quote(a.text)} covers the highlighted ${h.elementId}`,
                });
              }
            }
          }
          return hits;
        }),
      };
    },
  },
  {
    id: "DM-L03",
    severity: "warn",
    title: "Off-stage leftovers",
    measurement: "Visible elements sit fully outside the stage for more than 1 s",
    fix: "hide or remove elements once they leave the stage (set opacity 0 or end their shot)",
    check(input) {
      return {
        occurrences: persistent(input, 1.0, (s) => {
          const hits: Hit[] = [];
          for (const t of s.inspect.texts)
            if (!t.ui && t.opacity >= 0.3 && fullyOutside(t.bbox, s.inspect))
              hits.push({ key: t.id, bbox: t.bbox, detail: `${quote(t.text)} is visible but off stage` });
          for (const sc of s.inspect.screens)
            if (sc.visible && fullyOutside(sc.bbox, s.inspect))
              hits.push({ key: sc.id, bbox: sc.bbox, detail: `screen ${sc.capture} is visible but off stage` });
          s.inspect.logos.forEach((l, i) => {
            if (l.visible && fullyOutside(l.bbox, s.inspect))
              hits.push({ key: `logo${i}`, bbox: l.bbox, detail: "a logo is visible but off stage" });
          });
          return hits;
        }),
      };
    },
  },
  {
    id: "DM-P01",
    severity: "error",
    title: "Shot pacing",
    measurement:
      "Warn when the average shot length is below the type floor; error when more than 4 consecutive shots are under 0.8 s",
    fix: "merge or lengthen shots: keep the average above the type's floor and never cut more than 4 times in a row under 0.8 s",
    check(input) {
      const shots = [...(input.samples[0]?.inspect.shots ?? [])].sort((a, b) => a.start - b.start);
      if (shots.length === 0) return ok();
      const out: Occurrence[] = [];
      const floor = TYPE_PRESETS[input.video.type].shotFloor;
      const avg = shots.reduce((n, s) => n + (s.end - s.start), 0) / shots.length;
      if (avg < floor)
        out.push({
          t: 0,
          severity: "warn",
          detail: `average shot ${avg.toFixed(2)} s is below the ${input.video.type} floor of ${floor} s`,
        });
      let run: typeof shots = [];
      for (const s of shots) {
        if (s.end - s.start < 0.8) run.push(s);
        else run = [];
        if (run.length === 5)
          out.push({
            t: round(run[0]!.start),
            severity: "error",
            detail: `${run.length}+ consecutive shots under 0.8 s (${run.map((r) => r.id).join(", ")})`,
          });
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-P02",
    severity: "error",
    title: "Duration",
    measurement: "Within the type's range, and equal to video.json.duration ± 1 frame",
    fix: "set video.json duration inside the type's range, and end the last shot exactly at the duration",
    check(input) {
      const { duration, type, fps } = input.video;
      const [lo, hi] = TYPE_PRESETS[type].range;
      const out: Occurrence[] = [];
      if (duration < lo || duration > hi)
        out.push({ t: 0, detail: `${duration} s is outside the ${type} range ${lo}–${hi} s` });
      const shots = input.samples[0]?.inspect.shots ?? [];
      const end = shots.reduce((m, s) => Math.max(m, s.end), 0);
      if (shots.length && Math.abs(end - duration) > 1 / fps + 1e-6)
        out.push({ t: round(end), detail: `the last shot ends at ${end.toFixed(2)} s; video.json says ${duration} s` });
      return { occurrences: out };
    },
  },
  {
    id: "DM-P03",
    severity: "warn",
    title: "End hold",
    measurement: "The final logo/CTA shot is visible for ≥ 1.5 s",
    fix: "end on a logo + CTA shot held for at least 1.5 s",
    check(input) {
      const shots = [...(input.samples[0]?.inspect.shots ?? [])].sort((a, b) => a.end - b.end);
      const last = shots[shots.length - 1];
      if (!last) return ok();
      const end = lastSample(input);
      const hasCta = Boolean(
        end?.texts.some((t) => t.role === "cta" && isVisible(t, end)) || end?.logos.some((l) => l.visible),
      );
      const hold = last.end - Math.max(last.start, last.window[0]);
      const out: Occurrence[] = [];
      if (last.kind !== "logo" && !hasCta)
        out.push({ t: round(last.start), detail: `the final shot "${last.id}" shows no logo or CTA` });
      else if (hold < 1.5) out.push({ t: round(last.start), detail: `the final shot holds ${hold.toFixed(2)} s` });
      return { occurrences: out };
    },
  },
  {
    id: "DM-P04",
    severity: "error",
    title: "Shots declared",
    measurement: "At least 1 shot, and the shots cover the full duration with no gap over 0.5 s",
    fix: "declare shots with v.shot(id, start, end) covering the whole video",
    check(input) {
      const shots = input.samples[0]?.inspect.shots ?? [];
      if (shots.length === 0) return { occurrences: [{ t: 0, detail: "no shots declared (use v.shot())" }] };
      const intervals = shots
        .map((s) => [Math.min(s.start, s.window[0]), Math.max(s.end, s.window[1])] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      const out: Occurrence[] = [];
      let cursor = 0;
      for (const [a, b] of intervals) {
        if (a - cursor > 0.5)
          out.push({ t: round(cursor), detail: `no shot covers ${cursor.toFixed(2)}–${a.toFixed(2)} s` });
        cursor = Math.max(cursor, b);
      }
      if (input.video.duration - cursor > 0.5)
        out.push({ t: round(cursor), detail: `no shot covers ${cursor.toFixed(2)}–${input.video.duration} s` });
      return { occurrences: out };
    },
  },
  {
    id: "DM-P05",
    severity: "error",
    title: "Seamless loop (hero-loop only)",
    measurement: "First vs. last frame pixel diff < 2%",
    fix: "make the end state equal the start state (camera reset, same text and positions) so the loop is invisible",
    check(input) {
      if (input.video.type !== "hero-loop") return { occurrences: [], skipped: "not a hero-loop" };
      if (!input.loop) return { occurrences: [], skipped: "loop frames not rendered" };
      return input.loop.diffRatio >= 0.02
        ? {
            occurrences: [
              {
                t: input.video.duration,
                detail: `first and last frames differ by ${(input.loop.diffRatio * 100).toFixed(1)}%`,
              },
            ],
          }
        : ok();
    },
  },
  {
    id: "DM-G01",
    severity: "error",
    title: "Truthful cursor",
    measurement: "Every cursor click lands inside its target element's rect under the current screen transform",
    fix: "move the cursor to the element (cursor.moveTo(screen, id)) so it arrives before the click, and click while the element is on screen",
    check(input) {
      const out: Occurrence[] = [];
      for (const c of input.clicks) {
        if (!c.elementId) {
          out.push({ t: round(c.at), detail: "click without a target: call cursor.moveTo() before cursor.click()" });
          continue;
        }
        if (!c.rect) {
          out.push({ t: round(c.at), detail: `click target ${c.elementId} is not on screen` });
          continue;
        }
        const r = c.rect;
        const inside =
          c.point.x >= r.x - 1 &&
          c.point.x <= r.x + r.width + 1 &&
          c.point.y >= r.y - 1 &&
          c.point.y <= r.y + r.height + 1;
        if (!inside)
          out.push({
            t: round(c.at),
            bbox: r,
            detail: `click at (${c.point.x.toFixed(0)}, ${c.point.y.toFixed(0)}) misses ${c.elementId}`,
          });
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-G02",
    severity: "warn",
    title: "Invented vocabulary",
    measurement: "Capitalized terms in non-UI text that aren't in the glossary, the brief or captured UI text",
    fix: "use the product's own words (.demovie/glossary.md), or add the term to the brief/glossary if it is real",
    check(input) {
      const out: Occurrence[] = [];
      const reported = new Set<string>();
      for (const { text, t } of nonUiTexts(input)) {
        for (const term of capitalizedTerms(text.text)) {
          const lower = term.toLowerCase();
          if (reported.has(lower) || COMMON.has(lower) || input.vocabulary.words.has(lower)) continue;
          reported.add(lower);
          out.push({
            t: round(t),
            bbox: text.bbox,
            detail: `"${term}" isn't in the glossary, the brief or captured UI text`,
          });
        }
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-G03",
    severity: "error",
    title: "Product shots use captures",
    measurement: 'Every kind: "product" shot contains at least one screen()',
    fix: 'show product UI only with screen(v, { capture: "<id>", parent: shot.el }) — never draw or mock it',
    check(input) {
      const shots = input.samples[0]?.inspect.shots ?? [];
      return {
        occurrences: shots
          .filter((s) => s.kind === "product" && s.screens === 0)
          .map((s) => ({ t: round(s.start), detail: `product shot "${s.id}" contains no screen()` })),
      };
    },
  },
  {
    id: "DM-G04",
    severity: "warn",
    title: "Invented numbers",
    measurement: "Numbers in non-UI text that aren't in the brief, the glossary or captured UI text",
    fix: "only show numbers from the brief, seed data or captures; put the source in the brief if it is real",
    check(input) {
      const out: Occurrence[] = [];
      const reported = new Set<string>();
      for (const { text, t } of nonUiTexts(input)) {
        for (const n of numbers(text.text)) {
          if (reported.has(n) || input.vocabulary.numbers.has(n)) continue;
          reported.add(n);
          out.push({
            t: round(t),
            bbox: text.bbox,
            detail: `"${n}" isn't in the brief, the glossary or captured UI text`,
          });
        }
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-G05",
    severity: "error",
    title: "Upscaled captures",
    measurement: "A screen displayed above 1.0× its native pixel density warns; above 1.5× errors (blurry)",
    fix: "zoom less, show the screen smaller, or capture at a higher deviceScaleFactor",
    check(input) {
      const worst = new Map<string, { t: number; upscale: number; bbox: Rect; capture: string }>();
      for (const s of input.samples) {
        for (const sc of s.inspect.screens) {
          if (!sc.visible) continue;
          const prev = worst.get(sc.id);
          if (!prev || sc.upscale > prev.upscale)
            worst.set(sc.id, { t: s.t, upscale: sc.upscale, bbox: sc.bbox, capture: sc.capture });
        }
      }
      const out: Occurrence[] = [];
      for (const w of worst.values()) {
        if (w.upscale > 1.0 + 1e-3) {
          out.push({
            t: round(w.t),
            bbox: w.bbox,
            severity: w.upscale > 1.5 ? "error" : "warn",
            detail: `${w.capture} is shown at ${w.upscale.toFixed(2)}× its pixel density`,
          });
        }
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-A01",
    severity: "error",
    title: "Fonts",
    measurement: "Declared brand and fallback fonts are loaded; no silent fallback to system fonts",
    fix: "check brand.json font files exist under .demovie/brand/fonts and use var(--dm-font-heading/body/mono)",
    check(input) {
      const last = lastSample(input);
      if (!last) return ok();
      const loaded = new Set(last.fonts.loaded.map((f) => f.toLowerCase()));
      const out: Occurrence[] = [];
      for (const f of last.fonts.failed) out.push({ t: 0, detail: `font ${f} failed to load` });
      // A missing font that text renders in is a silent fallback (error); one no text uses only warns.
      const used = new Set(nonUiTexts(input).map(({ text }) => text.fontFamily.toLowerCase()));
      for (const f of last.fonts.declared)
        if (!loaded.has(f.toLowerCase()))
          out.push(
            used.has(f.toLowerCase())
              ? { t: 0, detail: `declared font ${f} is not loaded` }
              : {
                  t: 0,
                  detail: `declared font ${f} is not loaded, but no text in this video uses it, so nothing falls back (fine to leave)`,
                  severity: "warn",
                },
          );
      const reported = new Set<string>();
      for (const { text, t } of nonUiTexts(input)) {
        const fam = text.fontFamily.toLowerCase();
        if (loaded.has(fam) || reported.has(fam)) continue;
        reported.add(fam);
        out.push({
          t: round(t),
          bbox: text.bbox,
          detail: `${quote(text.text)} renders in "${text.fontFamily}", which isn't a loaded brand or fallback font`,
        });
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-A02",
    severity: "error",
    title: "Assets",
    measurement: "Any 4xx/5xx response, or a broken image or video",
    fix: "fix the path (composition-relative, /brand/*, /captures/*, /assets/*, /audio/*) or remove the reference",
    check(input) {
      const out: Occurrence[] = input.network.failed.map((f) => ({ t: 0, detail: `${f.status ?? "failed"} ${f.url}` }));
      const broken = new Set(input.samples.flatMap((s) => s.inspect.images.broken));
      for (const b of broken) out.push({ t: 0, detail: `broken image ${b}` });
      return { occurrences: out };
    },
  },
  {
    id: "DM-A03",
    severity: "error",
    title: "Network",
    measurement: "Any blocked external request",
    fix: "serve everything locally: copy the file into the composition folder or `npx demovie add` it",
    check(input) {
      return {
        occurrences: [...new Set(input.network.blocked)].map((url) => ({
          t: 0,
          detail: `external request blocked: ${url}`,
        })),
      };
    },
  },
  {
    id: "DM-A04",
    severity: "error",
    title: "Audio provenance",
    measurement:
      "An audio file that has no provenance.json entry from a demovie generator, a configured provider, or add --licensed",
    fix: "generate audio with `npx demovie audio music|voice|mix`, or import it with `npx demovie add <file> --licensed`",
    check(input) {
      const entries = new Map(input.audio.provenance.map((e) => [e.file, e]));
      const out: Occurrence[] = [];
      for (const f of input.audio.files) {
        const e = entries.get(f);
        if (!e) out.push({ t: 0, detail: `${f} has no provenance.json entry` });
        else if (!PROVENANCE_OK.has(e.generator)) out.push({ t: 0, detail: `${f} comes from "${e.generator}"` });
      }
      return { occurrences: out };
    },
  },
  {
    id: "DM-R01",
    severity: "error",
    title: "Determinism",
    measurement: `5 sampled frames, rendered at full size on two fresh pages in different seek orders (the second time right after the frame before each), look the same: at most ${DETERMINISM_VISIBLE_RATIO * 100}% of pixels differ visibly (pixelmatch threshold 0.1)`,
    fix: "derive everything from t: no Date/timers/real randomness, put tweens in v.timeline, make onSeek pure, and avoid will-change on animated elements",
    check(input) {
      if (!input.determinism) return { occurrences: [], skipped: "not checked" };
      return {
        occurrences: input.determinism.mismatches
          .filter((m) => m.visibleRatio > DETERMINISM_VISIBLE_RATIO)
          .map((m) => ({
            t: round(m.t),
            detail: `frame differs visibly in ${(m.visibleRatio * 100).toFixed(3)}% of pixels between seek orders (largest change ${m.maxDelta} of 255)`,
          })),
      };
    },
  },
  {
    id: "DM-R02",
    severity: "warn",
    title: "Blank frames",
    measurement: "Frames that are over 98% one color for more than 0.3 s, outside declared transitions",
    fix: "start content earlier, overlap shots with a transition, or add a background element",
    check(input) {
      return {
        occurrences: persistent(input, 0.31, (s) =>
          s.pixels && !inTransition(s.inspect, s.t) && dominantShare(s.pixels) > 0.98
            ? [{ key: "blank", detail: "frame is more than 98% one color" }]
            : [],
        ),
      };
    },
  },
  {
    id: "DM-R03",
    severity: "error",
    title: "Stray GSAP tweens",
    measurement: "Tweens outside v.timeline",
    fix: "add every tween to v.timeline (v.timeline.to/from/fromTo(..., at)), never gsap.to() directly",
    check(input) {
      const stray = new Map<string, number>();
      for (const s of input.samples) for (const t of s.inspect.strayTweens) stray.set(t.targets, t.duration);
      return {
        occurrences: [...stray].map(([targets, d]) => ({
          t: 0,
          detail: `a ${d}s tween on ${targets} is outside v.timeline`,
        })),
      };
    },
  },
  {
    id: "DM-R04",
    severity: "warn",
    title: "Unregistered CSS animations",
    measurement: "Running CSS animations not registered via v.css",
    fix: "drive CSS keyframes with v.css(el, keyframes, { start, duration }) so they follow the timeline",
    check(input) {
      const anims = new Map<string, string>();
      for (const s of input.samples)
        for (const a of s.inspect.animations.unregistered) anims.set(`${a.name}@${a.target}`, a.target);
      return { occurrences: [...anims.keys()].map((k) => ({ t: 0, detail: `CSS animation ${k} is not registered` })) };
    },
  },
  {
    id: "DM-R05",
    severity: "error",
    title: "Timers after ready",
    measurement: "setTimeout/setInterval called after ready()",
    fix: "don't use timers for animation: schedule on v.timeline or compute state in v.onSeek(t)",
    check(input) {
      const n = Math.max(0, ...input.samples.map((s) => s.inspect.timersAfterReady));
      return n > 0 ? { occurrences: [{ t: 0, detail: `${n} timer call(s) after v.ready()` }] } : ok();
    },
  },
  {
    id: "DM-S01",
    severity: "error",
    title: "Loudness",
    measurement: "Integrated loudness outside target ± 2 LU warns; true peak above −1.0 dBTP errors",
    fix: "re-run `npx demovie audio mix <slug>` (two-pass loudnorm), or lower the music/SFX gains",
    check(input) {
      const l = input.audio.loudness;
      if (!l) return { occurrences: [], skipped: "no audio/mix.wav" };
      const out: Occurrence[] = [];
      if (Math.abs(l.integrated - input.audio.target.lufs) > 2)
        out.push({
          t: 0,
          severity: "warn",
          detail: `integrated ${l.integrated.toFixed(1)} LUFS; target ${input.audio.target.lufs} ± 2 LU`,
        });
      if (l.truePeak > -1.0)
        out.push({ t: 0, severity: "error", detail: `true peak ${l.truePeak.toFixed(1)} dBTP is above −1.0 dBTP` });
      return { occurrences: out };
    },
  },
  {
    id: "DM-S02",
    severity: "warn",
    title: "VO overlap",
    measurement: "Voice lines overlap each other or run past the end of the video",
    fix: "move VO lines apart in voice.json/storyboard (start times) or shorten them",
    check(input) {
      const lines = [...(input.audio.voice?.lines ?? [])].sort((a, b) => a.start - b.start);
      if (lines.length === 0) return { occurrences: [], skipped: "no voiceover" };
      const out: Occurrence[] = [];
      lines.forEach((l, i) => {
        const next = lines[i + 1];
        if (next && l.start + l.duration > next.start + 0.01)
          out.push({ t: round(next.start), detail: `"${l.id}" runs into "${next.id}"` });
        if (l.start + l.duration > input.video.duration + 0.01)
          out.push({ t: round(l.start), detail: `"${l.id}" ends after the video` });
      });
      return { occurrences: out };
    },
  },
  {
    id: "DM-V01",
    severity: "warn",
    title: '"AI look" clichés',
    measurement:
      'Non-UI text that matches HUD, timecode, BPM or "frame N" patterns; generic status chips ("Done", "Saved", "Success") not in the glossary; more than 2 typefaces',
    fix: "drop decorative HUD/timecode labels and generic chips; stay with the brand's one or two typefaces",
    check(input) {
      const out: Occurrence[] = [];
      const labels = new Set((input.vocabulary.glossary?.uiLabels ?? []).map((l) => l.toLowerCase()));
      const families = new Map<string, number>();
      for (const { text, t } of nonUiTexts(input)) {
        for (const h of HUD)
          if (h.re.test(text.text))
            out.push({ t: round(t), bbox: text.bbox, detail: `${h.what}: ${quote(text.text)}` });
        if (GENERIC_CHIPS.test(text.text.trim()) && !labels.has(text.text.trim().toLowerCase()))
          out.push({ t: round(t), bbox: text.bbox, detail: `generic status chip ${quote(text.text)}` });
        if (text.role !== "logo") families.set(text.fontFamily.toLowerCase(), t);
      }
      if (families.size > 2)
        out.push({ t: 0, detail: `${families.size} typefaces in use (${[...families.keys()].join(", ")})` });
      return { occurrences: out };
    },
  },
];

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}
