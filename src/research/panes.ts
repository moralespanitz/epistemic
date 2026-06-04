/**
 * Quadtree-style split-pane layout — the core of the "fleet of subagents" POC.
 *
 * Recursively subdivides a width×height region into N non-overlapping tiles
 * (alternating column/row splits, like tmux's slice-and-dice but in-process),
 * then composes each tile's boxed content into a single 2D character buffer.
 * Pure + unit-tested. The live `epistemic fleet` app drives it with a tree of
 * (simulated) experiment subagents; here we only do geometry + drawing.
 */
export interface Rect { x: number; y: number; w: number; h: number; }

export interface PaneContent {
  title: string;
  lines: string[];
}

/**
 * Tile a region into `n` rects with no gaps or overlaps. Splits the area in two
 * (columns first, then rows, alternating with depth), recursing on each half —
 * giving the balanced quadtree look for n = 1,2,4,8… and sensible tilings for
 * any other n.
 */
export function splitRects(n: number, x: number, y: number, w: number, h: number, vertical = true): Rect[] {
  if (n <= 1) return [{ x, y, w, h }];
  const a = Math.ceil(n / 2);
  const b = n - a;
  if (vertical) {
    const wl = Math.max(1, Math.round((w * a) / n));
    return [
      ...splitRects(a, x, y, wl, h, !vertical),
      ...splitRects(b, x + wl, y, w - wl, h, !vertical),
    ];
  }
  const ht = Math.max(1, Math.round((h * a) / n));
  return [
    ...splitRects(a, x, y, w, ht, !vertical),
    ...splitRects(b, x, y + ht, w, h - ht, !vertical),
  ];
}

/**
 * A recursive pane: either a leaf (its own `lines`) or a parent that subdivides
 * its inner area among `children` — giving the n-tree of subagents real depth.
 */
export interface PaneTree {
  title: string;
  lines?: string[];
  children?: PaneTree[];
}

/** Tile pre-rendered blocks (one per rect) into a single w×h buffer. */
export function composeBlocks(blocks: string[][], rects: Rect[], w: number, h: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    const segs = rects
      .map((r, i) => (y >= r.y && y < r.y + r.h ? { x: r.x, line: blocks[i][y - r.y] } : null))
      .filter((s): s is { x: number; line: string } => s !== null)
      .sort((p, q) => p.x - q.x);
    // Shared borders: when one pane's right edge (│/┐/┘) meets the next pane's
    // left edge (│/┌/└), drop the duplicate so borders don't render as ││.
    const lines: string[] = [];
    for (let i = 0; i < segs.length; i++) {
      let line = segs[i].line;
      if (i > 0) {
        // Strip the leading border char of non-first segments to avoid ││
        const first = line[0];
        if (first === "│" || first === "┌" || first === "└") line = line.slice(1);
      }
      lines.push(line);
    }
    out.push(lines.join("").slice(0, w).padEnd(w, " "));
  }
  return out;
}

/** Minimum inner area worth subdividing further; below this we render a leaf. */
const MIN_SPLIT_W = 14;
const MIN_SPLIT_H = 5;

/**
 * Render a pane tree into an exact w×h boxed block. Parents subdivide their
 * inner area among children (recursively); when the inner area gets too small
 * to stay readable, a parent falls back to listing its children as text.
 */
export function renderPaneTree(node: PaneTree, w: number, h: number): string[] {
  if (w < 2 || h < 2) return Array.from({ length: Math.max(0, h) }, () => " ".repeat(Math.max(0, w)));
  const innerW = w - 2;
  const innerH = h - 2;
  const label = ` ${node.title} `.slice(0, innerW);
  const top = "┌" + label + "─".repeat(innerW - label.length) + "┐";
  const bottom = "└" + "─".repeat(innerW) + "┘";

  let inner: string[];
  const kids = node.children ?? [];
  if (kids.length > 0 && innerW >= MIN_SPLIT_W && innerH >= MIN_SPLIT_H) {
    const rects = splitRects(kids.length, 0, 0, innerW, innerH);
    const blocks = rects.map((r, i) => renderPaneTree(kids[i], r.w, r.h));
    inner = composeBlocks(blocks, rects, innerW, innerH);
  } else {
    // Leaf (or too-small parent): show lines, or a compact child summary.
    const lines = node.lines ?? kids.map((k) => `• ${k.title}`);
    inner = Array.from({ length: innerH }, (_, r) => {
      const raw = lines[r] ?? "";
      return raw.length > innerW ? raw.slice(0, innerW) : raw + " ".repeat(innerW - raw.length);
    });
  }
  return [top, ...inner.map((l) => "│" + l + "│"), bottom];
}

/** Tile a forest of pane trees across a w×h region (the top-level split). */
export function renderForest(nodes: PaneTree[], w: number, h: number): string[] {
  if (nodes.length === 0) return Array.from({ length: h }, () => " ".repeat(w));
  const rects = splitRects(nodes.length, 0, 0, w, h);
  const blocks = rects.map((r, i) => renderPaneTree(nodes[i], r.w, r.h));
  return composeBlocks(blocks, rects, w, h);
}

/** Render one pane as a boxed block of exactly `w`×`h` characters (plain). */
export function renderPaneBlock(pane: PaneContent, w: number, h: number): string[] {
  if (w < 2 || h < 2) return Array.from({ length: Math.max(0, h) }, () => " ".repeat(Math.max(0, w)));
  const inner = w - 2;
  const label = ` ${pane.title} `.slice(0, inner);
  const top = "┌" + label + "─".repeat(inner - label.length) + "┐";
  const bottom = "└" + "─".repeat(inner) + "┘";
  const rows = [top];
  for (let r = 0; r < h - 2; r++) {
    const raw = pane.lines[r] ?? "";
    const cell = raw.length > inner ? raw.slice(0, inner) : raw + " ".repeat(inner - raw.length);
    rows.push("│" + cell + "│");
  }
  rows.push(bottom);
  return rows;
}

/**
 * Compose `panes` into a w×h buffer of split tiles. Because the tiles partition
 * every row exactly, each output row is just its tile-segments concatenated in
 * x-order — so the result is always exactly `h` lines of width `w`.
 */
export function renderPanes(panes: PaneContent[], w: number, h: number): string[] {
  if (panes.length === 0) return Array.from({ length: h }, () => " ".repeat(w));
  const rects = splitRects(panes.length, 0, 0, w, h);
  const blocks = rects.map((r, i) => renderPaneBlock(panes[i], r.w, r.h));

  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    const segs = rects
      .map((r, i) => ({ x: r.x, line: y >= r.y && y < r.y + r.h ? blocks[i][y - r.y] : null }))
      .filter((s) => s.line !== null)
      .sort((p, q) => p.x - q.x)
      .map((s) => s.line as string);
    out.push(segs.join("").slice(0, w).padEnd(w, " "));
  }
  return out;
}
