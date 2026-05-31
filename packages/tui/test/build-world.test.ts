import { expect, test } from "vitest";
import { parseParentEdges } from "../src/model/parse-edges.js";
import { buildWorld } from "../src/model/build-world.js";
import type { HypothesisEntry } from "../src/epistemic-state.js";

const HMD = `# Hypotheses

## Hypothesis: H-001
- **Status:** CONFIRMED
- **Claim:** LoRA improves accuracy
- **Cost cap:** 50

## Hypothesis: H-004
- **Status:** RUNNING
- **Claim:** scale to 7B
- **Parent:** H-001
- **Cost cap:** 80
`;

function entry(p: Partial<HypothesisEntry>): HypothesisEntry {
  return {
    id: "X", claim: "c", falsifier: "f", bestCaseConclusion: "b", n: 30,
    judgeRef: "j", baselineRef: "base", costCap: 50, computeTarget: "local",
    status: "OPEN", timestamp: 0, ...p,
  };
}

test("parseParentEdges extracts child→parent map", () => {
  const edges = parseParentEdges(HMD);
  expect(edges.get("H-004")).toBe("H-001");
  expect(edges.has("H-001")).toBe(false);
});

test("buildWorld links parent/child and derives run status", () => {
  const entries = [
    entry({ id: "H-001", status: "CONFIRMED", costCap: 50 }),
    entry({ id: "H-004", status: "RUNNING", costCap: 80 }),
  ];
  const world = buildWorld(entries, {
    hypothesesContent: HMD,
    spends: { "H-001": 20, "H-004": 12 },
    lessons: [],
    telemetry: { "H-004": [{ trial: 18, total: 30, cost: 12, acc: 0.81, t: 1 }] },
    runStatus: { "H-004": { status: "running" } },
    alternatives: { "H-001": ["qlora"] },
  });

  const h1 = world.nodes.find((n) => n.id === "H-001")!;
  const h4 = world.nodes.find((n) => n.id === "H-004")!;
  expect(h1.childIds).toContain("H-004");
  expect(h4.parentId).toBe("H-001");
  expect(h1.alternativeIds).toEqual(["qlora"]);

  const run = world.runs.find((r) => r.id === "H-004")!;
  expect(run.status).toBe("running");
  expect(run.trialsDone).toBe(18);
  expect(run.accSeries).toEqual([0.81]);
  expect(world.totalSpent).toBe(32);
  expect(world.totalCap).toBe(130);
});

test("buildWorld defaults run status to pending when no run-status file", () => {
  const entries = [entry({ id: "H-009", status: "OPEN" })];
  const world = buildWorld(entries, {
    hypothesesContent: "", spends: {}, lessons: [],
    telemetry: {}, runStatus: {}, alternatives: {},
  });
  expect(world.runs.find((r) => r.id === "H-009")!.status).toBe("pending");
});
