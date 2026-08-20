import type { Scenario } from "../scenario/schema.ts";
import type { RunSummary } from "./session.ts";

/**
 * Generates a Markdown After Action Report (AAR) / Improvement Plan
 * template from a completed run's transcript and the scenario it came
 * from. This deliberately does not try to infer observations, lessons, or
 * recommendations from the transcript — that synthesis is a human
 * facilitation/debrief activity (see NCSC's "Effective steps to cyber
 * exercise creation", step 9, and NIST SP 800-84's AAR guidance). What
 * this produces is the scaffold: objectives pre-listed, the path actually
 * taken pre-filled from the transcript, and blank sections ready to fill
 * in during or after the debrief.
 *
 * `scenario` should be the same scenario the transcript was produced
 * from; this is the caller's responsibility to ensure (there's no id
 * cross-check here beyond a soft warning line in the output if they
 * don't match, since re-running against an edited scenario file is a
 * reasonable thing to do).
 */
export function generateAfterActionReport(
  scenario: Scenario,
  summary: RunSummary,
): string {
  const lines: string[] = [];

  lines.push(`# After Action Report: ${scenario.title}`);
  lines.push("");
  if (summary.scenarioId !== scenario.id) {
    lines.push(
      `> Note: this transcript was recorded against scenario id "${summary.scenarioId}", ` +
        `but this report was generated from "${scenario.id}" — check they match before relying on the objectives/roles below.`,
    );
    lines.push("");
  }

  lines.push("## Session details");
  lines.push("");
  lines.push(`- Scenario: ${scenario.id}`);
  lines.push(`- Audience: ${scenario.audience}`);
  lines.push(
    `- Planned duration: ${String(scenario.duration_minutes)} minutes`,
  );
  lines.push(`- Started: ${summary.startedAt}`);
  lines.push(`- Finished: ${summary.finishedAt}`);
  lines.push("");

  lines.push("## Objectives");
  lines.push("");
  lines.push(
    "For each objective, note what was actually observed during the session that speaks to it (or note that it wasn't exercised by the path taken).",
  );
  lines.push("");
  for (const objective of scenario.objectives) {
    lines.push(`- [ ] ${objective}`);
    lines.push("  - Observed: _fill in_");
  }
  lines.push("");

  lines.push("## Path taken");
  lines.push("");
  for (const step of summary.steps) {
    if (step.deviationDescription) {
      lines.push(
        `- **${step.nodeTitle}** — deviation: ${step.deviationDescription}`,
      );
    } else if (step.chosenBranchLabel) {
      lines.push(`- **${step.nodeTitle}** — chose: ${step.chosenBranchLabel}`);
    } else {
      lines.push(`- **${step.nodeTitle}** — ending`);
    }
  }
  lines.push("");

  lines.push("## Observations");
  lines.push("");
  lines.push(
    '_What actually happened during the session — decisions, discussion, notable moments. Fill in during or immediately after the session (a "hot-wash" review)._',
  );
  lines.push("");
  lines.push("- ");
  lines.push("");

  lines.push("## Lessons identified");
  lines.push("");
  lines.push(
    "_What does the above reveal about current plans, ownership, or process — not just about this specific fictional scenario?_",
  );
  lines.push("");
  lines.push("- ");
  lines.push("");

  lines.push("## Recommendations");
  lines.push("");
  lines.push("| Recommendation | Owner | Due date |");
  lines.push("| --- | --- | --- |");
  lines.push("|  |  |  |");
  lines.push("");

  lines.push("## Exercise feedback");
  lines.push("");
  lines.push(
    "_Feedback on the exercise itself (pacing, realism, clarity of injects) — separate from feedback on the incident response performance._",
  );
  lines.push("");
  lines.push("- ");
  lines.push("");

  return lines.join("\n");
}
