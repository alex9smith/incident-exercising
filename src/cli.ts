#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { loadScenario } from "./scenario/load.ts";
import { checkGraphIntegrity } from "./scenario/graph.ts";
import { generateFlowchart } from "./scenario/flowchart.ts";
import { facilitateRun } from "./run/facilitate.ts";

const HELP_TEXT = `incident-exercising - tabletop incident exercise tooling

Usage:
  incident-exercising validate <scenario.yaml>
  incident-exercising flowchart <scenario.yaml> [--out <file.mmd>]
  incident-exercising run <scenario.yaml> [--transcript-dir <dir>]
  incident-exercising help

Commands:
  validate    Check a scenario file against the schema and check the
              branching graph for dangling references, unreachable nodes,
              and paths with no ending.
  flowchart   Generate a Mermaid flowchart of a scenario's branching graph.
              Prints to stdout unless --out is given.
  run         Interactively facilitate a scenario in the terminal: prints
              each node's inject and facilitator notes, prompts for which
              branch the group chose, and writes a JSON transcript of the
              path taken when finished (default ./transcripts).
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case "validate":
      return runValidate(rest);
    case "flowchart":
      return runFlowchart(rest);
    case "run":
      return runFacilitate(rest);
    case "help":
    case undefined:
      console.log(HELP_TEXT);
      return 0;
    default:
      console.error(`Unknown command "${command}"\n`);
      console.log(HELP_TEXT);
      return 1;
  }
}

async function runValidate(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) {
    console.error("Usage: incident-exercising validate <scenario.yaml>");
    return 1;
  }

  const scenario = await loadScenario(filePath);
  const issues = checkGraphIntegrity(scenario);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  for (const issue of errors) {
    console.error(`error: ${issue.message}`);
  }
  for (const issue of warnings) {
    console.warn(`warning: ${issue.message}`);
  }

  if (errors.length === 0) {
    console.log(
      `${filePath} is valid (${String(scenario.nodes.length)} nodes, ${String(warnings.length)} warning(s))`,
    );
  }

  return errors.length === 0 ? 0 : 1;
}

async function runFlowchart(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) {
    console.error(
      "Usage: incident-exercising flowchart <scenario.yaml> [--out <file.mmd>]",
    );
    return 1;
  }

  const outIndex = args.indexOf("--out");
  const outPath = outIndex !== -1 ? args[outIndex + 1] : undefined;

  const scenario = await loadScenario(filePath);
  const diagram = generateFlowchart(scenario);

  if (outPath) {
    await writeFile(outPath, `${diagram}\n`, "utf8");
    console.log(`Wrote flowchart to ${outPath}`);
  } else {
    console.log(diagram);
  }

  return 0;
}

async function runFacilitate(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) {
    console.error(
      "Usage: incident-exercising run <scenario.yaml> [--transcript-dir <dir>]",
    );
    return 1;
  }

  const dirIndex = args.indexOf("--transcript-dir");
  const transcriptDir =
    (dirIndex !== -1 ? args[dirIndex + 1] : undefined) ?? "./transcripts";

  const scenario = await loadScenario(filePath);
  const issues = checkGraphIntegrity(scenario);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    for (const issue of errors) {
      console.error(`error: ${issue.message}`);
    }
    console.error(
      "\nScenario has structural errors — fix them (see `validate`) before running.",
    );
    return 1;
  }

  const transcriptPath = await facilitateRun(scenario, {
    input: process.stdin,
    output: process.stdout,
    transcriptDir,
  });
  console.log(`\nTranscript written to ${transcriptPath}`);

  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
