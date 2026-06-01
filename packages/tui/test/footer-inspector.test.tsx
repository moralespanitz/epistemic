import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { StatusFooter } from "../src/ui/StatusFooter.js";
import { TabBar } from "../src/ui/TabBar.js";
import type { ResearchWorld } from "../src/model/types.js";

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

test("TabBar lists the views and a switch hint", () => {
  const { lastFrame } = render(<TabBar active="tree" />);
  const frame = lastFrame() ?? "";
  expect(frame).toContain("Chat");
  expect(frame).toContain("Tree");
  expect(frame).toContain("Missions");
  expect(frame).toContain("Focus");
  expect(frame).toContain("switch view");
});

test("TabBar shows the entered hypothesis instead of the switch hint", () => {
  const { lastFrame } = render(<TabBar active="tree" entered="H-004" />);
  expect(lastFrame()).toContain("H-004");
});
