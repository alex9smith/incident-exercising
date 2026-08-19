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
    let printed = "";
    output.on("data", (chunk: Buffer) => {
      printed += chunk.toString();
    });

    input.write("1\n"); // a -> b
    input.write("1\n"); // b -> c (ending)
    input.end();

    const transcriptPath = await facilitateRun(scenario(), {
      input,
      output,
      transcriptDir: dir,
    });

    expect(printed).toContain("inject a");
    expect(printed).toContain("notes a");
    expect(printed).toContain("inject b");
    expect(printed).toContain("inject c");
    expect(printed).toContain("(This is an ending.)");

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
    let printed = "";
    output.on("data", (chunk: Buffer) => {
      printed += chunk.toString();
    });

    input.write("nonsense\n");
    input.write("99\n");
    input.write("2\n"); // a -> c (ending)
    input.end();

    await facilitateRun(scenario(), { input, output, transcriptDir: dir });

    expect(printed).toContain("Please enter a number between 1 and 2.");
  });
});
