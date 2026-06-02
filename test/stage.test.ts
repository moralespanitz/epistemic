import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveStage, detectAnomalies, renderStageBlock, type StageFacts } from "../src/state/stage.js";
import type { HypothesisEntry } from "../src/state/repo.js";

function entry(p: Partial<HypothesisEntry>): HypothesisEntry {
  return {
    id: "H-004", claim: "scale to 7B", falsifier: "if gain ≤ 1.2x", bestCaseConclusion: "b",
    n: 30, judgeRef: "gpt-4o", baselineRef: "base-codellama", costCap: 80,
    computeTarget: "modal", status: "OPEN", timestamp: 0, ...p,
  };
}

function facts(p: Partial<StageFacts>): StageFacts {
  return {
    active: entry({}), spent: 0, hasPrereg: false, hasJudgeLock: false,
    hasBaseline: false, hasSmokes: false, smokesSimulated: false, hasConfirmedResults: false, ...p,
  };
}

// ─── The transcript scenario: RUNNING + smokes + spend, no prereg ───
test("RUNNING with no prereg → preregistration stage with repair directive", () => {
  const r = deriveStage(facts({ active: entry({ status: "RUNNING" }), spent: 0.01, hasSmokes: true, smokesSimulated: true }));
  assert.equal(r.stage, "preregistration");
  assert.match(r.nextAction, /no valid preregistration/i);
});

test("RUNNING + no prereg flags the protocol breach as an anomaly", () => {
  const a = detectAnomalies(facts({ active: entry({ status: "RUNNING" }), spent: 31, hasSmokes: true, smokesSimulated: true }));
  assert.ok(a.some(x => /RUNNING but no prereg/i.test(x)), "flags RUNNING-without-prereg");
  assert.ok(a.some(x => /before preregistration exists/i.test(x)), "flags spend-before-prereg");
  assert.ok(a.some(x => /SIMULATED/i.test(x)), "flags simulated smokes");
});

// ─── Clean pipeline progression ───
test("OPEN, no prereg → preregistration", () => {
  assert.equal(deriveStage(facts({})).stage, "preregistration");
});

test("prereg but no judge.lock → still preregistration (incomplete)", () => {
  const r = deriveStage(facts({ hasPrereg: true }));
  assert.equal(r.stage, "preregistration");
  assert.match(r.nextAction, /incomplete/i);
});

test("prereg + judge.lock, no baseline → baseline-reproduction", () => {
  const r = deriveStage(facts({ hasPrereg: true, hasJudgeLock: true }));
  assert.equal(r.stage, "baseline-reproduction");
});

test("baseline reproduced, no results → experiment-execution", () => {
  const r = deriveStage(facts({ hasPrereg: true, hasJudgeLock: true, hasBaseline: true }));
  assert.equal(r.stage, "experiment-execution");
});

test("results present → kill-or-ship", () => {
  const r = deriveStage(facts({ hasPrereg: true, hasJudgeLock: true, hasBaseline: true, hasConfirmedResults: true }));
  assert.equal(r.stage, "kill-or-ship");
});

test("CONFIRMED → verification-before-publication", () => {
  const r = deriveStage(facts({ active: entry({ status: "CONFIRMED" }), hasPrereg: true, hasJudgeLock: true, hasBaseline: true, hasConfirmedResults: true }));
  assert.equal(r.stage, "verification-before-publication");
});

// ─── Kill criteria + clean state ───
test("spend over 1.5x cap → kill anomaly", () => {
  const a = detectAnomalies(facts({ active: entry({ costCap: 80 }), spent: 130, hasPrereg: true, hasJudgeLock: true }));
  assert.ok(a.some(x => /kill criteria met/i.test(x)));
});

test("clean prereg'd state has no anomalies", () => {
  const a = detectAnomalies(facts({ hasPrereg: true, hasJudgeLock: true, hasBaseline: true }));
  assert.deepEqual(a, []);
});

// ─── Render ───
test("renderStageBlock includes NEXT ACTION and anomaly header when present", () => {
  const block = renderStageBlock(deriveStage(facts({ active: entry({ status: "RUNNING" }), spent: 31, hasSmokes: true, smokesSimulated: true })));
  assert.match(block, /NEXT ACTION/);
  assert.match(block, /STATE INCONSISTENCY/);
});
