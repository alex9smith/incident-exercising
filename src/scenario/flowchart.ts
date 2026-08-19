import type { Scenario } from "./schema.ts";

/**
 * Generates a Mermaid `flowchart TD` diagram from a scenario's branching
 * graph. Node boxes show the node title; edges are labelled with the
 * branch label that leads to them. The start node is marked distinctly.
 */
export function generateFlowchart(scenario: Scenario): string {
  const lines: string[] = ["flowchart TD"];

  for (const node of scenario.nodes) {
    const shape =
      node.id === scenario.start
        ? `${mermaidId(node.id)}(["${escapeLabel(node.title)}"])`
        : (node.branches ?? []).length === 0
          ? `${mermaidId(node.id)}[["${escapeLabel(node.title)}"]]`
          : `${mermaidId(node.id)}["${escapeLabel(node.title)}"]`;
    lines.push(`    ${shape}`);
  }

  for (const node of scenario.nodes) {
    for (const branch of node.branches ?? []) {
      lines.push(
        `    ${mermaidId(node.id)} -->|"${escapeLabel(branch.label)}"| ${mermaidId(branch.next)}`,
      );
    }
  }

  return lines.join("\n");
}

function mermaidId(id: string): string {
  // Mermaid node ids can't contain spaces or most punctuation; scenario
  // node ids are expected to be slug-like already, but sanitise defensively.
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, "'").replace(/\r?\n/g, " ");
}
