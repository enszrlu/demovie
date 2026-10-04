import { VideoSchema } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { frameDiff } from "../src/collect.ts";
import { evaluate } from "../src/engine.ts";
import { RULES } from "../src/rules.ts";
import type { InspectData, InspectText, Pixels, QaInputs, Sample } from "../src/types.ts";
import { buildVocabulary } from "../src/vocabulary.ts";

const W = 1920;
const H = 1080;
const glossary = {
  productName: "Harborly",
  tagline: "Plan, ship and measure every launch.",
  features: [{ term: "Projects board", source: null }],
  uiLabels: ["New project", "Velocity", "Saved"],
  entities: ["Acme Rockets"],
  people: ["Maya Chen"],
  ctaUrl: "harborly.example",
  avoid: [],
};

function text(id: string, value: string, extra: Partial<InspectText> = {}): InspectText {
  return {
    id,
    text: value,
    words: value.split(/\s+/).filter(Boolean).length,
    bbox: { x: 400, y: 400, width: 800, height: 80 },
    fontSize: 64,
    fontFamily: "Geist",
    fontWeight: 600,
    color: "#0a0a0a",
    opacity: 1,
    clipped: false,
    overflowing: false,
    ui: false,
    caption: false,
    counter: false,
    role: "text",
    ...extra,
  };
}

function inspect(partial: Partial<InspectData> = {}): InspectData {
  return {
    t: 0,
    format: "16:9",
    width: W,
    height: H,
    safe: { top: 54, right: 96, bottom: 54, left: 96 },
    texts: [],
    shots: [
      { id: "title", start: 0, end: 4, kind: "title", active: true, screens: 0, window: [0, 4] },
      { id: "end", start: 4, end: 6, kind: "logo", active: false, screens: 0, window: [4, 6] },
    ],
    screens: [],
    cursor: [],
    clicks: [],
    highlights: [],
    logos: [{ bbox: { x: 800, y: 400, width: 300, height: 100 }, visible: true }],
    animations: { registered: 0, unregistered: [] },
    strayTweens: [],
    timersAfterReady: 0,
    console: [],
    fonts: { declared: ["Geist", "Inter", "Geist Mono"], loaded: ["Geist", "Inter", "Geist Mono"], failed: [] },
    images: { broken: [] },
    transitions: [],
    ...partial,
  };
}

function solid(rgb: [number, number, number], scale = 0.1): Pixels {
  const width = Math.round(W * scale);
  const height = Math.round(H * scale);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  // A few non-background pixels so frames are not "blank" unless asked.
  for (let i = 0; i < width * 4 * 20; i += 4) data[i] = 30;
  return { width, height, scale, data };
}

/** 6 s at 10 fps with `fn` deciding each sample. */
function inputs(
  fn: (t: number) => Partial<InspectData>,
  extra: Partial<QaInputs> = {},
  pixels?: (t: number) => Pixels,
): QaInputs {
  const samples: Sample[] = [];
  for (let i = 0; i < 60; i++) {
    const t = i / 10;
    samples.push({ t, inspect: inspect({ t, ...fn(t) }), pixels: pixels ? pixels(t) : solid([255, 255, 255]) });
  }
  return {
    format: "16:9",
    video: VideoSchema.parse({ slug: "t", title: "T", type: "hero-loop", fps: 30, duration: 6, formats: ["16:9"] }),
    sampleFps: 10,
    samples,
    clicks: [],
    network: { blocked: [], failed: [] },
    determinism: { times: [1, 2, 3, 4, 5], mismatches: [] },
    loop: null,
    vocabulary: buildVocabulary(glossary, "Brief: the Projects board ships in 2026 with 12 projects.", [
      "New project",
      "Velocity",
      "38",
    ]),
    audio: { files: [], provenance: [], loudness: null, target: { lufs: -16, truePeak: -1.5 }, voice: null },
    ...extra,
  };
}

const clean = () => inputs((t) => ({ texts: t >= 0.5 && t < 4 ? [text("h", "Plan every launch on one board.")] : [] }));
const status = (i: QaInputs, id: string) => evaluate(i).rules.find((r) => r.id === id)!;

type Case = { id: string; fail: () => QaInputs; severity?: "error" | "warn"; pass?: () => QaInputs };

