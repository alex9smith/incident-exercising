import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { facilitateRun } from "./facilitate.ts";
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
        facilitator_notes: "notes a",
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

function scenarioWithBudgets(): Scenario {
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
        facilitator_notes: "notes a",
        planned_minutes: 5,
        branches: [
          { label: "go to b", next: "b" },
          { label: "go to c", next: "c" },
        ],
      },
      {
        id: "b",
        title: "B",
        inject: "inject b",
        planned_minutes: 2,
        branches: [{ label: "go to c", next: "c" }],
      },
      { id: "c", title: "C", inject: "inject c" },
    ],
  };
}

/**
 * A manually-advanceable fake clock for deterministic pacing-related
 * assertions. Each call to `now()` returns the current elapsed time and
 * then advances by `minutesPerCall` — `facilitateRun` calls the clock
 * exactly twice per node visited (once entering the node, once via
 * `RunSession` recording the transition away from it), so a fixed
 * per-call step is enough to produce predictable "actual minutes spent"
 * values without needing to hand-count calls.
 */
function steppingClock(minutesPerCall: number): () => Date {
  let elapsedMs = 0;
  return () => {
    const date = new Date(elapsedMs);
    elapsedMs += minutesPerCall * 60_000;
    return date;
  };
}

function collectOutput(output: PassThrough): { text(): string } {
  let printed = "";
  output.on("data", (chunk: Buffer) => {
    printed += chunk.toString();
  });
  return { text: () => printed };
}

