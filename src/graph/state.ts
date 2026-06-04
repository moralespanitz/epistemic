import { parseResearchDocument, type StoryKind } from "./parser.js";
import { parseHypotheses, type HypothesisEntry } from "../state/repo.js";

export interface GraphNodeGates {
  prereg: boolean;
  judgeLock: boolean;
  baseline: boolean;
  falsif: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  description: string;
  status: "proposed" | "OPEN" | "RUNNING" | "CONFIRMED" | "FALSIFIED" | "KILLED";
  spent: number;
  costCap: number;
  stage: number;
  /** Parent node id, or null when the node hangs off the research-document root. */
  parent: string | null;
  /** What this node represents — hypothesis / ablation / fork / baseline. */
  kind: StoryKind;
  /**
   * Gate status — undefined for proposals (no hypothesis registered yet).
   * For registered hypotheses, set by the server after disk checks.
   * Consumers should check `isProposal` to distinguish the two undefined cases.
   */
  gates?: GraphNodeGates;
  isProposal: boolean;
  /** True when the node can still be forked/branched (not terminal). */
  forkable: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphRoot {
  id: "root";
  label: string;
  summary: string;
}

export interface GraphData {
  root: GraphRoot;
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: number;
}

/** Pure function — no I/O. All data pre-loaded by the caller. */
export function buildGraphData(
  researchMd: string,
  hypothesesMd: string,
  spendMap: Record<string, number>,
  resultsMd: string,
): GraphData {
  const doc = parseResearchDocument(
    researchMd || "# RD: No Research Document\n## 1. Research overview\n### 1.2 Research summary\n\n## 10. Research stories\n"
  );
  const hypotheses = hypothesesMd ? parseHypotheses(hypothesesMd) : [];
  const hypoMap = new Map<string, HypothesisEntry>(hypotheses.map(h => [h.id, h]));

  const storyIds = new Set(doc.stories.map(s => s.id));

  const nodes: GraphNode[] = doc.stories.map(story => {
    // Only honour a parent that actually exists as another node — otherwise
    // the node hangs off the root (parent: null).
    const parent = story.parent && storyIds.has(story.parent) && story.parent !== story.id
      ? story.parent : null;
    const hypo = hypoMap.get(story.id);

    if (!hypo) {
      return {
        id: story.id,
        label: story.title,
        description: story.description,
        status: "proposed" as const,
        spent: 0,
        costCap: 0,
        stage: 0,
        parent,
        kind: story.kind,
        gates: undefined,   // proposals have no gates
        isProposal: true,
        forkable: true,      // a proposal is always open to branching
      };
    }
    return {
      id: story.id,
      label: hypo.claim,
      description: story.description,
      status: hypo.status,
      spent: spendMap[story.id] ?? 0,
      costCap: hypo.costCap,
      stage: deriveStageNumber(hypo, resultsMd),
      parent,
      kind: story.kind,
      gates: undefined,  // populated by server after disk checks
      isProposal: false,
      // Forkable while still in flight — not once shipped or killed.
      forkable: hypo.status !== "KILLED" && !(hypo.status === "CONFIRMED" && resultsMd.includes(hypo.id)),
    };
  });

  // Edges follow parent relationships; parentless nodes attach to the root.
  const edges: GraphEdge[] = nodes.map(n => ({
    source: n.parent ?? "root",
    target: n.id,
  }));

  return {
    root: { id: "root", label: doc.title, summary: doc.summary },
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}

/**
 * Maps hypothesis status to epistemic pipeline stage number (1–9):
 *   1 = research-question (OPEN, unregistered)
 *   2 = preregistration (OPEN, in progress)
 *   4 = experiment-execution (RUNNING)
 *   6 = falsification-review (FALSIFIED)
 *   7 = kill-or-ship pending (CONFIRMED, results not yet in RESULTS.md)
 *   8 = kill-or-ship (KILLED)
 *   9 = verification-before-publication (CONFIRMED, in RESULTS.md)
 */
function deriveStageNumber(hypo: HypothesisEntry, resultsMd: string): number {
  switch (hypo.status) {
    case "OPEN":      return 1;
    case "RUNNING":   return 4;
    case "CONFIRMED": return resultsMd.includes(hypo.id) ? 9 : 7;
    case "FALSIFIED": return 6;
    case "KILLED":    return 8;
    default:          return 0;
  }
}
