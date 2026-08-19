import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import * as v from "valibot";
import { ScenarioSchema, type Scenario } from "./schema.ts";

export class ScenarioLoadError extends Error {}

export class ScenarioParseError extends Error {}

export class ScenarioValidationError extends Error {
  constructor(public readonly issues: v.BaseIssue<unknown>[]) {
    super(
      `Scenario does not match the expected schema:\n${issues
        .map((issue) => `  - ${formatIssuePath(issue)}${issue.message}`)
        .join("\n")}`,
    );
  }
}

function formatIssuePath(issue: v.BaseIssue<unknown>): string {
  if (!issue.path || issue.path.length === 0) {
    return "";
  }
  const path = issue.path.map((segment) => String(segment.key)).join(".");
  return `${path}: `;
}

/**
 * Reads a scenario YAML file from disk, parses it, and validates it against
 * the scenario schema. Does not perform graph integrity checks; use
 * `checkGraphIntegrity` from `./graph.ts` for that.
 */
export async function loadScenario(filePath: string): Promise<Scenario> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    throw new ScenarioLoadError(
      `Could not read scenario file "${filePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new ScenarioParseError(
      `Could not parse "${filePath}" as YAML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const result = v.safeParse(ScenarioSchema, parsed);
  if (!result.success) {
    throw new ScenarioValidationError(result.issues);
  }

  return result.output;
}
