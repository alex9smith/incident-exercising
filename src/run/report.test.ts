import { describe, expect, it } from "vitest";
import { generateAfterActionReport } from "./report.ts";
import type { Scenario } from "../scenario/schema.ts";
import type { RunSummary } from "./session.ts";

function scenario(): Scenario {
  return {
    id: "test-scenario",
    title: "Test scenario",
    audience: "management",
    duration_minutes: 45,
    summary: "summary",
    objectives: ["Test objective one", "Test objective two"],
    category: "availability",
    roles: [{ name: "Role", description: "desc" }],
    start: "a",
    nodes: [
      {
        id: "a",
        title: "A",
        inject: "inject a",
        branches: [{ label: "go to b", next: "b" }],
      },
      { id: "b", title: "B", inject: "inject b" },
    ],
  };
}

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    scenarioId: "test-scenario",
    scenarioTitle: "Test scenario",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:30:00.000Z",
    steps: [
      {
        nodeId: "a",
        nodeTitle: "A",
        enteredAt: "2026-01-01T00:00:00.000Z",
        chosenBranchLabel: "go to b",
      },
      {
        nodeId: "b",
        nodeTitle: "B",
        enteredAt: "2026-01-01T00:10:00.000Z",
        chosenBranchLabel: null,
      },
    ],
    ...overrides,
  };
}

describe("generateAfterActionReport", () => {
  it("includes the scenario title and session details", () => {
    const report = generateAfterActionReport(scenario(), summary());

    expect(report).toContain("# After Action Report: Test scenario");
    expect(report).toContain("- Scenario: test-scenario");
    expect(report).toContain("- Audience: management");
    expect(report).toContain("- Planned duration: 45 minutes");
    expect(report).toContain("- Started: 2026-01-01T00:00:00.000Z");
    expect(report).toContain("- Finished: 2026-01-01T00:30:00.000Z");
  });

  it("lists every objective as a checkbox with a blank observed line", () => {
    const report = generateAfterActionReport(scenario(), summary());

    expect(report).toContain("- [ ] Test objective one");
    expect(report).toContain("- [ ] Test objective two");
    expect(report).toContain("Observed: _fill in_");
  });

  it("renders the path taken from transcript steps, including chosen branches and endings", () => {
    const report = generateAfterActionReport(scenario(), summary());

    expect(report).toContain("**A** — chose: go to b");
    expect(report).toContain("**B** — ending");
  });

  it("renders a deviation step distinctly from a chosen-branch step", () => {
    const report = generateAfterActionReport(
      scenario(),
      summary({
        steps: [
          {
            nodeId: "a",
            nodeTitle: "A",
            enteredAt: "2026-01-01T00:00:00.000Z",
            chosenBranchLabel: null,
            deviationDescription: "Group escalated directly to the vendor",
          },
        ],
      }),
    );

    expect(report).toContain(
      "**A** — deviation: Group escalated directly to the vendor",
    );
  });

  it("includes blank scaffold sections for observations, lessons, recommendations, and exercise feedback", () => {
    const report = generateAfterActionReport(scenario(), summary());

    expect(report).toContain("## Observations");
    expect(report).toContain("## Lessons identified");
    expect(report).toContain("## Recommendations");
    expect(report).toContain("| Recommendation | Owner | Due date |");
    expect(report).toContain("## Exercise feedback");
  });

  it("adds a mismatch note when the transcript's scenario id differs from the given scenario", () => {
    const report = generateAfterActionReport(
      scenario(),
      summary({ scenarioId: "some-other-scenario" }),
    );

    expect(report).toContain(
      'this transcript was recorded against scenario id "some-other-scenario"',
    );
  });

  it("does not add a mismatch note when the scenario ids match", () => {
    const report = generateAfterActionReport(scenario(), summary());

    expect(report).not.toContain("was recorded against scenario id");
  });
});
