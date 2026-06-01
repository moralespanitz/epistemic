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

const tick = () => new Promise((r) => setTimeout(r, 30));

test("App starts on the chat view with a persistent input", () => {
  const { lastFrame } = render(<App {...deps()} />);
  expect(lastFrame()).toContain("CONVERSATION");
  expect(lastFrame()).toContain("type to chat");
});

test("typing /tree and pressing enter switches to the tree view", async () => {
  const { lastFrame, stdin } = render(<App {...deps()} />);
  await tick();
  stdin.write("/tree");
  await tick();
  stdin.write("\r"); // enter
  await tick();
  expect(lastFrame()).toContain("RESEARCH TREE");
});

test("typing a plain message and pressing enter sends it to the agent", async () => {
  const d = deps();
  const { stdin } = render(<App {...d} />);
  await tick();
  stdin.write("why did it diverge?");
  await tick();
  stdin.write("\r");
  await tick();
  expect(d.ask).toHaveBeenCalled();
  expect(d.ask.mock.calls[0][0]).toBe("why did it diverge?");
});

test("typing /spawn and pressing enter spawns the selected experiment", async () => {
  const d = deps();
  const { stdin } = render(<App {...d} />);
  await tick();
  stdin.write("/spawn");
  await tick();
  stdin.write("\r");
  await tick();
  expect(d.runner.spawn).toHaveBeenCalledWith("H-001", "local");
});

test("typing /model with an id switches the agent model via controls", async () => {
  const setModel = vi.fn();
  const { stdin } = render(<App {...deps()} controls={{ setModel, getModel: () => undefined }} />);
  await tick();
  stdin.write("/model gpt-5.2");
  await tick();
  stdin.write("\r");
  await tick();
  expect(setModel).toHaveBeenCalledWith("gpt-5.2");
});

test("pressing enter on a selected hypothesis enters it (drill-in)", async () => {
  const { lastFrame, stdin } = render(<App {...deps()} />);
  await tick();
  stdin.write("\r"); // empty enter on selected H-001
  await tick();
  expect(lastFrame()).toContain("◆ H-001"); // NodeView header
  expect(lastFrame()).toContain("/approve");
});

test("/approve while entered sends a scoped ship instruction to the agent", async () => {
  const d = deps();
  const { stdin } = render(<App {...d} />);
  await tick();
  stdin.write("\r"); // enter H-001
  await tick();
  stdin.write("/approve");
  await tick();
  stdin.write("\r");
  await tick();
  expect(d.ask).toHaveBeenCalled();
  const prompt = d.ask.mock.calls[0][0];
  expect(prompt).toContain("Approve hypothesis H-001");
  // context is scoped to the entered node
  expect(d.ask.mock.calls[0][1]).toMatchObject({ id: "H-001" });
});

test("/back leaves the hypothesis view", async () => {
  const { lastFrame, stdin } = render(<App {...deps()} />);
  await tick();
  stdin.write("\r"); // enter
  await tick();
  expect(lastFrame()).toContain("◆ H-001");
  stdin.write("/back");
  await tick();
  stdin.write("\r");
  await tick();
  expect(lastFrame()).not.toContain("◆ H-001");
});

test("/model with no arg opens the picker; selecting sets the model", async () => {
  const setModel = vi.fn();
  const loadModels = vi.fn().mockResolvedValue(["claude-opus-4-8", "claude-sonnet-4-6", "gpt-5.2"]);
  const { lastFrame, stdin } = render(
    <App {...deps()} controls={{ setModel, getModel: () => undefined, loadModels }} />,
  );
  await tick();
  stdin.write("/model");
  await tick();
  stdin.write("\r"); // open picker
  await tick();
  expect(lastFrame()).toContain("SELECT MODEL");
  expect(lastFrame()).toContain("claude-opus-4-8");
  stdin.write("\x1B[B"); // down → second item
  await tick();
  stdin.write("\r"); // select
  await tick();
  expect(setModel).toHaveBeenCalledWith("claude-sonnet-4-6");
});

test("a passthrough command (/commit) is forwarded to the agent", async () => {
  const d = deps();
  const { stdin } = render(<App {...d} />);
  await tick();
  stdin.write("/commit");
  await tick();
  stdin.write("\r");
  await tick();
  expect(d.ask).toHaveBeenCalled();
  expect(d.ask.mock.calls[0][0]).toBe("/commit");
});

test("a second message while busy is rejected (no cross-talk)", async () => {
  const d = deps();
  // ask that never resolves — keeps the app busy
  d.ask = vi.fn(() => new Promise<string>(() => {}));
  const { stdin } = render(<App {...d} />);
  await tick();
  stdin.write("first");
  await tick();
  stdin.write("\r");
  await tick();
  stdin.write("second");
  await tick();
  stdin.write("\r");
  await tick();
  // Only the first message reached the agent; the second was rejected while busy.
  expect(d.ask).toHaveBeenCalledTimes(1);
  expect(d.ask.mock.calls[0][0]).toBe("first");
});
