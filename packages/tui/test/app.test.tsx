import { expect, test, vi } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { App } from "../src/ui/App.js";
import type { ResearchWorld } from "../src/model/types.js";

const world: ResearchWorld = {
  nodes: [
    { id: "H-001", claim: "first", status: "RUNNING", computeTarget: "local", costCap: 50, spent: 10, childIds: [], alternativeIds: [] },
  ],
  runs: [
    { id: "H-001", status: "running", trialsDone: 5, trialsTotal: 30, costSeries: [1, 2], accSeries: [0.6], spent: 10, costCap: 50 },
  ],
  lessons: [], totalSpent: 10, totalCap: 50,
};

const deps = () => ({
  initialWorld: world,
  subscribe: (_cb: (w: ResearchWorld) => void) => () => {},
  runner: { spawn: vi.fn().mockResolvedValue(undefined), kill: vi.fn() },
  ask: vi.fn().mockResolvedValue("answer"),
});

test("App starts on the missions lens and shows footer hints", () => {
  const { lastFrame } = render(<App {...deps()} />);
  expect(lastFrame()).toContain("MISSION CONTROL");
  expect(lastFrame()).toContain("[1]tree");
});

const tick = () => new Promise((r) => setTimeout(r, 30));

test("pressing 1 switches to the tree lens", async () => {
  const { lastFrame, stdin } = render(<App {...deps()} />);
  await tick(); // let useInput attach its listener before writing
  stdin.write("1");
  await tick();
  expect(lastFrame()).toContain("RESEARCH TREE");
});

test("pressing s spawns the selected experiment", async () => {
  const d = deps();
  const { stdin } = render(<App {...d} />);
  await tick(); // let useInput attach its listener before writing
  stdin.write("s");
  await tick();
  expect(d.runner.spawn).toHaveBeenCalledWith("H-001", "local");
});
