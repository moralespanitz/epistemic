import { parseResearchDocument } from "./parser.js";
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
  // Only present for registered hypotheses — undefined for proposals
  gates?: GraphNodeGates;
  isProposal: boolean;
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

  const nodes: GraphNode[] = doc.stories.map(story => {
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
        gates: undefined,   // proposals have no gates
        isProposal: true,
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
      gates: undefined,  // populated by server after disk checks
      isProposal: false,
    };
  });

  return {
    root: { id: "root", label: doc.title, summary: doc.summary },
    nodes,
    edges: nodes.map(n => ({ source: "root", target: n.id })),
    updatedAt: Date.now(),
  };
}

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
