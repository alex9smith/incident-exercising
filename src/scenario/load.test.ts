import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadScenario,
  ScenarioLoadError,
  ScenarioParseError,
  ScenarioValidationError,
} from "./load.ts";

const VALID_SCENARIO = `
id: test-scenario
title: Test scenario
audience: exec
duration_minutes: 30
summary: A summary
objectives:
  - An objective
category: security
roles:
  - name: Role
    description: A role
start: a
nodes:
  - id: a
    title: A
    inject: Something happens
`;

describe("loadScenario", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "incident-exercising-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads and validates a well-formed scenario file", async () => {
    const filePath = join(dir, "scenario.yaml");
    await writeFile(filePath, VALID_SCENARIO, "utf8");

    const scenario = await loadScenario(filePath);
    expect(scenario.id).toBe("test-scenario");
    expect(scenario.nodes).toHaveLength(1);
  });

  it("throws ScenarioLoadError when the file does not exist", async () => {
    await expect(
      loadScenario(join(dir, "does-not-exist.yaml")),
    ).rejects.toBeInstanceOf(ScenarioLoadError);
  });

  it("throws ScenarioParseError for invalid YAML", async () => {
    const filePath = join(dir, "bad.yaml");
    await writeFile(filePath, "id: [unclosed", "utf8");

    await expect(loadScenario(filePath)).rejects.toBeInstanceOf(
      ScenarioParseError,
    );
  });

  it("throws ScenarioValidationError when required fields are missing", async () => {
    const filePath = join(dir, "incomplete.yaml");
    await writeFile(filePath, "id: test-scenario\n", "utf8");

    await expect(loadScenario(filePath)).rejects.toBeInstanceOf(
      ScenarioValidationError,
    );
  });

  it("throws ScenarioValidationError when audience is not a known level", async () => {
    const filePath = join(dir, "bad-audience.yaml");
    await writeFile(
      filePath,
      VALID_SCENARIO.replace("audience: exec", "audience: intern"),
      "utf8",
    );

    await expect(loadScenario(filePath)).rejects.toBeInstanceOf(
      ScenarioValidationError,
    );
  });
});
