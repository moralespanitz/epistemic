/** Parse "- **Parent:** <id>" fields under each "## Hypothesis: <id>" heading. */
export function parseParentEdges(content: string): Map<string, string> {
  const edges = new Map<string, string>();
  let current: string | null = null;
  for (const line of content.split("\n")) {
    // Top-level heading resets scope
    if (/^# /.test(line)) { current = null; continue; }
    const h = line.match(/^## Hypothesis: (.+)/);
    if (h) { current = h[1].trim(); continue; }
    const p = line.match(/^- \*\*Parent:\*\*\s+(.+)/i);
    if (p && current) edges.set(current, p[1].trim());
  }
  return edges;
}
