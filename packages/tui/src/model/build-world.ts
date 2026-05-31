import type { HypothesisEntry } from "../epistemic-state.js";
import type {
  ExperimentRun, HypothesisNode, ResearchWorld, RunStatus, WorldInputs,
} from "./types.js";
import { parseParentEdges, parseConditionalPlans } from "./parse-edges.js";

function deriveRunStatus(
  id: string,
  inputs: WorldInputs,
  points: { trial: number; total: number }[],
): RunStatus {
  const explicit = inputs.runStatus[id]?.status;
  if (explicit) return explicit;
  const last = points[points.length - 1];
  if (last && last.total > 0 && last.trial >= last.total) return "done";
  return "pending";
}

export function buildWorld(entries: HypothesisEntry[], inputs: WorldInputs): ResearchWorld {
  const edges = parseParentEdges(inputs.hypothesesContent);
  const plans = parseConditionalPlans(inputs.hypothesesContent);

  const nodes: HypothesisNode[] = entries.map((e) => ({
    id: e.id,
    claim: e.claim,
    status: e.status,
    computeTarget: e.computeTarget,
    costCap: e.costCap,
    spent: inputs.spends[e.id] ?? 0,
    parentId: edges.get(e.id),
    childIds: [],
    alternativeIds: inputs.alternatives[e.id] ?? [],
    conditionalPlan: plans.get(e.id),
    killReason: e.killReason,
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.childIds.push(n.id);
  }

  const runs: ExperimentRun[] = entries.map((e) => {
    const points = inputs.telemetry[e.id] ?? [];
    const last = points[points.length - 1];
    return {
      id: e.id,
      status: deriveRunStatus(e.id, inputs, points),
      trialsDone: last?.trial ?? 0,
      trialsTotal: last?.total ?? e.n,
      costSeries: points.map((p) => p.cost),
      accSeries: points.filter((p) => p.acc !== undefined).map((p) => p.acc as number),
      spent: inputs.spends[e.id] ?? 0,
      costCap: e.costCap,
    };
  });

  return {
    nodes,
    runs,
    lessons: inputs.lessons,
    totalSpent: nodes.reduce((s, n) => s + n.spent, 0),
    totalCap: nodes.reduce((s, n) => s + n.costCap, 0),
  };
}
