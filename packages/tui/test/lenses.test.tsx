import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { LensMissions } from "../src/ui/LensMissions.js";
import { LensTree } from "../src/ui/LensTree.js";
import { LensFocus } from "../src/ui/LensFocus.js";
import type { HypothesisNode, ResearchWorld } from "../src/model/types.js";

const node = (p: Partial<HypothesisNode>): HypothesisNode => ({
  id: "X", claim: "c", status: "OPEN", computeTarget: "local",
  costCap: 50, spent: 0, childIds: [], alternativeIds: [], ...p,
});

const world: ResearchWorld = {
  nodes: [
    node({ id: "H-001", status: "CONFIRMED", childIds: ["H-004"] }),
    node({ id: "H-004", status: "RUNNING", parentId: "H-001" }),
  ],
  runs: [
    { id: "H-001", status: "done", trialsDone: 30, trialsTotal: 30, costSeries: [1, 2], accSeries: [0.7, 0.75], spent: 20, costCap: 50 },
    { id: "H-004", status: "running", trialsDone: 18, trialsTotal: 30, costSeries: [1, 4, 8], accSeries: [0.6, 0.7, 0.81], spent: 12, costCap: 80 },
  ],
  lessons: [], totalSpent: 32, totalCap: 130,
};

test("LensMissions renders a card per run with sparkline data", () => {
  const { lastFrame } = render(<LensMissions world={world} selectedId="H-004" />);
  expect(lastFrame()).toContain("H-001");
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("18/30");
});

test("LensTree renders the indented hypothesis tree with selection", () => {
  const { lastFrame } = render(<LensTree world={world} selectedId="H-004" />);
  expect(lastFrame()).toContain("H-001");
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("▸");
});

test("LensFocus shows the selected experiment's trial and cost detail", () => {
  const { lastFrame } = render(<LensFocus world={world} selectedId="H-004" />);
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("18/30");
  expect(lastFrame()).toContain("0.81");
});
