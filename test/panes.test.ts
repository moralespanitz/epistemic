import { test } from "node:test";
import assert from "node:assert/strict";
import { splitRects, renderPanes, renderPaneBlock, type PaneContent } from "../src/research/panes.js";

const pane = (title: string): PaneContent => ({ title, lines: ["line one", "line two"] });

test("splitRects tiles the area exactly — no gaps, no overlaps, full coverage", () => {
  for (const n of [1, 2, 3, 4, 5, 8, 13]) {
    const W = 120, H = 40;
    const rects = splitRects(n, 0, 0, W, H);
    assert.equal(rects.length, n, `n=${n} produces n rects`);
    // Every cell covered exactly once.
    const cover = new Uint8Array(W * H);
    for (const r of rects) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const idx = y * W + x;
          assert.equal(cover[idx], 0, `n=${n}: cell (${x},${y}) covered twice`);
          cover[idx] = 1;
        }
      }
    }
    assert.ok(cover.every((c) => c === 1), `n=${n}: full coverage`);
  }
});

test("renderPaneBlock draws a box of exactly w×h with the title in the top border", () => {
  const block = renderPaneBlock(pane("RD-A-H3"), 20, 6);
  assert.equal(block.length, 6);
  for (const row of block) assert.equal(row.length, 20);
  assert.match(block[0], /^┌.*RD-A-H3.*┐$/);
  assert.match(block[block.length - 1], /^└─+┘$/);
});

test("renderPanes returns exactly h lines, each exactly w wide, for any pane count", () => {
  for (const n of [1, 2, 4, 6]) {
    const W = 100, H = 30;
    const out = renderPanes(Array.from({ length: n }, (_, i) => pane(`P${i}`)), W, H);
    assert.equal(out.length, H);
    for (const line of out) assert.equal(line.length, W, `n=${n}: row width is W`);
  }
});

test("renderPanes places every pane's title somewhere in the buffer", () => {
  const titles = ["alpha", "beta", "gamma", "delta"];
  const out = renderPanes(titles.map(pane), 120, 24).join("\n");
  for (const t of titles) assert.match(out, new RegExp(t));
});
