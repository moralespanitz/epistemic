process.env.NO_COLOR = "1";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBoard, laneOf, parallelLanesText, type Lane } from "../src/research/board.js";
import type { Fleet, ExperimentStat } from "../src/monitor/fleet.js";
import type { HypothesisEntry } from "../src/state/repo.js";

function entry(p: Partial<HypothesisEntry>): HypothesisEntry {
  return {
    id: "H", claim: "c", falsifier: "f", bestCaseConclusion: "b", n: 30,
    judgeRef: "j", baselineRef: "base", costCap: 80, computeTarget: "modal",
    status: "OPEN", timestamp: 0, ...p,
  };
}
function stat(p: Partial<ExperimentStat>): ExperimentStat {
  return {
    id: "H", claim: "c", status: "OPEN", computeTarget: "modal",
    trialsDone: 0, trialsTotal: 30, costSeries: [], accSeries: [], spent: 0, costCap: 80,
    hasPrereg: false, hasJudgeLock: false, hasBaseline: false, hasSmokes: false, inResults: false, ...p,
  };
}

test("laneOf buckets each hypothesis by its real stage", () => {
  assert.equal(laneOf(entry({ status: "OPEN" }), stat({})), "PREREG");
  assert.equal(laneOf(entry({ status: "OPEN" }), stat({ hasPrereg: true, hasJudgeLock: true })), "BASELINE");
  assert.equal(laneOf(entry({ status: "RUNNING" }), stat({ hasPrereg: true, hasJudgeLock: true, hasBaseline: true })), "RUNNING");
  assert.equal(laneOf(entry({ status: "CONFIRMED" }), stat({})), "DECIDED");
  assert.equal(laneOf(entry({ status: "KILLED" }), stat({})), "DECIDED");
});

function fleetOf(es: HypothesisEntry[], ss: ExperimentStat[]): Fleet {
  return {
    entries: es, hypothesesContent: "", stats: ss,
    totalSpent: 0, totalCap: 0,
    running: es.filter((e) => e.status === "RUNNING").length,
    shipped: es.filter((e) => e.status === "CONFIRMED").length,
    killed: es.filter((e) => e.status === "KILLED").length,
  };
}

test("renderBoard shows concurrent lanes with counts", () => {
  const es = [
    entry({ id: "H-1", status: "RUNNING" }),
    entry({ id: "H-2", status: "RUNNING" }),
    entry({ id: "H-3", status: "OPEN" }),
    entry({ id: "H-4", status: "CONFIRMED" }),
  ];
  const ss = [
    stat({ id: "H-1", status: "RUNNING", hasPrereg: true, hasJudgeLock: true, hasBaseline: true, trialsDone: 18 }),
    stat({ id: "H-2", status: "RUNNING", hasPrereg: true, hasJudgeLock: true, hasBaseline: true, trialsDone: 6 }),
    stat({ id: "H-3", status: "OPEN" }),
    stat({ id: "H-4", status: "CONFIRMED" }),
  ];
  const out = renderBoard(fleetOf(es, ss)).join("\n");
  assert.match(out, /parallel board/);
  assert.match(out, /RUNNING \(2\)/);   // two experiments running in parallel
  assert.match(out, /PREREG \(1\)/);
  assert.match(out, /DECIDED \(1\)/);
  assert.match(out, /3 in flight/);     // header throughput: all non-decided lanes (2 running + 1 prereg)
});

test("parallelLanesText lists each in-flight lane with a next action (and is empty for ≤1)", () => {
  const single = fleetOf([entry({ id: "H-1", status: "OPEN" })], [stat({ id: "H-1" })]);
  assert.deepEqual(parallelLanesText(single), []);

  const many = fleetOf(
    [entry({ id: "H-1", status: "OPEN" }), entry({ id: "H-2", status: "RUNNING" })],
    [stat({ id: "H-1" }), stat({ id: "H-2", status: "RUNNING", hasPrereg: true, hasJudgeLock: true, hasBaseline: true })],
  );
  const lines = parallelLanesText(many);
  assert.match(lines[0], /Parallel lanes \(2\)/);
  assert.ok(lines.some((l) => l.includes("H-1")) && lines.some((l) => l.includes("H-2")));
});
