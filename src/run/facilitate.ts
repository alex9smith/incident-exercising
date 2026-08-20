import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Scenario, ScenarioNode } from "../scenario/schema.ts";
import { RunSession, type RunSummary } from "./session.ts";

export interface FacilitateOptions {
  readonly input: NodeJS.ReadableStream;
  readonly output: NodeJS.WritableStream;
  /** Directory to write the JSON transcript to once the run finishes. */
  readonly transcriptDir: string;
  /**
   * Clock used to time how long the group actually spends at each node,
   * for the planned-vs-actual budget display. Defaults to the real clock;
   * tests can inject a fake one for deterministic duration assertions.
   */
  readonly now?: () => Date;
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
  const now = options.now ?? (() => new Date());
  const session = new RunSession(scenario, now);
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

  let plannedMinutesSoFar = 0;
  let actualMinutesSoFar = 0;

  try {
    print(`\n=== ${scenario.title} ===`);
    print(
      `Audience: ${scenario.audience} | Planned duration: ${String(scenario.duration_minutes)} min\n`,
    );

    for (;;) {
      const node = session.current;
      const nodeEnteredAt = now();
      print(`--- ${node.title} ---`);
      print(node.inject.trim());

      if (node.facilitator_notes) {
        print(`\n[facilitator notes — do not read aloud]`);
        print(node.facilitator_notes.trim());
      }

      if (node.planned_minutes !== undefined) {
        print(
          `\n[planned time for this node: ${formatMinutes(node.planned_minutes)}]`,
        );
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
        const leftAt = latestStepTimestamp(session);
        printBudgetOutcome(node, nodeEnteredAt, leftAt, print);
        ({ plannedMinutesSoFar, actualMinutesSoFar } = accumulatePacing(
          node,
          nodeEnteredAt,
          leftAt,
          plannedMinutesSoFar,
          actualMinutesSoFar,
        ));
        if (finished) {
          break;
        }
        continue;
      }

      const nextNode = session.choose(choiceIndex);
      const leftAt = latestStepTimestamp(session);
      printBudgetOutcome(node, nodeEnteredAt, leftAt, print);
      ({ plannedMinutesSoFar, actualMinutesSoFar } = accumulatePacing(
        node,
        nodeEnteredAt,
        leftAt,
        plannedMinutesSoFar,
        actualMinutesSoFar,
      ));
      print(`\n-> ${nextNode.title}\n`);
    }

    const summary = session.finish();
    printSummary(summary, print);
    if (plannedMinutesSoFar > 0) {
      printPacingTotal(plannedMinutesSoFar, actualMinutesSoFar, print);
    }
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

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 60_000);
}

/**
 * Reads the timestamp `RunSession` just recorded for the most recent step
 * (from `choose` or `deviateTo`) rather than calling the clock again.
 * `RunSession` already calls `now()` once per transition to stamp the
 * transcript; reusing that value here keeps the "when did we leave this
 * node" timestamp used for the budget display and the transcript in
 * exact agreement, and avoids an extra, easy-to-miscount clock call.
 */
function latestStepTimestamp(session: RunSession): Date {
  const lastStep = session.history[session.history.length - 1];
  if (!lastStep) {
    throw new Error("Expected at least one recorded step by this point");
  }
  return new Date(lastStep.enteredAt);
}

/**
 * Adds a node's planned/actual minutes to the running pacing totals, if
 * the node had a budget set. Returns a new totals object rather than
 * mutating, to keep the call sites at each branch point straightforward.
 */
function accumulatePacing(
  node: ScenarioNode,
  enteredAt: Date,
  leftAt: Date,
  plannedMinutesSoFar: number,
  actualMinutesSoFar: number,
): { plannedMinutesSoFar: number; actualMinutesSoFar: number } {
  if (node.planned_minutes === undefined) {
    return { plannedMinutesSoFar, actualMinutesSoFar };
  }

  return {
    plannedMinutesSoFar: plannedMinutesSoFar + node.planned_minutes,
    actualMinutesSoFar: actualMinutesSoFar + minutesBetween(enteredAt, leftAt),
  };
}

function formatMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (wholeMinutes === 0) {
    return `${String(seconds)}s`;
  }
  if (seconds === 0) {
    return `${String(wholeMinutes)}m`;
  }
  return `${String(wholeMinutes)}m ${String(seconds)}s`;
}

/**
 * Prints how long the group actually spent at a node compared to its
 * `planned_minutes` budget, once the group has moved on (or deviated).
 * Does nothing if the node has no budget set.
 */
function printBudgetOutcome(
  node: ScenarioNode,
  enteredAt: Date,
  leftAt: Date,
  print: (text: string) => void,
): void {
  if (node.planned_minutes === undefined) {
    return;
  }

  const actualMinutes = minutesBetween(enteredAt, leftAt);
  const diffMinutes = actualMinutes - node.planned_minutes;

  if (Math.abs(diffMinutes) < 1 / 60) {
    print(`[spent ${formatMinutes(actualMinutes)} — on budget]`);
    return;
  }

  const overOrUnder = diffMinutes > 0 ? "over" : "under";
  print(
    `[spent ${formatMinutes(actualMinutes)} — ${formatMinutes(Math.abs(diffMinutes))} ${overOrUnder} the ${formatMinutes(node.planned_minutes)} budget]`,
  );
}

/**
 * Prints a running total of planned vs. actual time across every node
 * that had a `planned_minutes` budget, once the session ends. Nodes
 * without a budget are excluded from both sides of the comparison, so
 * this reflects pacing only for the parts of the scenario the author
 * chose to budget.
 */
function printPacingTotal(
  plannedMinutes: number,
  actualMinutes: number,
  print: (text: string) => void,
): void {
  const diffMinutes = actualMinutes - plannedMinutes;
  print("\n=== Pacing ===");
  print(
    `Planned: ${formatMinutes(plannedMinutes)} | Actual: ${formatMinutes(actualMinutes)}`,
  );

  if (Math.abs(diffMinutes) < 1 / 60) {
    print("On budget overall.");
    return;
  }

  const overOrUnder = diffMinutes > 0 ? "over" : "under";
  print(
    `${formatMinutes(Math.abs(diffMinutes))} ${overOrUnder} budget overall.`,
  );
}
