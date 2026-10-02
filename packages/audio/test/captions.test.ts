import type { VoiceManifest } from "@demovie/core";
import { describe, expect, it } from "vitest";
import { captionCues as runtimeCues } from "../../runtime/src/cues.ts";
import { captionCues, duckEnvelope, toSrt, toVtt } from "../src/index.ts";

const lines: VoiceManifest["lines"] = [
  {
    id: "vo-02",
    text: "Every plan gets a checklist and milestones, ready on day one.",
    start: 4,
    duration: 3.6,
    file: "audio/vo-02.mp3",
    words: "Every plan gets a checklist and milestones, ready on day one."
      .split(" ")
      .map((text, i) => ({ text, start: i * 0.33, end: i * 0.33 + 0.3 })),
  },
  { id: "vo-01", text: "Meet the Projects board.", start: 0.5, duration: 1.8, file: "audio/vo-01.mp3", words: [] },
];

describe("captions", () => {
  it("splits lines into short cues timed by the words, keeping the wording", () => {
    const cues = captionCues(lines);
    // cues are held up to 0.6 s past their last word so they don't flicker off
    expect(cues[0]).toEqual({ start: 0.5, end: 2.9, text: "Meet the Projects board." });
    expect(cues.slice(1).map((c) => c.text)).toEqual([
      "Every plan gets a checklist and",
      "milestones, ready on day one.",
    ]);
    expect(
      cues
        .slice(1)
        .map((c) => c.text)
        .join(" "),
    ).toBe(lines[0]!.text);
    expect(cues[1]!.start).toBe(4);
    expect(cues[1]!.end).toBeLessThanOrEqual(cues[2]!.start);
    expect(cues.every((c) => c.text.split(" ").length <= 7 && c.text.length <= 42)).toBe(true);
  });

  it("matches the runtime's burned-in cues", () => {
    const fromRuntime = runtimeCues(lines).map(({ words: _w, ...c }) => c);
    const sidecar = captionCues(lines);
    expect(fromRuntime.map((c) => c.text)).toEqual(sidecar.map((c) => c.text));
    fromRuntime.forEach((c, i) => {
      expect(c.start).toBeCloseTo(sidecar[i]!.start, 3);
      expect(c.end).toBeCloseTo(sidecar[i]!.end, 3);
    });
  });

  it("writes WebVTT and SRT", () => {
    const cues = [{ start: 61.25, end: 63.5, text: "Plan, ship and measure." }];
    expect(toVtt(cues)).toBe("WEBVTT\n\n1\n00:01:01.250 --> 00:01:03.500\nPlan, ship and measure.\n");
    expect(toSrt(cues)).toBe("1\n00:01:01,250 --> 00:01:03,500\nPlan, ship and measure.\n");
  });
});

describe("music ducking", () => {
  it("dips −8 dB under VO with a 150 ms attack before the line and a 400 ms release after it", () => {
    const sr = 1000;
    const g = duckEnvelope(5000, sr, [{ start: 1, duration: 2 }]);
    const db = (t: number) => 20 * Math.log10(g[Math.round(t * sr)]!);
    expect(db(0.5)).toBeCloseTo(0, 5);
    expect(db(0.925)).toBeCloseTo(-4, 1);
    expect(db(1)).toBeCloseTo(-8, 3);
    expect(db(2.5)).toBeCloseTo(-8, 3);
    expect(db(3.2)).toBeCloseTo(-4, 1);
    expect(db(3.5)).toBeCloseTo(0, 5);
  });
});
