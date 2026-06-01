import type { HypothesisNode } from "../model/types.js";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

/**
 * Render the research program as a top-down decision tree: nodes flow downward,
 * children hang off a vertical spine, and a hypothesis with a conditional plan
 * branches into an explicit decision fork (◇ if … → yes / no). Alternatives hang
 * as side threads. Each independent root is its own tree, separated by a blank line.
 */
export function treeLines(nodes: HypothesisNode[], selectedId?: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
  const lines: string[] = [];

  const walk = (node: HypothesisNode, prefix: string, isLast: boolean, isRoot: boolean, visited: Set<string>) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    const branch = isRoot ? "" : isLast ? "└─▶ " : "├─▶ ";
    const bullet = node.id === selectedId ? "▸" : "●";
    const icon = STATUS_ICON[node.status] ?? "?";
    lines.push(`${prefix}${branch}${bullet} ${icon} ${node.id}  ${node.claim.slice(0, 36)}`);

    // Everything below this node is indented under its spine.
    const below = isRoot ? "" : prefix + (isLast ? "    " : "│   ");

    // Decision fork from the conditional plan.
    if (node.conditionalPlan) {
      const p = node.conditionalPlan;
      lines.push(`${below}│`);
      lines.push(`${below}◇ if ${p.condition}`);
      lines.push(`${below}├─ yes → ${p.ifTrue}`);
      lines.push(`${below}└─ no  → ${p.ifFalse}`);
    }

    // Alternative threads.
    for (const alt of node.alternativeIds) {
      lines.push(`${below}↳ alt: ${alt}`);
    }

    const children = node.childIds.map((id) => byId.get(id)).filter((c): c is HypothesisNode => !!c);
    if (children.length > 0) lines.push(`${below}│`);
    children.forEach((child, i) => walk(child, below, i === children.length - 1, false, visited));
  };

  roots.forEach((root, i) => {
    walk(root, "", true, true, new Set());
    if (i < roots.length - 1) lines.push("");
  });

  return lines;
}
