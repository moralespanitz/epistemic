import type { HypothesisNode } from "../model/types.js";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

/** Render the hypothesis forest as indented ASCII lines. */
export function treeLines(nodes: HypothesisNode[], selectedId?: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
  const lines: string[] = [];

  const walk = (node: HypothesisNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const marker = node.id === selectedId ? "▸" : " ";
    const icon = STATUS_ICON[node.status] ?? "?";
    lines.push(`${indent}${marker} ${icon} ${node.id}  ${node.claim.slice(0, 40)}`);
    for (const childId of node.childIds) {
      const child = byId.get(childId);
      if (child) walk(child, depth + 1);
    }
  };

  for (const root of roots) walk(root, 0);
  return lines;
}
