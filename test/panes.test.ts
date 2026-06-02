import { test } from "node:test";
import assert from "node:assert/strict";
import { splitRects, renderPanes, renderPaneBlock, renderForest, renderPaneTree, type PaneContent, type PaneTree } from "../src/research/panes.js";

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

test("renderPaneTree nests children inside the parent box (n-tree depth)", () => {
  const tree: PaneTree = {
    title: "EXP",
    children: [
      { title: "varA", lines: ["a"] },
      { title: "varB", children: [{ title: "seed1", lines: ["s"] }, { title: "seed2", lines: ["s"] }] },
    ],
  };
  const block = renderPaneTree(tree, 80, 20);
  assert.equal(block.length, 20);
  for (const row of block) assert.equal(row.length, 80);
  const joined = block.join("\n");
  // Parent, child, and grandchild titles all present → three levels deep.
  for (const t of ["EXP", "varA", "varB", "seed1", "seed2"]) assert.match(joined, new RegExp(t));
});

test("renderForest tiles trees and stays exactly w×h", () => {
  const forest: PaneTree[] = [
    { title: "H1", children: [{ title: "v1", lines: ["x"] }, { title: "v2", lines: ["y"] }] },
    { title: "H2", children: [{ title: "v3", lines: ["z"] }] },
  ];
  const out = renderForest(forest, 100, 30);
  assert.equal(out.length, 30);
  for (const line of out) assert.equal(line.length, 100);
  assert.match(out.join("\n"), /H1/);
  assert.match(out.join("\n"), /v3/);
});
