import { expect, test } from "vitest";
import { StateStore } from "../src/state-store.js";
import {
  makeRepo, writeHypotheses, writeTelemetry, writeRunStatus, sampleHypotheses,
} from "./fixtures.js";

test("StateStore.read assembles a world from filesystem state", async () => {
  const cwd = await makeRepo();
  await writeHypotheses(cwd, sampleHypotheses());
  await writeTelemetry(cwd, "H-001", [
    { trial: 5, total: 30, cost: 2, acc: 0.7, t: 1 },
    { trial: 10, total: 30, cost: 4, acc: 0.74, t: 2 },
  ]);
  await writeRunStatus(cwd, "H-001", { status: "running" });

  const store = new StateStore(cwd);
  const world = await store.read();

  expect(world.nodes).toHaveLength(1);
  const run = world.runs[0];
  expect(run.id).toBe("H-001");
  expect(run.status).toBe("running");
  expect(run.trialsDone).toBe(10);
  expect(run.accSeries).toEqual([0.7, 0.74]);
});

test("StateStore.watch fires on change", async () => {
  const cwd = await makeRepo();
  await writeHypotheses(cwd, sampleHypotheses());

  const store = new StateStore(cwd);
  const seen: number[] = [];
  await store.watch((world) => seen.push(world.nodes.length));

  // initial emit
  await new Promise((r) => setTimeout(r, 50));
  await writeHypotheses(cwd, sampleHypotheses() + `
## Hypothesis: H-002
- **Status:** OPEN
- **Claim:** second
- **Cost cap:** 30
`);
  await new Promise((r) => setTimeout(r, 500));
  await store.close();

  expect(seen[0]).toBe(1);
  expect(seen[seen.length - 1]).toBe(2);
});
