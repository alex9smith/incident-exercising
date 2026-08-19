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
 * chose, and repeats until an ending is reached. If the group did
 * something not covered by any listed branch, the facilitator can record
 * a free-text description and either jump to an existing node to keep
 * going, or end the walkthrough there. Writes a JSON transcript of the
 * path taken (including any deviation) to `transcriptDir` when done.
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
      print(`  0. Something else (the group did something not listed above)`);

      const choiceIndex = await promptForChoice(
        lines,
        options.output,
        branches.length,
      );

      if (choiceIndex === "deviate") {
        const finished = await handleDeviation(
          session,
          lines,
          print,
          options.output,
        );
        if (finished) {
          break;
        }
        continue;
      }

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

/**
 * Prompts for a free-text description of what the group actually did,
 * then asks whether to jump to an existing node or end the walkthrough
 * there. Returns true if the walkthrough should stop (nothing more to
 * print), false if it should continue from the node the session jumped to.
 */
async function handleDeviation(
  session: RunSession,
  lines: NodeJS.AsyncIterator<string>,
  print: (text: string) => void,
  output: NodeJS.WritableStream,
): Promise<boolean> {
  print("\nDescribe what the group actually decided (used in the transcript):");
  const description = await promptForLine(lines, output);

  print(
    "\nJump to an existing node to keep going, or leave blank to end the walkthrough here.",
  );
  print(`Available node ids: ${session.allNodeIds.join(", ")}`);

  for (;;) {
    const answer = await promptForLine(lines, output, "Node id (or blank): ");
    const trimmed = answer.trim();

    if (trimmed === "") {
      session.deviateTo(description);
      print("\n(Walkthrough ended here due to a deviation.)\n");
      return true;
    }

    if (session.allNodeIds.includes(trimmed)) {
      const nextNode = session.deviateTo(description, trimmed);
      if (nextNode) {
        print(`\n-> ${nextNode.title} (resumed after a deviation)\n`);
      }
      return false;
    }

    print(`"${trimmed}" is not a known node id. Try again.`);
  }
}

type ChoiceResult = number | "deviate";

async function promptForChoice(
  lines: NodeJS.AsyncIterator<string>,
  output: NodeJS.WritableStream,
  optionCount: number,
): Promise<ChoiceResult> {
  for (;;) {
    output.write(`Choice (0-${String(optionCount)}): `);
    const { value, done } = await lines.next();
    if (done) {
      throw new Error("Input ended before a choice was made");
    }

    const trimmed = value.trim();
    if (trimmed === "0") {
      return "deviate";
    }

    const choice = Number.parseInt(trimmed, 10);
    if (Number.isInteger(choice) && choice >= 1 && choice <= optionCount) {
      return choice - 1;
    }
    output.write(
      `Please enter a number between 0 and ${String(optionCount)}.\n`,
    );
  }
}

async function promptForLine(
  lines: NodeJS.AsyncIterator<string>,
  output: NodeJS.WritableStream,
  prompt = "> ",
): Promise<string> {
  output.write(prompt);
  const { value, done } = await lines.next();
  if (done) {
    throw new Error("Input ended before a response was given");
  }
  return value.trim();
}

function printSummary(
  summary: RunSummary,
  print: (text: string) => void,
): void {
  print("=== Session summary ===");
  for (const step of summary.steps) {
    if (step.deviationDescription) {
      print(`${step.nodeTitle}\n  -> [deviation] ${step.deviationDescription}`);
    } else if (step.chosenBranchLabel) {
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
