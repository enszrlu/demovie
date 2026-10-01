import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendDiscovered,
  buildGlossary,
  cleanLabels,
  extractSeedData,
  parseGlossaryMd,
  readmeFeatures,
  renderGlossaryMd,
} from "../src/extract/glossary.ts";

describe("glossary", () => {
  const glossary = buildGlossary({
    productName: "Harborly",
    tagline: "Plan, ship and measure every launch.",
    ctaUrl: "harborly.example",
    readme:
      "# Harborly\n\n## Features\n\n- **Projects board**: every launch at a glance\n- Launch checklist — never miss a step\n",
    uiTexts: [
      { text: "Projects 9", kind: "nav", route: "/app", href: "/app/projects" },
      { text: "Team", kind: "nav", route: "/app", href: "/app/team" },
      { text: "Sign in", kind: "nav", route: "/", href: "/login" },
      { text: "Sign in to Harborly", kind: "heading", level: 1, route: "/login" },
      { text: "Simple pricing for every launch team", kind: "heading", level: 1, route: "/pricing" },
      { text: "Projects board", kind: "heading", level: 1, route: "/app/projects" },
      { text: "Launch checklist", kind: "heading", level: 3, route: "/" },
      { text: "Velocity insights", kind: "heading", level: 3, route: "/" },
      { text: "Team workload", kind: "heading", level: 3, route: "/" },
      { text: "New project", kind: "button", route: "/app/projects" },
      { text: "Home", kind: "nav", route: "/" },
      { text: "OK", kind: "button", route: "/" },
      { text: "New project", kind: "button", route: "/app" },
    ],
    people: ["Maya Chen", "Leo Park"],
    entities: ["Acme Rockets", "Q3 Launch"],
  });

  it("dedupes, keeps casing and drops generic words", () => {
    expect(glossary.uiLabels).toEqual([
      "Projects",
      "Team",
      "Sign in",
      "Sign in to Harborly",
      "Simple pricing for every launch team",
      "Projects board",
      "Launch checklist",
      "Velocity insights",
      "Team workload",
      "New project",
    ]);
    expect(cleanLabels(["Back", "OK", "Velocity", "Velocity", "42%"])).toEqual(["Velocity"]);
  });

  it("finds features from nav + h1 and the README", () => {
    expect(glossary.features).toEqual(
      expect.arrayContaining([
        { term: "Projects board", source: "nav + h1 on /app/projects" },
        { term: "Velocity insights", source: "h3 on /" },
        { term: "Launch checklist", source: "h3 on /" },
      ]),
    );
    expect(glossary.features.map((f) => f.term)).not.toContain("Simple pricing for every launch team");
    expect(glossary.features.map((f) => f.term)).not.toContain("Sign in to Harborly");
    expect(readmeFeatures("## Features\n- **Plant journal**: log every watering.\n")).toEqual([
      { term: "Plant journal", source: "README features" },
    ]);
  });

  it("round-trips through glossary.md", () => {
    const md = renderGlossaryMd({ ...glossary, avoid: ["tasks"] }, ["Velocity"]);
    const parsed = parseGlossaryMd(md);
    expect(parsed.productName).toBe("Harborly");
    expect(parsed.tagline).toBe("Plan, ship and measure every launch.");
    expect(parsed.ctaUrl).toBe("harborly.example");
    expect(parsed.avoid).toEqual(["tasks"]);
    expect(parsed.people).toEqual(["Maya Chen", "Leo Park"]);
    expect(parsed.uiLabels).toEqual([...glossary.uiLabels, "Velocity"]);
    expect(parsed.features[0]).toEqual({ term: "Projects board", source: "nav + h1 on /app/projects" });
  });

  it("appends discovered labels without touching user edits", () => {
    const md = renderGlossaryMd(glossary).replace("- Maya Chen", "- Maya Chen\n- Priya Nair (added by hand)");
    const { md: next, added } = appendDiscovered(md, ["New project", "Launch checklist", "Velocity", "Back"]);
    expect(added).toEqual(["Velocity"]);
    expect(next).toContain("- Priya Nair (added by hand)");
    expect(next.lastIndexOf("- Velocity\n")).toBeGreaterThan(next.indexOf("## Discovered"));
    expect(appendDiscovered(next, ["Velocity"]).added).toEqual([]);
  });

  it("extracts people and entities from a seed file", () => {
    const seed = extractSeedData(path.join(import.meta.dirname, "fixtures", "seed", "seed.mjs"));
    expect(seed.people.sort()).toEqual(["Leo Park", "Maya Chen"]);
    expect(seed.entities.sort()).toEqual(["Acme Rockets", "Northwind", "Q3 Launch"]);
  });
});
