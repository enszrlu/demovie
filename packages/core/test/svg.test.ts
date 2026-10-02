import { describe, expect, it } from "vitest";
import { normalizeSvg } from "../src/util/svg.ts";

describe("normalizeSvg", () => {
  it("adds a viewBox from width/height and the SVG spelling of JSX attributes", () => {
    const out = normalizeSvg(
      '<svg width="187" height="46" fill="none"><clipPath id="c"/><path fillRule="evenodd" clipPath="url(#c)" strokeWidth="2" d="M0 0"/></svg>',
    );
    const tag = out.match(/<svg[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(tag).toContain('viewBox="0 0 187 46"');
    expect(out).toContain('fill-rule="evenodd" clip-path="url(#c)" stroke-width="2"');
    expect(out).toContain("<clipPath id=");
  });

  it("leaves a well-formed SVG alone", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill-rule="evenodd" d="M0 0"/></svg>';
    expect(normalizeSvg(svg)).toBe(svg);
  });
});