const CASES: Case[] = [
  {
    id: "DM-T01",
    fail: () =>
      inputs((t) => ({ texts: t >= 1 && t < 1.5 ? [text("h", "Plan every launch on one board, then ship it.")] : [] })),
  },
  { id: "DM-T02", fail: () => inputs((t) => ({ texts: t < 4 ? [text("h", "Tiny", { fontSize: 20 })] : [] })) },
  {
    id: "DM-T03",
    fail: () => inputs((t) => ({ texts: t < 4 ? [text("h", "Overflowing headline", { overflowing: true })] : [] })),
  },
  {
    id: "DM-T04",
    fail: () => inputs((t) => ({ texts: t < 4 ? [text("h", "Grey on white", { color: "#c8c8c8" })] : [] })),
    severity: "error",
  },
  {
    id: "DM-T05",
    severity: "warn",
    fail: () =>
      inputs((t) => ({
        texts:
          t < 4
            ? [
                text("a", "One block"),
                text("b", "Second block", { bbox: { x: 400, y: 600, width: 800, height: 80 } }),
                text("c", "Third block", { bbox: { x: 400, y: 800, width: 800, height: 80 } }),
              ]
            : [],
      })),
  },
  {
    id: "DM-L01",
    fail: () =>
      inputs((t) => ({ texts: t < 4 ? [text("h", "Edge", { bbox: { x: 20, y: 400, width: 300, height: 80 } })] : [] })),
  },
  {
    id: "DM-L02",
    fail: () =>
      inputs((t) => ({
        texts:
          t < 4
            ? [text("a", "Overlap one"), text("b", "Overlap two", { bbox: { x: 420, y: 410, width: 800, height: 80 } })]
            : [],
      })),
  },
  {
    id: "DM-L03",
    severity: "warn",
    fail: () => inputs(() => ({ texts: [text("h", "Gone", { bbox: { x: 2100, y: 400, width: 300, height: 80 } })] })),
  },
  {
    id: "DM-P01",
    severity: "error",
    fail: () =>
      inputs(() => ({
        shots: Array.from({ length: 8 }, (_, i) => ({
          id: `s${i}`,
          start: i * 0.5,
          end: i * 0.5 + 0.5,
          kind: "text",
          active: false,
          screens: 0,
          window: [i * 0.5, i * 0.5 + 0.5] as [number, number],
        })).concat([{ id: "end", start: 4, end: 6, kind: "logo", active: false, screens: 0, window: [4, 6] }]),
      })),
  },
  {
    id: "DM-P02",
    fail: () =>
      inputs(() => ({
        shots: [{ id: "a", start: 0, end: 5, kind: "logo", active: true, screens: 0, window: [0, 5] }],
      })),
  },
  {
    id: "DM-P03",
    severity: "warn",
    fail: () =>
      inputs(() => ({
        logos: [],
        shots: [{ id: "a", start: 0, end: 6, kind: "text", active: true, screens: 0, window: [0, 6] }],
      })),
  },
  {
    id: "DM-P04",
    fail: () =>
      inputs(() => ({
        shots: [
          { id: "a", start: 0, end: 2, kind: "title", active: true, screens: 0, window: [0, 2] },
          { id: "b", start: 3, end: 6, kind: "logo", active: false, screens: 0, window: [3, 6] },
        ],
      })),
  },
  {
    id: "DM-P05",
    fail: () => ({
      ...clean(),
      video: VideoSchema.parse({ slug: "t", title: "T", type: "hero-loop", fps: 30, duration: 6, formats: ["16:9"] }),
      loop: { diffRatio: 0.2 },
    }),
    pass: () => ({
      ...clean(),
      video: VideoSchema.parse({ slug: "t", title: "T", type: "hero-loop", fps: 30, duration: 6, formats: ["16:9"] }),
      loop: { diffRatio: 0.001 },
    }),
  },
  {
    id: "DM-G01",
    fail: () => ({
      ...clean(),
      clicks: [
        {
          at: 2,
          screen: "s1",
          elementId: "button:new",
          point: { x: 10, y: 10 },
          rect: { x: 500, y: 500, width: 100, height: 40 },
        },
      ],
    }),
    pass: () => ({
      ...clean(),
      clicks: [
        {
          at: 2,
          screen: "s1",
          elementId: "button:new",
          point: { x: 550, y: 520 },
          rect: { x: 500, y: 500, width: 100, height: 40 },
        },
      ],
    }),
  },
  {
    id: "DM-G02",
    severity: "warn",
    fail: () => inputs((t) => ({ texts: t < 4 ? [text("h", "Powered by Quantum Synergy Engine")] : [] })),
  },
  {
    id: "DM-G03",
    fail: () =>
      inputs(() => ({
        shots: [
          { id: "p", start: 0, end: 4, kind: "product", active: true, screens: 0, window: [0, 4] },
          { id: "end", start: 4, end: 6, kind: "logo", active: false, screens: 0, window: [4, 6] },
        ],
      })),
  },
  {
    id: "DM-G04",
    severity: "warn",
    fail: () => inputs((t) => ({ texts: t < 4 ? [text("h", "Teams ship 47% faster")] : [] })),
  },
  {
    id: "DM-G05",
    severity: "error",
    fail: () =>
      inputs(() => ({
        screens: [
          {
            id: "s1",
            capture: "routes/a@desktop",
            captures: ["routes/a@desktop"],
            bbox: { x: 0, y: 0, width: 1800, height: 1000 },
            visible: true,
            cameraScale: 3,
            upscale: 1.8,
          },
        ],
      })),
  },
  {
    id: "DM-A01",
    fail: () =>
      inputs((t) => ({
        fonts: { declared: ["Geist"], loaded: [], failed: ["Geist"] },
        texts: t < 4 ? [text("h", "Fallback font", { fontFamily: "Times New Roman" })] : [],
      })),
  },
  {
    id: "DM-A02",
    fail: () => ({ ...clean(), network: { blocked: [], failed: [{ url: "/assets/missing.png", status: 404 }] } }),
  },
  {
    id: "DM-A03",
    fail: () => ({ ...clean(), network: { blocked: ["https://fonts.googleapis.com/css"], failed: [] } }),
  },
  {
    id: "DM-A04",
    fail: () => ({ ...clean(), audio: { ...clean().audio, files: ["music.wav"], provenance: [] } }),
    pass: () => ({
      ...clean(),
      audio: {
        ...clean().audio,
        files: ["music.wav"],
        provenance: [
          {
            file: "music.wav",
            kind: "music",
            generator: "demovie-synth",
            license: "CC0",
            createdAt: "2026-10-01T00:00:00Z",
            details: {},
          },
        ],
      },
    }),
  },
  {
    id: "DM-R01",
    fail: () => ({
      ...clean(),
      determinism: {
        times: [1, 2, 3, 4, 5],
        mismatches: [{ t: 3, diffRatio: 0.01, visibleRatio: 0.008, maxDelta: 214 }],
      },
    }),
    // Raster noise: a few pixels a few levels apart (as on CI's Linux runners) is not a determinism bug.
    pass: () => ({
      ...clean(),
      determinism: {
        times: [1, 2, 3, 4, 5],
        mismatches: [{ t: 3, diffRatio: 0.00022, visibleRatio: 0.00004, maxDelta: 31 }],
      },
    }),
  },
  {
    id: "DM-R02",
    severity: "warn",
    fail: () =>
      inputs(
        (t) => ({ texts: t >= 2 ? [text("h", "Late text")] : [] }),
        {},
        (t) => (t < 1 ? solidBlank() : solid([255, 255, 255])),
      ),
  },
  { id: "DM-R03", fail: () => inputs(() => ({ strayTweens: [{ targets: "h1.title", duration: 1 }] })) },
  {
    id: "DM-R04",
    severity: "warn",
    fail: () => inputs(() => ({ animations: { registered: 0, unregistered: [{ name: "pulse", target: "div.dot" }] } })),
  },
  { id: "DM-R05", fail: () => inputs(() => ({ timersAfterReady: 2 })) },
  {
    id: "DM-S01",
    severity: "error",
    fail: () => ({ ...clean(), audio: { ...clean().audio, loudness: { integrated: -9, truePeak: -0.2 } } }),
    pass: () => ({ ...clean(), audio: { ...clean().audio, loudness: { integrated: -16.3, truePeak: -1.6 } } }),
  },
  {
    id: "DM-S02",
    severity: "warn",
    fail: () => ({
      ...clean(),
      audio: {
        ...clean().audio,
        voice: {
          provider: "openai",
          voice: "marin",
          model: null,
          lines: [
            { id: "a", text: "One", start: 0, duration: 3, file: "a.mp3", words: [] },
            { id: "b", text: "Two", start: 2, duration: 5, file: "b.mp3", words: [] },
          ],
        },
      },
    }),
    pass: () => ({
      ...clean(),
      audio: {
        ...clean().audio,
        voice: {
          provider: "openai",
          voice: "marin",
          model: null,
          lines: [
            { id: "a", text: "One", start: 0, duration: 2, file: "a.mp3", words: [] },
            { id: "b", text: "Two", start: 2.5, duration: 2, file: "b.mp3", words: [] },
          ],
        },
      },
    }),
  },
  {
    id: "DM-V01",
    severity: "warn",
    fail: () =>
      inputs((t) => ({
        texts:
          t < 4
            ? [text("a", "00:12:24:08"), text("b", "Success", { bbox: { x: 400, y: 600, width: 300, height: 80 } })]
            : [],
      })),
  },
];

