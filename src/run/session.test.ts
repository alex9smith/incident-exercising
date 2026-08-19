import { describe, expect, it } from "vitest";
import { RunSession } from "./session.ts";
import type { Scenario } from "../scenario/schema.ts";

function scenario(): Scenario {
  return {
    id: "test-scenario",
    title: "Test scenario",
    audience: "management",
    duration_minutes: 30,
    summary: "summary",
    objectives: ["objective"],
    category: "availability",
    roles: [{ name: "Role", description: "desc" }],
    start: "a",
    nodes: [
      {
        id: "a",
        title: "A",
        inject: "inject a",
        branches: [
          { label: "go to b", next: "b" },
          { label: "go to c", next: "c" },
        ],
      },
      {
        id: "b",
        title: "B",
        inject: "inject b",
        branches: [{ label: "go to c", next: "c" }],
      },
      { id: "c", title: "C", inject: "inject c" },
    ],
  };
}

const fixedNow = () => new Date("2026-01-01T00:00:00.000Z");

describe("RunSession", () => {
  it("starts at the scenario's start node", () => {
    const session = new RunSession(scenario(), fixedNow);
    expect(session.current.id).toBe("a");
    expect(session.isComplete).toBe(false);
  });

  it("throws if the scenario's start node does not exist", () => {
    const badScenario: Scenario = { ...scenario(), start: "missing" };
    expect(() => new RunSession(badScenario, fixedNow)).toThrow(
      /start node "missing" does not exist/,
    );
  });

  it("advances to the chosen branch's target node", () => {
    const session = new RunSession(scenario(), fixedNow);
    const next = session.choose(0);
    expect(next.id).toBe("b");
    expect(session.current.id).toBe("b");
  });

  it("marks the session complete once a node with no branches is reached", () => {
    const session = new RunSession(scenario(), fixedNow);
    session.choose(1); // a -> c directly
    expect(session.current.id).toBe("c");
    expect(session.isComplete).toBe(true);
  });

  it("throws when choosing an out-of-range branch index", () => {
    const session = new RunSession(scenario(), fixedNow);
    expect(() => session.choose(5)).toThrow(/No branch at index 5/);
  });

  it("throws when choosing from a node with no branches", () => {
    const session = new RunSession(scenario(), fixedNow);
    session.choose(1); // reach ending node "c"
    expect(() => session.choose(0)).toThrow(/No branch at index 0/);
  });

  it("records history and produces a summary on finish", () => {
    const session = new RunSession(scenario(), fixedNow);
    session.choose(0); // a -> b
    session.choose(0); // b -> c
    const summary = session.finish();

    expect(summary.scenarioId).toBe("test-scenario");
    expect(summary.steps).toEqual([
      {
        nodeId: "a",
        nodeTitle: "A",
        enteredAt: "2026-01-01T00:00:00.000Z",
        chosenBranchLabel: "go to b",
      },
      {
        nodeId: "b",
        nodeTitle: "B",
        enteredAt: "2026-01-01T00:00:00.000Z",
        chosenBranchLabel: "go to c",
      },
      {
        nodeId: "c",
        nodeTitle: "C",
        enteredAt: "2026-01-01T00:00:00.000Z",
        chosenBranchLabel: null,
      },
    ]);
  });

  it("exposes all node ids in the scenario", () => {
    const session = new RunSession(scenario(), fixedNow);
    expect(session.allNodeIds).toEqual(["a", "b", "c"]);
  });

  it("ends the session when deviating with no target node", () => {
    const session = new RunSession(scenario(), fixedNow);
    const result = session.deviateTo("Group did something unplanned");
    expect(result).toBeNull();
    expect(session.isComplete).toBe(true);
    // current node hasn't moved — still node "a", which has real branches
    expect(session.current.id).toBe("a");
  });

  it("jumps to an existing node when deviating with a target node", () => {
    const session = new RunSession(scenario(), fixedNow);
    const result = session.deviateTo("Group escalated directly", "c");
    expect(result?.id).toBe("c");
    expect(session.current.id).toBe("c");
    // reached a real ending node, so isComplete is true for that reason too
    expect(session.isComplete).toBe(true);
  });

  it("throws when deviating to an unknown node id", () => {
    const session = new RunSession(scenario(), fixedNow);
    expect(() => session.deviateTo("desc", "nonexistent")).toThrow(
      /Node "nonexistent" does not exist/,
    );
  });

  it("records the deviation description in the summary and does not duplicate the step on finish", () => {
    const session = new RunSession(scenario(), fixedNow);
    session.deviateTo("Group called the vendor directly");
    const summary = session.finish();

    expect(summary.steps).toEqual([
      {
        nodeId: "a",
        nodeTitle: "A",
        enteredAt: "2026-01-01T00:00:00.000Z",
        chosenBranchLabel: null,
        deviationDescription: "Group called the vendor directly",
      },
    ]);
  });

  it("continues normally after resuming from a deviation into a node with branches", () => {
    const session = new RunSession(scenario(), fixedNow);
    session.deviateTo("Group jumped ahead", "b");
    expect(session.isComplete).toBe(false);
    session.choose(0); // b -> c
    const summary = session.finish();

    expect(summary.steps.map((step) => step.nodeId)).toEqual(["a", "b", "c"]);
    expect(summary.steps[0]?.deviationDescription).toBe("Group jumped ahead");
  });
});
