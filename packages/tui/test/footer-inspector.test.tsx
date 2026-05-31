import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { StatusFooter } from "../src/ui/StatusFooter.js";
import { Inspector } from "../src/ui/Inspector.js";
import type { HypothesisNode, ResearchWorld } from "../src/model/types.js";

const world: ResearchWorld = {
  nodes: [], runs: [
    { id: "H-001", status: "running", trialsDone: 5, trialsTotal: 30, costSeries: [], accSeries: [], spent: 10, costCap: 50 },
    { id: "H-002", status: "done", trialsDone: 30, trialsTotal: 30, costSeries: [], accSeries: [], spent: 5, costCap: 30 },
  ],
  lessons: [], totalSpent: 15, totalCap: 80,
};

test("StatusFooter shows fleet burn and running count", () => {
  const { lastFrame } = render(<StatusFooter world={world} lens="missions" />);
  expect(lastFrame()).toContain("$15");
  expect(lastFrame()).toContain("80");
  expect(lastFrame()).toContain("1 running");
});

test("Inspector renders the selected node detail", () => {
  const node: HypothesisNode = {
    id: "H-004", claim: "scale to 7B", status: "RUNNING", computeTarget: "local",
    costCap: 80, spent: 12, childIds: [], alternativeIds: ["qlora"],
  };
  const { lastFrame } = render(<Inspector node={node} />);
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("scale to 7B");
  expect(lastFrame()).toContain("qlora");
});

test("Inspector shows placeholder when nothing selected", () => {
  const { lastFrame } = render(<Inspector node={undefined} />);
  expect(lastFrame()).toContain("nothing selected");
});
