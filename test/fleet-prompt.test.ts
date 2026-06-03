import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { HypothesisEntry } from "../src/state/repo.js";

process.env.NO_COLOR = "1";

const { buildStagePrompt } = await import("../src/fleet/prompt.js");

function makeHypothesis(overrides: Partial<HypothesisEntry> = {}): HypothesisEntry {
  return {
    id: "H-001",
    claim: "LoRA beats baseline on MMLU",
    status: "OPEN",
    falsifier: "if acc < baseline, claim is false",
    judgeRef: "gpt-4o",
    baselineRef: "llama-3",
    n: 30,
    costCap: 50,
    computeTarget: "local",
    ...overrides,
  } as HypothesisEntry;
}

describe("buildStagePrompt", () => {
  it("includes hypothesis id and claim", () => {
    const p = buildStagePrompt(makeHypothesis(), "/worktree/H-001", "preregistration");
    assert.ok(p.includes("H-001"), "missing id");
    assert.ok(p.includes("LoRA beats baseline on MMLU"), "missing claim");
  });

  it("includes working directory", () => {
    const p = buildStagePrompt(makeHypothesis(), "/worktree/H-001", "preregistration");
    assert.ok(p.includes("/worktree/H-001"), "missing working directory");
  });

  it("includes the stage name", () => {
    const p = buildStagePrompt(makeHypothesis(), "/worktree/H-001", "experiment-execution");
    assert.ok(p.includes("experiment-execution"), "missing stage");
  });

  it("instructs not to skip gates", () => {
    const p = buildStagePrompt(makeHypothesis(), "/worktree/H-001", "baseline-reproduction");
    assert.ok(p.toLowerCase().includes("gate") || p.includes("epistemic"), "missing gate/epistemic mention");
  });

  it("includes cost cap", () => {
    const p = buildStagePrompt(makeHypothesis({ costCap: 75 }), "/worktree/H-001", "preregistration");
    assert.ok(p.includes("75"), "missing cost cap");
  });
});
