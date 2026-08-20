import { describe, expect, it } from "vitest";
import { checkGraphIntegrity } from "./graph.ts";
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

describe("checkGraphIntegrity", () => {
  it("reports no issues for a well-formed graph with a single ending", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        branches: [{ label: "go to b", next: "b" }],
      },
      { id: "b", title: "B", inject: "inject b" },
    ]);

    expect(checkGraphIntegrity(scenario)).toEqual([]);
  });

  it("reports an error when start refers to a missing node", () => {
    const scenario = baseScenario(
      [{ id: "a", title: "A", inject: "inject a" }],
      "missing",
    );

    const issues = checkGraphIntegrity(scenario);
    expect(issues).toContainEqual({
      severity: "error",
      message: 'start node "missing" does not exist',
    });
  });

  it("reports an error for a branch pointing to an unknown node", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        branches: [{ label: "go nowhere", next: "ghost" }],
      },
    ]);

    const issues = checkGraphIntegrity(scenario);
    expect(issues).toContainEqual({
      severity: "error",
      message:
        'Node "a" has a branch ("go nowhere") pointing to unknown node "ghost"',
    });
  });

  it("reports an error for duplicate node ids", () => {
    const scenario = baseScenario([
      { id: "a", title: "A", inject: "inject a" },
      { id: "a", title: "A again", inject: "inject a again" },
    ]);

    const issues = checkGraphIntegrity(scenario);
    expect(issues).toContainEqual({
      severity: "error",
      message: 'Duplicate node id "a"',
    });
  });

  it("reports a warning for a node unreachable from start", () => {
    const scenario = baseScenario([
      { id: "a", title: "A", inject: "inject a" },
      { id: "orphan", title: "Orphan", inject: "inject orphan" },
    ]);

    const issues = checkGraphIntegrity(scenario);
    expect(issues).toContainEqual({
      severity: "warning",
      message: 'Node "orphan" is not reachable from start node "a"',
    });
  });

  it("reports a warning when no path from start reaches an ending", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        branches: [{ label: "loop", next: "b" }],
      },
      {
        id: "b",
        title: "B",
        inject: "inject b",
        branches: [{ label: "loop back", next: "a" }],
      },
    ]);

    const issues = checkGraphIntegrity(scenario);
    expect(issues).toContainEqual({
      severity: "warning",
      message:
        'No path from start node "a" leads to an ending (a node with no branches) — every path may loop indefinitely',
    });
  });

  it("allows a cycle as long as some path reaches an ending", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        branches: [
          { label: "loop", next: "b" },
          { label: "end it", next: "c" },
        ],
      },
      {
        id: "b",
        title: "B",
        inject: "inject b",
        branches: [{ label: "loop back", next: "a" }],
      },
      { id: "c", title: "C", inject: "inject c" },
    ]);

    expect(checkGraphIntegrity(scenario)).toEqual([]);
  });

  it("does not report reachability warnings when there are structural errors", () => {
    const scenario = baseScenario(
      [{ id: "a", title: "A", inject: "inject a" }],
      "missing",
    );

    const issues = checkGraphIntegrity(scenario);
    expect(issues.every((issue) => issue.severity === "error")).toBe(true);
  });

  it("reports no timeline issue when elapsed_minutes increases along a branch", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        elapsed_minutes: 0,
        branches: [{ label: "go to b", next: "b" }],
      },
      { id: "b", title: "B", inject: "inject b", elapsed_minutes: 15 },
    ]);

    expect(checkGraphIntegrity(scenario)).toEqual([]);
  });

  it("reports no timeline issue when elapsed_minutes stays the same along a branch", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        elapsed_minutes: 10,
        branches: [{ label: "go to b", next: "b" }],
      },
      { id: "b", title: "B", inject: "inject b", elapsed_minutes: 10 },
    ]);

    expect(checkGraphIntegrity(scenario)).toEqual([]);
  });

  it("reports a warning when elapsed_minutes decreases along a branch", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        elapsed_minutes: 20,
        branches: [{ label: "go to b", next: "b" }],
      },
      { id: "b", title: "B", inject: "inject b", elapsed_minutes: 5 },
    ]);

    const issues = checkGraphIntegrity(scenario);
    expect(issues).toContainEqual({
      severity: "warning",
      message:
        'Node "a" (elapsed_minutes: 20) has a branch ("go to b") to node "b" (elapsed_minutes: 5), which goes backwards in time — intentional for a loop-back, but worth double-checking',
    });
  });

  it("skips timeline checks when either node omits elapsed_minutes", () => {
    const scenario = baseScenario([
      {
        id: "a",
        title: "A",
        inject: "inject a",
        elapsed_minutes: 20,
        branches: [{ label: "go to b", next: "b" }],
      },
      { id: "b", title: "B", inject: "inject b" },
    ]);

    expect(checkGraphIntegrity(scenario)).toEqual([]);
  });
});
