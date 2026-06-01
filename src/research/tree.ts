/**
 * Decision-tree rendering for the epistemic omp extension.
 *
 * This runs INSIDE real omp (via a /tree command + setWidget) — epistemic is
 * pi.dev + extensions, not a replacement. Self-contained: works off the
 * HypothesisEntry list and the raw HYPOTHESES.md content.
 */
import type { HypothesisEntry } from "../state/repo.js";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

export interface ConditionalPlan {
  condition: string;
  ifTrue: string;
  ifFalse: string;
}

/** Parse "- **Parent:** <id>" under each "## Hypothesis: <id>" heading. */
export function parseParentEdges(content: string): Map<string, string> {
  const edges = new Map<string, string>();
  let current: string | null = null;
  for (const line of content.split("\n")) {
    if (/^# /.test(line)) { current = null; continue; }
    const h = line.match(/^## Hypothesis: (.+)/);
    if (h) { current = h[1].trim(); continue; }
    const p = line.match(/^- \*\*Parent:\*\*\s+(.+)/i);
    if (p && current) edges.set(current, p[1].trim());
  }
  return edges;
}

/** Parse "- **Decision:** <cond> → <ifTrue> | else → <ifFalse>". */
export function parseConditionalPlans(content: string): Map<string, ConditionalPlan> {
  const plans = new Map<string, ConditionalPlan>();
  let current: string | null = null;
  for (const line of content.split("\n")) {
    if (/^# /.test(line)) { current = null; continue; }
    const h = line.match(/^## Hypothesis: (.+)/);
    if (h) { current = h[1].trim(); continue; }
    const d = line.match(/^- \*\*Decision:\*\*\s+(.+?)\s*(?:→|->)\s*(.+?)\s*\|\s*else\s*(?:→|->)\s*(.+)/i);
    if (d && current) plans.set(current, { condition: d[1].trim(), ifTrue: d[2].trim(), ifFalse: d[3].trim() });
  }
  return plans;
}

/**
 * Render the research program as a top-down decision tree: nodes flow downward,
 * children hang off a vertical spine, conditional plans branch into a decision
 * fork (◇ if … → yes / no), and archived alternatives hang as side threads.
 */
export function renderResearchTree(
  entries: HypothesisEntry[],
  content: string,
  alternatives: Record<string, string[]> = {},
  selectedId?: string,
): string[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const parent = parseParentEdges(content);
  const plans = parseConditionalPlans(content);

  const childrenOf = new Map<string, string[]>();
  for (const e of entries) {
    const p = parent.get(e.id);
    if (p && byId.has(p)) childrenOf.set(p, [...(childrenOf.get(p) ?? []), e.id]);
  }

  const roots = entries.filter((e) => { const p = parent.get(e.id); return !p || !byId.has(p); });
  const lines: string[] = [];

  const walk = (id: string, prefix: string, isLast: boolean, isRoot: boolean, seen: Set<string>) => {
    const e = byId.get(id);
    if (!e || seen.has(id)) return;
    seen.add(id);

    const branch = isRoot ? "" : isLast ? "└─▶ " : "├─▶ ";
    const bullet = id === selectedId ? "▸" : "●";
    const icon = STATUS_ICON[e.status] ?? "?";
    lines.push(`${prefix}${branch}${bullet} ${icon} ${e.id}  ${e.claim.slice(0, 40)}`);

    const below = isRoot ? "" : prefix + (isLast ? "    " : "│   ");

    const plan = plans.get(id);
    if (plan) {
      lines.push(`${below}│`);
      lines.push(`${below}◇ if ${plan.condition}`);
      lines.push(`${below}├─ yes → ${plan.ifTrue}`);
      lines.push(`${below}└─ no  → ${plan.ifFalse}`);
    }
    for (const alt of alternatives[id] ?? []) lines.push(`${below}↳ alt: ${alt}`);

    const kids = childrenOf.get(id) ?? [];
    if (kids.length > 0) lines.push(`${below}│`);
    kids.forEach((kid, i) => walk(kid, below, i === kids.length - 1, false, seen));
  };

  roots.forEach((root, i) => {
    walk(root.id, "", true, true, new Set());
    if (i < roots.length - 1) lines.push("");
  });

  return lines.length ? lines : ["No hypotheses yet. Describe a research idea to begin."];
}
