import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKey, reduceNav, actionPrompt } from "../src/research/monitor-nav.js";
import { renderMonitor } from "../src/research/monitor.js";
import { fitWidth } from "../src/tui/widget.js";
import type { Fleet } from "../src/monitor/fleet.js";
import type { HypothesisEntry } from "../src/state/repo.js";

function entry(p: Partial<HypothesisEntry>): HypothesisEntry {
  return {
    id: "X", claim: "c", falsifier: "f", bestCaseConclusion: "b", n: 30,
    judgeRef: "j", baselineRef: "base", costCap: 50, computeTarget: "local",
    status: "OPEN", timestamp: 0, ...p,
  };
}

function fleet(): Fleet {
  const entries = [
    entry({ id: "H-001", status: "CONFIRMED", claim: "LoRA improves" }),
    entry({ id: "H-004", status: "RUNNING", claim: "scale to 7B", costCap: 80 }),
  ];
  return {
    entries,
    hypothesesContent: "## Hypothesis: H-004\n- **Decision:** acc ≥ 0.80 → ship | else → H-006 pivot\n",
    stats: entries.map((e) => ({ id: e.id, claim: e.claim, status: e.status, computeTarget: e.computeTarget, trialsDone: 5, trialsTotal: 30, costSeries: [1, 2], accSeries: [0.6, 0.7], spent: 4, costCap: e.costCap })),
    totalSpent: 8, totalCap: 130, running: 1, shipped: 1, killed: 0,
  };
}

// ── parseKey ──
test("parseKey maps arrow escape sequences and enter", () => {
  assert.equal(parseKey("\x1b[A"), "up");
  assert.equal(parseKey("\x1b[B"), "down");
  assert.equal(parseKey("\x1b[C"), "right");
  assert.equal(parseKey("\x1b[D"), "left");
  assert.equal(parseKey("\r"), "enter");
  assert.equal(parseKey("x"), "other");
});

// ── reduceNav ──
test("down/up move selection within bounds", () => {
  let s = { mode: "tree" as const, idx: 0 };
  s = reduceNav(s, "down", 2).state; assert.equal(s.idx, 1);
  s = reduceNav(s, "down", 2).state; assert.equal(s.idx, 1); // clamped at max
  s = reduceNav(s, "up", 2).state; assert.equal(s.idx, 0);
  s = reduceNav(s, "up", 2).state; assert.equal(s.idx, 0); // clamped at 0
});

test("right opens detail, left returns to tree", () => {
  assert.equal(reduceNav({ mode: "tree", idx: 0 }, "right", 2).state.mode, "detail");
  assert.equal(reduceNav({ mode: "detail", idx: 0 }, "left", 2).state.mode, "tree");
});

test("enter signals openAction when there are hypotheses", () => {
  assert.equal(reduceNav({ mode: "tree", idx: 0 }, "enter", 2).openAction, true);
  assert.equal(reduceNav({ mode: "tree", idx: 0 }, "enter", 0).openAction, false);
});

test("unhandled keys are not consumed (pass through to editor)", () => {
  assert.equal(reduceNav({ mode: "tree", idx: 0 }, "other", 2).handled, false);
});

// ── actionPrompt ──
test("actionPrompt composes the right instruction per action", () => {
  const e = { id: "H-004", claim: "scale to 7B" };
  assert.match(actionPrompt("approve", e), /Approve hypothesis H-004.*kill-or-ship.*SHIP/s);
  assert.match(actionPrompt("reject", e), /Reject hypothesis H-004.*KILL/s);
  assert.match(actionPrompt("modify", e), /Modify hypothesis H-004.*REFINE or PIVOT/s);
  assert.match(actionPrompt("chat", e), /Tell me about hypothesis H-004/);
});

// ── renderMonitor ──
test("tree interface shows the selected experiment and the tree", () => {
  const lines = renderMonitor(fleet(), "tree", 1).join("\n");
  assert.match(lines, /mission control/);
  assert.match(lines, /H-001/);
  assert.match(lines, /H-004/);
  assert.match(lines, /▸/); // selection marker
  assert.match(lines, /experiments/);
});

test("detail interface shows the selected hypothesis detail + decision fork", () => {
  const lines = renderMonitor(fleet(), "detail", 1).join("\n");
  assert.match(lines, /H-004/);
  assert.match(lines, /claim:.*scale to 7B/);
  assert.match(lines, /falsifier:/);
  assert.match(lines, /◇ if acc ≥ 0\.80/);
  assert.match(lines, /yes → ship/);
});

// Regression: widget lines wider than the terminal crash pi. fitWidth must clamp them.
test("fitWidth clamps every line to the terminal width", () => {
  const wide = "Ξ epistemic  ·  " + "x".repeat(300);
  const limit = Math.max(20, (process.stdout.columns ?? 80) - 2);
  for (const line of fitWidth([wide, "short", "y".repeat(500)])) {
    assert.ok([...line].length <= limit, `line length ${[...line].length} exceeds ${limit}`);
  }
});

test("empty fleet renders a friendly empty state", () => {
  const empty: Fleet = { entries: [], hypothesesContent: "", stats: [], totalSpent: 0, totalCap: 0, running: 0, shipped: 0, killed: 0 };
  assert.match(renderMonitor(empty, "tree", 0).join("\n"), /no hypotheses yet/);
});
