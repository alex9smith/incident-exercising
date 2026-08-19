import type { Branch, Scenario, ScenarioNode } from "../scenario/schema.ts";

export interface VisitedStep {
  readonly node: ScenarioNode;
  readonly enteredAt: string;
  /** The branch chosen to leave this node, or null if this was an ending. */
  readonly chosenBranch: Branch | null;
}

/**
 * Tracks progress through a scenario's branching graph during a facilitated
 * run. This holds no I/O — the CLI's run command drives it by calling
 * `choose`/`finish` in response to terminal input, which keeps the
 * branching/traversal logic unit-testable without mocking stdin.
 */
export class RunSession {
  private readonly nodesById: Map<string, ScenarioNode>;
  private readonly steps: VisitedStep[] = [];
  private currentNode: ScenarioNode;
  private readonly startedAt: string;

  constructor(
    public readonly scenario: Scenario,
    now: () => Date = () => new Date(),
  ) {
    this.nowFn = now;
    this.nodesById = new Map(scenario.nodes.map((node) => [node.id, node]));

    const startNode = this.nodesById.get(scenario.start);
    if (!startNode) {
      throw new Error(`Scenario start node "${scenario.start}" does not exist`);
    }
    this.currentNode = startNode;
    this.startedAt = this.nowFn().toISOString();
  }

  private readonly nowFn: () => Date;

  get current(): ScenarioNode {
    return this.currentNode;
  }

  get isComplete(): boolean {
    return (this.currentNode.branches ?? []).length === 0;
  }

  get history(): readonly VisitedStep[] {
    return this.steps;
  }

  /**
   * Records the branch chosen from the current node and advances to the
   * node it leads to. Throws if the current node has no branches (already
   * an ending) or if the choice does not match an available branch.
   */
  choose(branchIndex: number): ScenarioNode {
    const branches = this.currentNode.branches ?? [];
    const branch = branches[branchIndex];
    if (!branch) {
      throw new Error(
        `No branch at index ${String(branchIndex)} for node "${this.currentNode.id}" (${String(branches.length)} available)`,
      );
    }

    const nextNode = this.nodesById.get(branch.next);
    if (!nextNode) {
      // Should not happen for a scenario that passed graph validation, but
      // guard against running an unvalidated file directly.
      throw new Error(
        `Branch "${branch.label}" points to unknown node "${branch.next}"`,
      );
    }

    this.steps.push({
      node: this.currentNode,
      enteredAt: this.nowFn().toISOString(),
      chosenBranch: branch,
    });
    this.currentNode = nextNode;
    return this.currentNode;
  }

  /**
   * Finalises the session at the current (ending) node. Call once
   * `isComplete` is true.
   */
  finish(): RunSummary {
    this.steps.push({
      node: this.currentNode,
      enteredAt: this.nowFn().toISOString(),
      chosenBranch: null,
    });

    return {
      scenarioId: this.scenario.id,
      scenarioTitle: this.scenario.title,
      startedAt: this.startedAt,
      finishedAt: this.nowFn().toISOString(),
      steps: this.steps.map((step) => ({
        nodeId: step.node.id,
        nodeTitle: step.node.title,
        enteredAt: step.enteredAt,
        chosenBranchLabel: step.chosenBranch?.label ?? null,
      })),
    };
  }
}

export interface RunSummaryStep {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly enteredAt: string;
  readonly chosenBranchLabel: string | null;
}

export interface RunSummary {
  readonly scenarioId: string;
  readonly scenarioTitle: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly steps: RunSummaryStep[];
}
