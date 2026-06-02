// Render plain text for the structural assertions below; a dedicated test
// re-enables color to verify the ANSI codes are actually emitted.
process.env.NO_COLOR = "1";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKey, reduceNav, actionPrompt } from "../src/research/monitor-nav.js";
import { renderMonitor } from "../src/research/monitor.js";
import { renderTreeDiagram } from "../src/research/diagram.js";
import { fitWidth, linesWidget } from "../src/tui/widget.js";
import { visibleWidth } from "@earendil-works/pi-tui";
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
});

test("tree interface shows the selected node's decision + progress in the caption", () => {
  const lines = renderMonitor(fleet(), "tree", 1).join("\n");
  // Decision shown as "◇ <cond> ? <yes> : <no>" in the caption under the diagram.
  assert.match(lines, /◇ acc ≥ 0\.80 \? ship : H-006/);
  assert.doesNotMatch(lines, /yes → ship/); // no vertical yes/no block
  assert.match(lines, /5\/30/); // progress (trials) in the caption
});

test("renderTreeDiagram centers the root above box-drawing branches to children", () => {
  const entries = [
    entry({ id: "H-001", status: "OPEN", claim: "root" }),
    entry({ id: "H-002", status: "OPEN", claim: "child a" }),
    entry({ id: "H-003", status: "RUNNING", claim: "child b" }),
  ];
  const content = "## Hypothesis: H-002\n- **Parent:** H-001\n## Hypothesis: H-003\n- **Parent:** H-001\n";
  const out = renderTreeDiagram(entries, content, "H-003").join("\n");
  assert.match(out, /H-001/);                 // root present
  assert.match(out, /[┴┼]/);                  // branch joins up to the parent
  assert.match(out, /[┌┐]/);                  // and fans out to children
  assert.match(out, /▸▶ H-003/);              // selected node uses the ▸ marker
  // Root line appears above the child line.
  const lines = renderTreeDiagram(entries, content, "H-003");
  const rootRow = lines.findIndex((l) => l.includes("H-001"));
  const childRow = lines.findIndex((l) => l.includes("H-002"));
  assert.ok(rootRow >= 0 && childRow > rootRow, "root renders above its children");
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
    // pi crashes on visible width > terminal — assert visible width, not code points.
    assert.ok(visibleWidth(line) <= limit, `visible width ${visibleWidth(line)} exceeds ${limit}`);
  }
});

// Regression: pi crashed "Rendered line 7 exceeds terminal width (151 > 119)"
// because widgets were clamped to stdout.columns (wide), not pi's real render
// width. linesWidget must truncate to whatever width pi passes at render time.
test("linesWidget truncates to the render width pi passes, not stdout.columns", () => {
  const wide = "Ξ  ▶ H-004  " + "x".repeat(300) + "  ◇ acc ≥ 0.80 ? ship : H-006 pivot";
  const component = linesWidget([wide])(); // factory() → Component
  for (const w of [40, 80, 119]) {
    for (const line of component.render(w)) {
      assert.ok(visibleWidth(line) <= w, `visible width ${visibleWidth(line)} exceeds render width ${w}`);
    }
  }
});

test("monitor emits ANSI color + gamified header when color is enabled", () => {
  delete process.env.NO_COLOR;
  try {
    const lines = renderMonitor(fleet(), "tree", 1).join("\n");
    assert.match(lines, /\x1b\[/);          // ANSI escape codes present
    assert.match(lines, /LV\.\d+ /);        // gamification: level + rank
    assert.match(lines, /XP/);              // XP shown
    assert.match(lines, /kill:ship/);       // discipline meter
  } finally {
    process.env.NO_COLOR = "1";
  }
});

test("empty fleet renders a friendly empty state", () => {
  const empty: Fleet = { entries: [], hypothesesContent: "", stats: [], totalSpent: 0, totalCap: 0, running: 0, shipped: 0, killed: 0 };
  assert.match(renderMonitor(empty, "tree", 0).join("\n"), /no hypotheses yet/);
});
