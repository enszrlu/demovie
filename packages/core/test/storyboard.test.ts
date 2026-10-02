import { describe, expect, it } from "vitest";
import { parseStoryboard } from "../src/index.ts";

describe("storyboard.md", () => {
  it("parses the frontmatter bpm and the shot table, keeping VO wording and escaped pipes", () => {
    const sb = parseStoryboard(`---
bpm: 96
---

| # | start | dur | kind | visual | on-screen text | VO line | captures / element ids | transition | notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 3.5s | Title | Logo | Meet Harborly | Plan it \\| ship it. | brand/logo.svg | crossfade 0.5 | |
| 2 | 3.5 | 6 | product | Board | | | routes/app@desktop#link:q3-launch; routes/app@desktop | cut | |
`);
    expect(sb.bpm).toBe(96);
    expect(sb.rows).toHaveLength(2);
    expect(sb.rows[0]).toMatchObject({ index: 1, start: 0, dur: 3.5, kind: "title", vo: "Plan it | ship it." });
    expect(sb.rows[1]!.captures).toEqual(["routes/app@desktop#link:q3-launch", "routes/app@desktop"]);
  });

  it("explains how to fix an invalid table", () => {
    expect(() =>
      parseStoryboard("| # | start | dur | kind |\n|---|---|---|---|\n| 1 | 0 | 2 | montage |\n", "sb.md"),
    ).toThrow(
      expect.objectContaining({ code: "E_CONFIG", fix: expect.stringContaining("product|title|text|logo|other") }),
    );
    expect(parseStoryboard("no table here").rows).toEqual([]);
  });
});
