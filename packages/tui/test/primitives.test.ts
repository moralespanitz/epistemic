import { expect, test } from "vitest";
import { sparkline } from "../src/primitives/sparkline.js";
import { costBar } from "../src/primitives/cost-bar.js";
import { treeLines } from "../src/primitives/tree-lines.js";
import type { HypothesisNode } from "../src/model/types.js";

test("sparkline maps a flat series to a single repeated block", () => {
  expect(sparkline([5, 5, 5])).toBe("▁▁▁");
});

test("sparkline scales min→max across the block ramp", () => {
  expect(sparkline([0, 7])).toBe("▁█");
});

test("sparkline returns empty string for empty input", () => {
  expect(sparkline([])).toBe("");
});

test("costBar shows filled proportion and percent", () => {
  expect(costBar(25, 50, 8)).toBe("[████░░░░ 50%]");
});

test("costBar clamps over-cap to 100%", () => {
  expect(costBar(80, 50, 4)).toBe("[████ 100%]");
});

function node(p: Partial<HypothesisNode>): HypothesisNode {
  return {
    id: "X", claim: "c", status: "OPEN", computeTarget: "local",
    costCap: 50, spent: 0, childIds: [], alternativeIds: [], ...p,
  };
}

test("treeLines renders roots and indented children", () => {
  const nodes = [
    node({ id: "H-001", status: "CONFIRMED", childIds: ["H-004"] }),
    node({ id: "H-004", status: "RUNNING", parentId: "H-001" }),
  ];
  const lines = treeLines(nodes, "H-004");
  expect(lines[0]).toContain("H-001");
  expect(lines[1]).toContain("H-004");
  expect(lines[1]).toMatch(/^\s+/); // child is indented
  // selected marker
  expect(lines[1]).toContain("▸");
});
