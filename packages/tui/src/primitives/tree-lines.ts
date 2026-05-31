import type { HypothesisNode } from "../model/types.js";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

/**
 * Render the hypothesis forest as indented ASCII lines using box-drawing
 * connectors. Each independent root becomes its own parallel tree. Under each
 * node we render its conditional plan (if any) and archived alternatives as
 * sideways branches.
 */
export function treeLines(nodes: HypothesisNode[], selectedId?: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
  const lines: string[] = [];

  const walk = (node: HypothesisNode, prefix: string, isLast: boolean, isRoot: boolean, visited: Set<string>) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
    const marker = node.id === selectedId ? "▸" : " ";
    const icon = STATUS_ICON[node.status] ?? "?";
    lines.push(`${prefix}${connector}${marker}${icon} ${node.id}  ${node.claim.slice(0, 38)}`);

    // Continuation prefix for everything nested under this node.
    const childPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");

    // Conditional plan rendered as a dotted decision branch.
    if (node.conditionalPlan) {
      const p = node.conditionalPlan;
      lines.push(`${childPrefix}  ⋯ if ${p.condition} → ${p.ifTrue}`);
      lines.push(`${childPrefix}  ⋯ else → ${p.ifFalse}`);
    }

    // Archived alternatives as sideways branches.
    for (const alt of node.alternativeIds) {
      lines.push(`${childPrefix}  ↳ alt: ${alt}`);
    }

    const children = node.childIds.map((id) => byId.get(id)).filter((c): c is HypothesisNode => !!c);
    children.forEach((child, i) => {
      walk(child, childPrefix, i === children.length - 1, false, visited);
    });
  };

  roots.forEach((root, i) => {
    walk(root, "", true, true, new Set());
    // Blank separator between parallel trees (not after the last).
    if (i < roots.length - 1) lines.push("");
  });

  return lines;
}
