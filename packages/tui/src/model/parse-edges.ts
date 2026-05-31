import type { ConditionalPlan } from "./types.js";

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

/**
 * Parse conditional plans of the form:
 *   - **Decision:** <condition> → <ifTrue> | else → <ifFalse>
 * Accepts both "→" and "->" as the arrow.
 */
export function parseConditionalPlans(content: string): Map<string, ConditionalPlan> {
  const plans = new Map<string, ConditionalPlan>();
  let current: string | null = null;
  for (const line of content.split("\n")) {
    if (/^# /.test(line)) { current = null; continue; }
    const h = line.match(/^## Hypothesis: (.+)/);
    if (h) { current = h[1].trim(); continue; }
    const d = line.match(/^- \*\*Decision:\*\*\s+(.+?)\s*(?:→|->)\s*(.+?)\s*\|\s*else\s*(?:→|->)\s*(.+)/i);
    if (d && current) {
      plans.set(current, { condition: d[1].trim(), ifTrue: d[2].trim(), ifFalse: d[3].trim() });
    }
  }
  return plans;
}
