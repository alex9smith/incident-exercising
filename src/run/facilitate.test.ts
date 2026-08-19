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
});