describe("facilitateRun", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "incident-exercising-run-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("walks the chosen path, prints injects, and writes a transcript", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("1\n"); // a -> b
    input.write("1\n"); // b -> c (ending)
    input.end();

    const transcriptPath = await facilitateRun(scenario(), {
      input,
      output,
      transcriptDir: dir,
    });

    expect(printed.text()).toContain("inject a");
    expect(printed.text()).toContain("notes a");
    expect(printed.text()).toContain("inject b");
    expect(printed.text()).toContain("inject c");
    expect(printed.text()).toContain("(This is an ending.)");

    const transcriptRaw: unknown = JSON.parse(
      await readFile(transcriptPath, "utf8"),
    );
    expect(transcriptRaw).toMatchObject({
      scenarioId: "test-scenario",
      steps: [
        { chosenBranchLabel: "go to b" },
        { chosenBranchLabel: "go to c" },
        { chosenBranchLabel: null },
      ],
    });
  });

  it("re-prompts on invalid input before accepting a valid choice", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("nonsense\n");
    input.write("99\n");
    input.write("2\n"); // a -> c (ending)
    input.end();

    await facilitateRun(scenario(), { input, output, transcriptDir: dir });

    expect(printed.text()).toContain("Please enter a number between 0 and 2.");
  });

  it("records a deviation and ends the walkthrough when no node id is given", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("0\n"); // deviate at node a
    input.write("The group called the vendor directly instead.\n");
    input.write("\n"); // blank -> end here
    input.end();

    const transcriptPath = await facilitateRun(scenario(), {
      input,
      output,
      transcriptDir: dir,
    });

    expect(printed.text()).toContain(
      "(Walkthrough ended here due to a deviation.)",
    );

    const transcriptRaw: unknown = JSON.parse(
      await readFile(transcriptPath, "utf8"),
    );
    expect(transcriptRaw).toMatchObject({
      steps: [
        {
          nodeId: "a",
          chosenBranchLabel: null,
          deviationDescription: "The group called the vendor directly instead.",
        },
      ],
    });
  });

  it("records a deviation and resumes from an existing node when one is given", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("0\n"); // deviate at node a
    input.write("The group escalated straight to the vendor.\n");
    input.write("c\n"); // jump to node c (an ending)
    input.end();

    const transcriptPath = await facilitateRun(scenario(), {
      input,
      output,
      transcriptDir: dir,
    });

    expect(printed.text()).toContain("resumed after a deviation");
    expect(printed.text()).toContain("inject c");

    const transcriptRaw: unknown = JSON.parse(
      await readFile(transcriptPath, "utf8"),
    );
    expect(transcriptRaw).toMatchObject({
      steps: [
        {
          nodeId: "a",
          chosenBranchLabel: null,
          deviationDescription: "The group escalated straight to the vendor.",
        },
        { nodeId: "c", chosenBranchLabel: null },
      ],
    });
  });

  it("re-prompts when jumping to an unknown node id after a deviation", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("0\n");
    input.write("Something unplanned happened.\n");
    input.write("not-a-real-node\n");
    input.write("c\n");
    input.end();

    await facilitateRun(scenario(), { input, output, transcriptDir: dir });

    expect(printed.text()).toContain(
      '"not-a-real-node" is not a known node id.',
    );
  });

  it("shows the planned time budget for a node that has one set", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("1\n"); // a -> b
    input.write("1\n"); // b -> c (ending)
    input.end();

    await facilitateRun(scenarioWithBudgets(), {
      input,
      output,
      transcriptDir: dir,
      now: steppingClock(0),
    });

    expect(printed.text()).toContain("[planned time for this node: 5m]");
    expect(printed.text()).toContain("[planned time for this node: 2m]");
  });

  it("does not show a planned time line for a node with no budget set", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("2\n"); // a -> c directly (ending, no budget on c)
    input.end();

    await facilitateRun(scenarioWithBudgets(), {
      input,
      output,
      transcriptDir: dir,
      now: steppingClock(0),
    });

    const lines = printed.text().split("\n");
    const endingIndex = lines.findIndex((line) =>
      line.includes("(This is an ending.)"),
    );
    const cSectionStart = lines.findIndex((line) => line.includes("--- C ---"));
    const cSection = lines.slice(cSectionStart, endingIndex + 1).join("\n");

    expect(cSection).not.toContain("planned time for this node");
  });

  it("reports spending exactly the planned budget as on budget", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("1\n"); // a -> b, budget 5m
    input.write("1\n"); // b -> c, budget 2m (b's only branch)
    input.end();

    // Node "a"'s budget is 5m; the clock advances by 5m every call, so
    // node "a" takes exactly 5m — on budget.
    await facilitateRun(scenarioWithBudgets(), {
      input,
      output,
      transcriptDir: dir,
      now: steppingClock(5),
    });

    expect(printed.text()).toContain("[spent 5m — on budget]");
  });

  it("reports going over budget with the overage amount", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("2\n"); // a -> c directly (ending), budget 5m
    input.end();

    // Clock advances by 8m per call, so node "a" (budget 5m) takes 8m.
    await facilitateRun(scenarioWithBudgets(), {
      input,
      output,
      transcriptDir: dir,
      now: steppingClock(8),
    });

    expect(printed.text()).toContain("[spent 8m — 3m over the 5m budget]");
  });

  it("reports going under budget with the shortfall amount", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("2\n"); // a -> c directly (ending), budget 5m
    input.end();

    // Clock advances by 1m per call, so node "a" (budget 5m) takes 1m.
    await facilitateRun(scenarioWithBudgets(), {
      input,
      output,
      transcriptDir: dir,
      now: steppingClock(1),
    });

    expect(printed.text()).toContain("[spent 1m — 4m under the 5m budget]");
  });

  it("prints an overall pacing summary when at least one node had a budget", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("1\n"); // a -> b, budget 5m, actual 8m (clock step)
    input.write("1\n"); // b -> c, budget 2m, actual 8m (b's only branch)
    input.end();

    await facilitateRun(scenarioWithBudgets(), {
      input,
      output,
      transcriptDir: dir,
      now: steppingClock(8),
    });

    // Planned: 5 (a) + 2 (b) = 7m. Actual: 8 (a) + 8 (b) = 16m.
    expect(printed.text()).toContain("=== Pacing ===");
    expect(printed.text()).toContain("Planned: 7m | Actual: 16m");
    expect(printed.text()).toContain("9m over budget overall.");
  });

  it("does not print a pacing summary when no node had a budget", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const printed = collectOutput(output);

    input.write("1\n");
    input.write("1\n");
    input.end();

    await facilitateRun(scenario(), { input, output, transcriptDir: dir });

    expect(printed.text()).not.toContain("=== Pacing ===");
  });
});
