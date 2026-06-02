/**
 * Centered top-down tree diagram (the GeeksforGeeks-style layout): the root
 * sits at the top, children fan out below it, and box-drawing branches
 * (┌ ┴ ┐ │) connect a parent to its children. Much easier to read at a glance
 * than a left-indented list — you see the shape of the research program.
 *
 * Pure + unit-tested. Nodes are kept compact (status icon + id); the full
 * claim / decision for the selected node is shown as a caption by the caller.
 */
import type { HypothesisEntry } from "../state/repo.js";
import { visibleWidth } from "@earendil-works/pi-tui";
import { parseParentEdges } from "./tree.js";
import { byStatus, cyan, dim } from "../tui/color.js";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

interface Block { lines: string[]; width: number; center: number; }

// Pad to a target VISIBLE width — labels may contain ANSI color codes, so plain
// .length would over-pad. visibleWidth ignores the escape sequences.
const padRight = (s: string, w: number): string => s + " ".repeat(Math.max(0, w - visibleWidth(s)));

/** Center a string within a visible width (pad both sides). */
function center(s: string, w: number): string {
  const pad = Math.max(0, w - visibleWidth(s));
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + s + " ".repeat(pad - left);
}

/** A node is 1–2 centered lines: the id, plus an optional live-state sub-line. */
function nodeHeader(e: HypothesisEntry, selectedId: string | undefined, sub?: string): string[] {
  const icon = STATUS_ICON[e.status] ?? "?";
  const selected = e.id === selectedId;
  const text = `${selected ? "▸" : "●"}${icon} ${e.id}`;
  const top = selected ? cyan(text) : byStatus(e.status, text);
  return sub ? [top, dim(sub)] : [top];
}

const GAP = 3; // horizontal space between adjacent sibling subtrees

function layout(
  id: string,
  childrenOf: Map<string, string[]>,
  byId: Map<string, HypothesisEntry>,
  selectedId: string | undefined,
  sub: Record<string, string>,
  seen: Set<string>,
): Block {
  const e = byId.get(id)!;
  const header = nodeHeader(e, selectedId, sub[id]);
  const headerW = Math.max(...header.map(visibleWidth));
  const headerCentered = header.map((l) => center(l, headerW)); // each line centered in the node box
  const kids = (childrenOf.get(id) ?? []).filter((k) => !seen.has(k));
  kids.forEach((k) => seen.add(k));

  if (kids.length === 0) {
    return { lines: headerCentered, width: headerW, center: Math.floor((headerW - 1) / 2) };
  }

  const blocks = kids.map((k) => layout(k, childrenOf, byId, selectedId, sub, seen));

  // Lay child subtrees side by side, separated by GAP.
  const height = Math.max(...blocks.map((b) => b.lines.length));
  const offsets: number[] = [];
  let x = 0;
  blocks.forEach((b, i) => { if (i > 0) x += GAP; offsets.push(x); x += b.width; });
  const totalWidth = x;

  const childRows: string[] = [];
  for (let r = 0; r < height; r++) {
    let row = "";
    blocks.forEach((b, i) => {
      if (i > 0) row += " ".repeat(GAP);
      row += padRight(b.lines[r] ?? "", b.width);
    });
    childRows.push(padRight(row, totalWidth));
  }

  const childCenters = blocks.map((b, i) => offsets[i] + b.center);
  const minC = childCenters[0];
  const maxC = childCenters[childCenters.length - 1];
  let parentCenter = Math.round((minC + maxC) / 2);

  // Connector row linking the parent (above) to each child (below).
  const conn = new Array(totalWidth).fill(" ");
  if (kids.length === 1) {
    parentCenter = childCenters[0];
    conn[parentCenter] = "│";
  } else {
    for (let i = minC; i <= maxC; i++) conn[i] = "─";
    for (const c of childCenters) conn[c] = "┬";
    conn[minC] = "┌";
    conn[maxC] = "┐";
    conn[parentCenter] = childCenters.includes(parentCenter) ? "┼" : "┴";
  }
  let connRow = dim(conn.join(""));

  // Center the (1–2 line) header block over parentCenter; if it would start
  // left of 0, shift the whole child block (and connector) right to make room.
  let headerStart = parentCenter - Math.floor((headerW - 1) / 2);
  const shift = headerStart < 0 ? -headerStart : 0;
  const sp = " ".repeat(shift);
  const shiftedChildRows = childRows.map((r) => sp + r);
  connRow = sp + connRow;
  parentCenter += shift;
  headerStart = parentCenter - Math.floor((headerW - 1) / 2);
  const headerRows = headerCentered.map((l) => " ".repeat(headerStart) + l);

  const all = [...headerRows, connRow, ...shiftedChildRows];
  const blockWidth = Math.max(...all.map((r) => visibleWidth(r)));
  const lines = all.map((r) => padRight(r, blockWidth));
  return { lines, width: blockWidth, center: parentCenter };
}

/**
 * Render the research program as one centered tree per root, stacked vertically.
 */
export function renderTreeDiagram(
  entries: HypothesisEntry[],
  content: string,
  selectedId?: string,
  sub: Record<string, string> = {},
): string[] {
  if (entries.length === 0) return ["No hypotheses yet. Describe a research idea to begin."];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const parent = parseParentEdges(content);

  const childrenOf = new Map<string, string[]>();
  for (const e of entries) {
    const p = parent.get(e.id);
    if (p && byId.has(p)) childrenOf.set(p, [...(childrenOf.get(p) ?? []), e.id]);
  }
  const roots = entries.filter((e) => { const p = parent.get(e.id); return !p || !byId.has(p); });

  const seen = new Set<string>();
  const out: string[] = [];
  roots.forEach((root, i) => {
    if (seen.has(root.id)) return;
    seen.add(root.id);
    const block = layout(root.id, childrenOf, byId, selectedId, sub, seen);
    if (i > 0) out.push("");
    out.push(...block.lines);
  });
  return out.length ? out : ["No hypotheses yet. Describe a research idea to begin."];
}
