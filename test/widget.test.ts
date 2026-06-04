import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHypothesisHeader } from "../src/tui/widget.js";
import type { HypothesisEntry } from "../src/state/repo.js";

const baseEntry: HypothesisEntry = {
  id: "RS-001",
  claim: "CoT improves HumanEval pass@1",
  falsifier: "if delta < 0",
  bestCaseConclusion: "publish",
  n: 30,
  judgeRef: "gpt-4o",
  baselineRef: "gpt-4o-vanilla",
  costCap: 20,
  computeTarget: "local",
  status: "RUNNING",
  timestamp: Date.now(),
};

describe("buildHypothesisHeader", () => {
  it("renders two lines for an active RUNNING hypothesis", () => {
    const lines = buildHypothesisHeader(
      baseEntry, 4.2,
      { prereg: true, judgeLock: true, stats: false, falsif: false },
      14, 30
    );
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes("RS-001"));
    assert.ok(lines[0].includes("stage"));
    assert.ok(lines[0].includes("4.20"));
    assert.ok(lines[0].includes("14/30"));
    assert.ok(lines[1].includes("✓"));
    assert.ok(lines[1].includes("✗"));
  });

  it("returns empty array when no active hypothesis", () => {
    const lines = buildHypothesisHeader(
      undefined, 0,
      { prereg: false, judgeLock: false, stats: false, falsif: false },
      0, 0
    );
    assert.equal(lines.length, 0);
  });

  it("omits trial count when trialsTotal is 0", () => {
    const lines = buildHypothesisHeader(
      baseEntry, 0,
      { prereg: false, judgeLock: false, stats: false, falsif: false },
      0, 0
    );
    assert.ok(!lines[0].includes("0/0"));
  });

  it("truncates long claim to 40 chars with ellipsis", () => {
    const longEntry = { ...baseEntry, claim: "A".repeat(60) };
    const lines = buildHypothesisHeader(
      longEntry, 0,
      { prereg: false, judgeLock: false, stats: false, falsif: false },
      0, 0
    );
    assert.ok(lines[0].includes("…"));
    assert.ok(!lines[0].includes("A".repeat(41)));
  });
});
