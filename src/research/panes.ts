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
