import { describe, expect, it } from "vitest";
import { generateFlowchart } from "./flowchart.ts";
import type { Scenario } from "./schema.ts";

function baseScenario(nodes: Scenario["nodes"], start = "a"): Scenario {
  return {
    id: "test-scenario",
    title: "Test scenario",
    audience: "exec",
    duration_minutes: 30,
    summary: "summary",
    objectives: ["objective"],
    category: "security",
    roles: [{ name: "Role", description: "desc" }],
    start,
    nodes,
  };
}

describe("generateFlowchart", () => {
  it("marks the start node with a rounded box", () => {
    const scenario = baseScenario([{ id: "a", title: "A", inject: "x" }]);

    const diagram = generateFlowchart(scenario);
    expect(diagram).toContain('a(["A"])');
  });

  it("marks terminal nodes (no branches) with a subroutine box", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "x",
        branches: [{ label: "go", next: "b" }],
      },
      { id: "b", title: "B", inject: "y" },
    ]);

    const diagram = generateFlowchart(scenario);
    expect(diagram).toContain('b[["B"]]');
  });

  it("renders labelled edges for each branch", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "x",
        branches: [{ label: "Escalate now", next: "b" }],
      },
      { id: "b", title: "B", inject: "y" },
    ]);

    const diagram = generateFlowchart(scenario);
    expect(diagram).toContain('a -->|"Escalate now"| b');
  });

  it("sanitises node ids that contain characters invalid in mermaid ids", () => {
    const scenario = baseScenario(
      [
        {
          id: "node-1",
          title: "A",
          inject: "x",
          branches: [{ label: "go", next: "node-2" }],
        },
        { id: "node-2", title: "B", inject: "y" },
      ],
      "node-1",
    );

    const diagram = generateFlowchart(scenario);
    expect(diagram).toContain("node_1");
    expect(diagram).not.toContain("node-1");
  });

  it("escapes double quotes and newlines in labels", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: 'Say "hello"\nworld',
        inject: "x",
      },
    ]);

    const diagram = generateFlowchart(scenario);
    expect(diagram).toContain("Say 'hello' world");
  });
});
