import { describe, expect, it } from "vitest";
import { DESTRUCTIVE_TARGET, FLOW_YAML_TEMPLATE, matchElement, parseFlowYaml } from "../src/flows.ts";

describe("flow files", () => {
  it("parses the YAML flow format from SPEC §9.7", () => {
    const flow = parseFlowYaml(
      `name: create-project
start: /app/projects
viewport: desktop
steps:
  - capture: board
  - click: { role: button, name: New project }
  - capture: dialog
  - fill: { label: Project name, value: Q3 Launch }
  - click: { role: button, name: Create }
  - waitFor: { text: Q3 Launch }
  - capture: created
  - hover: { testId: velocity-chart }
  - capture: chart-hover
`,
      "create-project.flow.yaml",
    );
    expect(flow.name).toBe("create-project");
    expect(flow.allowDestructive).toBe(false);
    expect(flow.steps).toHaveLength(9);
    expect(flow.steps[3]).toEqual({ fill: { label: "Project name", value: "Q3 Launch" } });
  });

  it("rejects malformed steps with a pointer to the problem", () => {
    expect(() =>
      parseFlowYaml("name: x\nstart: /\nsteps:\n  - click: { role: button, label: Two locators }\n", "x.flow.yaml"),
    ).toThrow(/x\.flow\.yaml/);
    expect(() => parseFlowYaml("name: Bad Name\nstart: /\nsteps:\n  - capture: a\n", "b.flow.yaml")).toThrow(
      /lowercase/,
    );
    expect(() => parseFlowYaml("name: x\nstart: /\nsteps:\n  - teleport: /\n", "c.flow.yaml")).toThrow();
  });

  it("scaffolds a valid template", () => {
    expect(parseFlowYaml(FLOW_YAML_TEMPLATE("checkout", "/app"), "t.flow.yaml").steps).toEqual([{ capture: "start" }]);
  });

  it("flags destructive targets", () => {
    for (const t of ["Delete project", "Remove member", "Log out", "Billing", "Cancel subscription", "sign-out"])
      expect(DESTRUCTIVE_TARGET.test(t), t).toBe(true);
    for (const t of ["Create project", "New project", "Velocity", "Settings"])
      expect(DESTRUCTIVE_TARGET.test(t), t).toBe(false);
  });

  it("maps a live box onto the latest element map", () => {
    const map = {
      captureId: "x",
      url: "u",
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
      document: { width: 1, height: 1 },
      elements: [
        {
          id: "main",
          role: "main",
          name: "",
          tag: "main",
          selector: "main",
          bbox: { x: 0, y: 0, width: 1000, height: 800 },
          visible: true,
          interactive: false,
          inViewport: true,
          style: { fontFamily: "", fontSize: 14, fontWeight: 400, color: "#000000", background: null, radius: 0 },
        },
        {
          id: "link:new-project",
          role: "link",
          name: "New project",
          tag: "a",
          selector: "a",
          bbox: { x: 1200, y: 88, width: 132, height: 36 },
          visible: true,
          interactive: true,
          inViewport: true,
          style: { fontFamily: "", fontSize: 14, fontWeight: 500, color: "#ffffff", background: "#155dfc", radius: 8 },
        },
      ],
    };
    expect(matchElement(map, { x: 1201, y: 88, width: 131, height: 36 })?.id).toBe("link:new-project");
    expect(matchElement(map, { x: 10, y: 10, width: 20, height: 20 })).toBeNull();
  });
});
