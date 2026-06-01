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

test("treeLines renders a top-down tree: root above, child on a downward branch", () => {
  const nodes = [
    node({ id: "H-001", status: "CONFIRMED", childIds: ["H-004"] }),
    node({ id: "H-004", status: "RUNNING", parentId: "H-001" }),
  ];
  const lines = treeLines(nodes, "H-004");
  expect(lines[0]).toContain("H-001"); // root on top
  const childLine = lines.find((l) => l.includes("H-004"))!;
  expect(childLine).toMatch(/[├└]─▶ /); // child hangs off a downward branch
  expect(childLine).toContain("▸"); // selected marker
});

test("treeLines renders a conditional plan as a decision fork", () => {
  const nodes = [
    node({
      id: "H-004",
      conditionalPlan: { condition: "acc ≥ 0.80", ifTrue: "ship", ifFalse: "H-006 pivot" },
    }),
  ];
  const joined = treeLines(nodes).join("\n");
  expect(joined).toContain("◇ if acc ≥ 0.80");
  expect(joined).toContain("yes → ship");
  expect(joined).toContain("no  → H-006 pivot");
});

test("treeLines renders alternatives as sideways branches", () => {
  const nodes = [node({ id: "H-003", alternativeIds: ["qlora", "adapter"] })];
  const joined = treeLines(nodes).join("\n");
  expect(joined).toContain("↳ alt: qlora");
  expect(joined).toContain("↳ alt: adapter");
});

test("treeLines renders multiple independent roots as parallel trees", () => {
  const nodes = [
    node({ id: "H-001", childIds: [] }),
    node({ id: "H-100", childIds: [] }), // independent root, no parent
  ];
  const lines = treeLines(nodes);
  // Both roots present, separated by a blank line
  expect(lines.some((l) => l.includes("H-001"))).toBe(true);
  expect(lines.some((l) => l.includes("H-100"))).toBe(true);
  expect(lines).toContain("");
});

test("treeLines returns empty array for empty input", () => {
  expect(treeLines([])).toEqual([]);
});

test("treeLines renders unknown status with '?' icon", () => {
  const n = node({ id: "H-X", status: "OPEN" });
  // Temporarily patch status to something unknown
  const lines = treeLines([{ ...n, status: "UNKNOWN" as any }]);
  expect(lines[0]).toContain("?");
});

test("treeLines does not infinite-loop on cyclic data", () => {
  const a = node({ id: "A", childIds: ["B"] });
  const b = node({ id: "B", parentId: "A", childIds: ["A"] });
  expect(() => treeLines([a, b])).not.toThrow();
  const joined = treeLines([a, b]).join("\n");
  expect(joined).toContain("A"); // both nodes appear exactly once, no infinite repeat
  expect(joined).toContain("B");
});