function solidBlank(): Pixels {
  const p = solid([250, 250, 250]);
  for (let i = 0; i < p.data.length; i += 4) {
    p.data[i] = 250;
  }
  return p;
}

describe("QA rules (synthetic inputs)", () => {
  it("covers every rule in SPEC §12 exactly once", () => {
    expect(RULES.map((r) => r.id).sort()).toEqual(CASES.map((c) => c.id).sort());
    expect(RULES).toHaveLength(30);
    for (const r of RULES) expect(r.fix.length, r.id).toBeGreaterThan(20);
  });

  it("passes a clean composition on every rule", () => {
    const report = evaluate(clean());
    expect(report.rules.filter((r) => r.status === "fail")).toEqual([]);
    expect(report.summary).toEqual({ errors: 0, warnings: 0, waived: 0 });
  });

  for (const c of CASES) {
    it(`${c.id}: passing and failing synthetic cases`, () => {
      const pass = status(c.pass ? c.pass() : clean(), c.id);
      expect(["pass", "skipped"], `${c.id} pass case: ${pass.message}`).toContain(pass.status);
      const fail = status(c.fail(), c.id);
      expect(fail.status, `${c.id} fail case`).toBe("fail");
      expect(fail.occurrences.length).toBeGreaterThan(0);
      expect(fail.fix).toBeTruthy();
      if (c.severity) expect(fail.severity).toBe(c.severity);
    });
  }

  it("reports waived rules and turns warnings into errors with --strict", () => {
    const failing = CASES.find((c) => c.id === "DM-T05")!.fail();
    const normal = evaluate(failing);
    expect(normal.summary).toMatchObject({ errors: 0, warnings: 1 });
    const strict = evaluate(failing, { strict: true });
    expect(strict.summary).toMatchObject({ errors: 1, warnings: 0 });
    const waived = evaluate(failing, { ignore: ["DM-T05"] });
    expect(waived.rules.find((r) => r.id === "DM-T05")?.status).toBe("waived");
    expect(waived.summary).toMatchObject({ errors: 0, warnings: 0, waived: 1 });
  });

  it("only warns about a declared font that no text in the video uses", () => {
    const unused = inputs((t) => ({
      fonts: { declared: ["Inter", "JetBrains Mono"], loaded: ["Inter"], failed: [] },
      texts: t < 4 ? [text("h", "Stop guessing", { fontFamily: "Inter" })] : [],
    }));
    const result = status(unused, "DM-A01");
    expect(result.status).toBe("fail");
    expect(result.severity).toBe("warn");
    expect(evaluate(unused).summary).toMatchObject({ errors: 0, warnings: 1 });
  });

  it("lets reading time follow word count and ignores entrance frames", () => {
    // 3 words need max(1.2, 0.5 + 1) = 1.5 s.
    const ok = inputs((t) => ({ texts: t >= 1 && t < 2.6 ? [text("h", "One more launch")] : [] }));
    expect(status(ok, "DM-T01").status).toBe("pass");
    const short = inputs((t) => ({ texts: t >= 1 && t < 2.2 ? [text("h", "One more launch")] : [] }));
    expect(status(short, "DM-T01").status).toBe("fail");
    // A 0.2 s dip below the size floor (an entrance) is not a T02 failure.
    const entrance = inputs((t) => ({ texts: t < 4 ? [text("h", "Grows", { fontSize: t < 0.2 ? 10 : 64 })] : [] }));
    expect(status(entrance, "DM-T02").status).toBe("pass");
  });
});

describe("frameDiff (DM-R01)", () => {
  const frame = (fill: (pixel: number) => number): Pixels => {
    const data = new Uint8Array(100 * 100 * 4);
    for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? 255 : fill(i >> 2);
    return { width: 100, height: 100, scale: 1, data };
  };

  it("tells identical frames, faint noise and visible changes apart", () => {
    const gray = frame(() => 200);
    const sameGray = frame(() => 200);
    const onePixelTwoLevelsDarker = frame((p) => (p === 0 ? 198 : 200));
    const blackTenByTenBlock = frame((p) => (p % 100 < 10 && p < 1000 ? 0 : 200));
    expect(frameDiff(gray, sameGray)).toEqual({ diffRatio: 0, visibleRatio: 0, maxDelta: 0 });
    expect(frameDiff(gray, onePixelTwoLevelsDarker)).toEqual({ diffRatio: 0.0001, visibleRatio: 0, maxDelta: 2 });
    expect(frameDiff(gray, blackTenByTenBlock)).toEqual({ diffRatio: 0.01, visibleRatio: 0.01, maxDelta: 200 });
  });
});
