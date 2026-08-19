import type { Branch, Scenario, ScenarioNode } from "../scenario/schema.ts";

export interface VisitedStep {
  readonly node: ScenarioNode;
  readonly enteredAt: string;
  /** The branch chosen to leave this node, or null if this was an ending. */
  readonly chosenBranch: Branch | null;
  /**
   * Set when the group did something not covered by any listed branch.
   * `chosenBranch` is null in this case; this holds the facilitator's
   * free-text description of what actually happened instead.
   */
  readonly deviationDescription?: string;
}

/**
 * Tracks progress through a scenario's branching graph during a facilitated
 * run. This holds no I/O — the CLI's run command drives it by calling
 * `choose`/`deviateTo`/`finish` in response to terminal input, which keeps
 * the branching/traversal logic unit-testable without mocking stdin.
 */
export class RunSession {
  private readonly nodesById: Map<string, ScenarioNode>;
  private readonly steps: VisitedStep[] = [];
  private currentNode: ScenarioNode;
  private readonly startedAt: string;
  private finished = false;

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

  /**
   * True once the session has ended, either because the current node has
   * no branches (a real ending), or because the group deviated and the
   * facilitator chose to end the walkthrough there rather than jump to
   * another node.
   */
  get isComplete(): boolean {
    return this.finished || (this.currentNode.branches ?? []).length === 0;
  }

  get history(): readonly VisitedStep[] {
    return this.steps;
  }

  /** Ids of every node in the scenario, for picking a node to jump to. */
  get allNodeIds(): readonly string[] {
    return this.scenario.nodes.map((node) => node.id);
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
   * Records that the group did something not covered by any listed
   * branch. Pass `nextNodeId` to jump to an existing node and continue the
   * walkthrough from there, or omit it to end the walkthrough at the
   * current node. Throws if `nextNodeId` is given but doesn't exist.
   */
  deviateTo(description: string, nextNodeId?: string): ScenarioNode | null {
    const nextNode = nextNodeId ? this.nodesById.get(nextNodeId) : undefined;
    if (nextNodeId && !nextNode) {
      throw new Error(`Node "${nextNodeId}" does not exist`);
    }

    this.steps.push({
      node: this.currentNode,
      enteredAt: this.nowFn().toISOString(),
      chosenBranch: null,
      deviationDescription: description,
    });

    if (!nextNode) {
      this.finished = true;
      return null;
    }

    this.currentNode = nextNode;
    return this.currentNode;
  }

  /**
   * Finalises the session at the current node. Call once `isComplete` is
   * true. Safe to call even if the last recorded step already covered the
   * current node (a deviation with no further node) — does not push a
   * duplicate step in that case.
   */
  finish(): RunSummary {
    const lastStep = this.steps[this.steps.length - 1];
    const alreadyRecordedCurrentNode =
      this.finished && lastStep?.node.id === this.currentNode.id;

    if (!alreadyRecordedCurrentNode) {
      this.steps.push({
        node: this.currentNode,
        enteredAt: this.nowFn().toISOString(),
        chosenBranch: null,
      });
    }

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
        ...(step.deviationDescription !== undefined
          ? { deviationDescription: step.deviationDescription }
          : {}),
      })),
    };
  }
}

export interface RunSummaryStep {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly enteredAt: string;
  readonly chosenBranchLabel: string | null;
  readonly deviationDescription?: string;
}

export interface RunSummary {
  readonly scenarioId: string;
  readonly scenarioTitle: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly steps: RunSummaryStep[];
}
