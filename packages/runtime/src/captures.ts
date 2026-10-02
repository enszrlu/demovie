import { internal } from "./state.ts";
import type { CaptureElement, CaptureState } from "./types.ts";

const cache = new Map<string, CaptureState>();

interface MetaJson {
  url: string;
  path: string;
  title: string | null;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  dpr: number;
  image: { width: number; height: number };
  fullPage: { width: number; height: number } | null;
  colorScheme?: "light" | "dark";
}

function build(id: string, meta: MetaJson, elements: { elements: CaptureElement[] }): CaptureState {
  const base = `/captures/${id.split("/").map(encodeURIComponent).join("/")}`;
  return {
    id,
    url: meta.url,
    path: meta.path,
    title: meta.title,
    viewport: meta.viewport,
    dpr: meta.dpr,
    image: meta.image,
    fullPage: meta.fullPage,
    colorScheme: meta.colorScheme === "dark" ? "dark" : "light",
    elements: elements.elements,
    screenUrl: `${base}/screen.png`,
    fullUrl: meta.fullPage ? `${base}/full.png` : null,
  };
}

function preloadImage(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  return img.decode().catch(() => {
    internal.console.push({ level: "error", text: `capture image failed to load: ${url}` });
  });
}

/**
 * Load every capture's meta + element map (one request), and decode the screenshots of the captures declared in
 * video.json (`captures`) so the first frames don't wait. No synchronous requests: they can stall under the
 * renderer's request interception.
 */
export async function loadCaptures(declared: string[]): Promise<void> {
  const res = await fetch("/__demovie/captures.json");
  if (res.ok) {
    const bundle = (await res.json()) as {
      captures: Record<string, { meta: MetaJson; elements: { elements: CaptureElement[] } }>;
    };
    for (const [id, c] of Object.entries(bundle.captures)) cache.set(id, build(id, c.meta, c.elements));
  }
  await Promise.all(
    declared.map(async (id) => {
      let state = cache.get(id);
      if (!state) {
        const base = `/captures/${id.split("/").map(encodeURIComponent).join("/")}`;
        const [metaRes, elRes] = await Promise.all([fetch(`${base}/meta.json`), fetch(`${base}/elements.json`)]);
        if (!metaRes.ok || !elRes.ok) {
          throw new Error(
            `demovie: capture "${id}" (video.json "captures") not found. Run \`npx demovie capture\`, then check the id in .demovie/captures/`,
          );
        }
        state = build(id, (await metaRes.json()) as MetaJson, (await elRes.json()) as { elements: CaptureElement[] });
        cache.set(id, state);
      }
      await preloadImage(state.screenUrl);
      if (state.fullUrl) await preloadImage(state.fullUrl);
    }),
  );
}

/** A capture by id (loaded by createVideo). */
export function getCapture(id: string): CaptureState {
  const hit = cache.get(id);
  if (hit) return hit;
  const known = [...cache.keys()];
  const near = known.filter((k) => k.includes(id.split("@")[0] ?? id) || id.includes(k.split("@")[0] ?? k)).slice(0, 5);
  throw new Error(
    `demovie: capture "${id}" not found. ${known.length ? `Known captures include: ${(near.length ? near : known.slice(0, 5)).join(", ")}` : "No captures exist yet: run `npx demovie capture`."}`,
  );
}

/** Levenshtein distance for "did you mean" hints. */
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length]![b.length]!;
}

/** Find an element by id or throw a descriptive error listing the nearest valid ids (SPEC §10.3). */
export function findElement(capture: CaptureState, elementId: string): CaptureElement {
  const found = capture.elements.find((e) => e.id === elementId);
  if (found) return found;
  const nearest = capture.elements
    .map((e) => ({ id: e.id, d: distance(e.id, elementId) - (e.id.includes(elementId.split(":")[1] ?? "~") ? 5 : 0) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .map((e) => e.id);
  throw new Error(
    `demovie: unknown element id "${elementId}" in capture "${capture.id}". Nearest ids: ${nearest.join(", ")}`,
  );
}
