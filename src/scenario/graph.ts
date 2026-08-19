import type { Scenario } from "./schema.ts";

export interface GraphIssue {
  readonly severity: "error" | "warning";
  readonly message: string;
}

/**
 * Checks the branching graph of a scenario for structural problems that the
 * shape schema cannot express: dangling references, duplicate ids,
 * unreachable nodes, and dead ends with no path to an ending.
 *
 * This does not throw; it returns a list of issues so callers (e.g. the
 * `validate` CLI command) can decide how to report errors vs warnings.
 */
export function checkGraphIntegrity(scenario: Scenario): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const nodesById = new Map<string, Scenario["nodes"][number]>();

  for (const node of scenario.nodes) {
    if (nodesById.has(node.id)) {
      issues.push({
        severity: "error",
        message: `Duplicate node id "${node.id}"`,
      });
      continue;
    }
    nodesById.set(node.id, node);
  }

  if (!nodesById.has(scenario.start)) {
    issues.push({
      severity: "error",
      message: `start node "${scenario.start}" does not exist`,
    });
  }

  for (const node of scenario.nodes) {
    for (const branch of node.branches ?? []) {
      if (!nodesById.has(branch.next)) {
        issues.push({
          severity: "error",
          message: `Node "${node.id}" has a branch ("${branch.label}") pointing to unknown node "${branch.next}"`,
        });
      }
    }
  }

  if (issues.some((issue) => issue.severity === "error")) {
    // Reachability analysis assumes a well-formed graph; bail out early so
    // we don't produce confusing secondary warnings on top of real errors.
    return issues;
  }

  const reachable = collectReachable(scenario.start, nodesById);

  for (const node of scenario.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({
        severity: "warning",
        message: `Node "${node.id}" is not reachable from start node "${scenario.start}"`,
      });
    }
  }

  const canReachEnd = new Set<string>();
  for (const node of scenario.nodes) {
    if (canReachAnEnding(node.id, nodesById, new Set())) {
      canReachEnd.add(node.id);
    }
  }

  if (reachable.has(scenario.start) && !canReachEnd.has(scenario.start)) {
    issues.push({
      severity: "warning",
      message: `No path from start node "${scenario.start}" leads to an ending (a node with no branches) — every path may loop indefinitely`,
    });
  }

  return issues;
}

function collectReachable(
  start: string,
  nodesById: Map<string, Scenario["nodes"][number]>,
): Set<string> {
  const visited = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (currentId === undefined || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const node = nodesById.get(currentId);
    for (const branch of node?.branches ?? []) {
      stack.push(branch.next);
    }
  }

  return visited;
}

function canReachAnEnding(
  nodeId: string,
  nodesById: Map<string, Scenario["nodes"][number]>,
  visiting: Set<string>,
): boolean {
  const node = nodesById.get(nodeId);
  if (!node) {
    return false;
  }

  const branches = node.branches ?? [];
  if (branches.length === 0) {
    return true;
  }

  if (visiting.has(nodeId)) {
    // Already exploring this node further up the call stack: treat as a
    // dead end for this path to avoid infinite recursion on cycles.
    return false;
  }

  const nextVisiting = new Set(visiting);
  nextVisiting.add(nodeId);

  return branches.some((branch) =>
    canReachAnEnding(branch.next, nodesById, nextVisiting),
  );
}
