import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Scenario } from "../scenario/schema.ts";
import { RunSession, type RunSummary } from "./session.ts";

export interface FacilitateOptions {
  readonly input: NodeJS.ReadableStream;
  readonly output: NodeJS.WritableStream;
  /** Directory to write the JSON transcript to once the run finishes. */
  readonly transcriptDir: string;
}

/**
 * Runs an interactive terminal walkthrough of a scenario: prints each
 * node's inject and facilitator notes, prompts for which branch the group
 * chose, and repeats until an ending is reached. Writes a JSON transcript
 * of the path taken to `transcriptDir` when done.
 *
 * Returns the path to the written transcript file.
 */
export async function facilitateRun(
  scenario: Scenario,
  options: FacilitateOptions,
): Promise<string> {
  const session = new RunSession(scenario);
  const rl = createInterface({ input: options.input });
  // readline's promise-based `question()` can silently fail to resolve on
  // subsequent calls when input is a non-TTY stream (e.g. piped input in
  // tests, or input redirected from a file) because line events can fire
  // before the next `question()` call attaches its listener. Consuming
  // lines via the async iterator instead is the robust pattern for
  // repeated sequential prompts.
  const lines = rl[Symbol.asyncIterator]();
  const print = (text: string): void => {
    options.output.write(`${text}\n`);
  };

  try {
    print(`\n=== ${scenario.title} ===`);
    print(
      `Audience: ${scenario.audience} | Planned duration: ${String(scenario.duration_minutes)} min\n`,
    );

    for (;;) {
      const node = session.current;
      print(`--- ${node.title} ---`);
      print(node.inject.trim());

      if (node.facilitator_notes) {
        print(`\n[facilitator notes — do not read aloud]`);
        print(node.facilitator_notes.trim());
      }

      const branches = node.branches ?? [];
      if (branches.length === 0) {
        print("\n(This is an ending.)\n");
        break;
      }

      print("\nWhat did the group decide?");
      branches.forEach((branch, index) => {
        print(`  ${String(index + 1)}. ${branch.label}`);
      });

      const choiceIndex = await promptForChoice(
        lines,
        options.output,
        branches.length,
      );
      const nextNode = session.choose(choiceIndex);
      print(`\n-> ${nextNode.title}\n`);
    }

    const summary = session.finish();
    printSummary(summary, print);
    return await writeTranscript(summary, options.transcriptDir);
  } finally {
    rl.close();
  }
}

async function promptForChoice(
  lines: NodeJS.AsyncIterator<string>,
  output: NodeJS.WritableStream,
  optionCount: number,
): Promise<number> {
  for (;;) {
    output.write(`Choice (1-${String(optionCount)}): `);
    const { value, done } = await lines.next();
    if (done) {
      throw new Error("Input ended before a choice was made");
    }

    const choice = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(choice) && choice >= 1 && choice <= optionCount) {
      return choice - 1;
    }
    output.write(
      `Please enter a number between 1 and ${String(optionCount)}.\n`,
    );
  }
}

function printSummary(
  summary: RunSummary,
  print: (text: string) => void,
): void {
  print("=== Session summary ===");
  for (const step of summary.steps) {
    if (step.chosenBranchLabel) {
      print(`${step.nodeTitle}\n  -> ${step.chosenBranchLabel}`);
    } else {
      print(`${step.nodeTitle} (ending)`);
    }
  }
}

async function writeTranscript(
  summary: RunSummary,
  transcriptDir: string,
): Promise<string> {
  await mkdir(transcriptDir, { recursive: true });
  const fileName = `${summary.scenarioId}-${summary.startedAt.replace(/[:.]/g, "-")}.json`;
  const filePath = join(transcriptDir, fileName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return filePath;
}
