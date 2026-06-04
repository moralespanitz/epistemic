import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGraphData } from "../src/graph/state.js";

const RESEARCH_MD = `# RD: CoT for Code
## 1. Research overview
### 1.2 Research summary
Testing CoT.
## 10. Research stories
### 10.1. Establish baseline
- **ID**: RS-001
- **Description**: Reproduce baseline.
- **Validation criteria**: Match ±1%.
### 10.2. CoT experiment
- **ID**: RS-002
- **Description**: Run CoT.
- **Validation criteria**: p < 0.05.
`;

const HYPOTHESES_MD = `## Hypothesis: RS-001
- **Claim:** Reproduce gpt-4o baseline
- **Status:** CONFIRMED
- **Cost Cap:** 20
- **N:** 30
- **Compute Target:** local

## Hypothesis: RS-002
- **Claim:** CoT improves pass@1
- **Status:** RUNNING
- **Cost Cap:** 20
- **N:** 30
- **Compute Target:** local
`;

describe("buildGraphData", () => {
  it("produces root node with title from RESEARCH.md", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.root.id, "root");
    assert.equal(data.root.label, "CoT for Code");
  });

  it("creates one node per research story", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.nodes.length, 2);
  });

  it("merges hypothesis status into matching node", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.status, "CONFIRMED");
  });

  it("marks node as proposed when no matching hypothesis exists", () => {
    const data = buildGraphData(RESEARCH_MD, "", {}, "");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.status, "proposed");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.isProposal, true);
  });

  it("creates root→node edge for each story", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.edges.filter(e => e.source === "root").length, 2);
  });

  it("sets updatedAt to a recent timestamp", () => {
    const before = Date.now();
    const data = buildGraphData(RESEARCH_MD, "", {}, "");
    assert.ok(data.updatedAt >= before);
  });

  it("does not populate gates on proposed nodes", () => {
    const data = buildGraphData(RESEARCH_MD, "", {}, "");
    const node = data.nodes[0];
    assert.equal(node.gates, undefined);
  });

  it("reflects spendMap values in node.spent", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, { "RS-001": 12.5 }, "");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.spent, 12.5);
  });

  it("returns stage 9 for CONFIRMED hypothesis present in resultsMd", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "RS-001 confirmed");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.stage, 9);
  });

  it("returns stage 7 for CONFIRMED hypothesis absent from resultsMd", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.stage, 7);
  });

  it("builds branching edges from Parent fields", () => {
    const branched = `# RD: Branching
## 10. Research stories
### 10.1. Root
- **ID**: RS-001
- **Description**: base.
- **Validation criteria**: x.
### 10.2. Child ablation
- **ID**: RS-002
- **Parent**: RS-001
- **Kind**: ablation
- **Description**: ablate.
- **Validation criteria**: y.
`;
    const data = buildGraphData(branched, "", {}, "");
    const rs1 = data.nodes.find(n => n.id === "RS-001")!;
    const rs2 = data.nodes.find(n => n.id === "RS-002")!;
    assert.equal(rs1.parent, null);            // root child
    assert.equal(rs2.parent, "RS-001");        // branches off RS-001
    assert.equal(rs2.kind, "ablation");
    // Edge for RS-002 points from its parent, not the root
    assert.ok(data.edges.some(e => e.source === "RS-001" && e.target === "RS-002"));
    assert.ok(data.edges.some(e => e.source === "root" && e.target === "RS-001"));
  });

  it("ignores a Parent that does not exist as a node (attaches to root)", () => {
    const orphan = `# RD: Orphan
## 10. Research stories
### 10.1. Lonely
- **ID**: RS-001
- **Parent**: RS-999
- **Description**: no such parent.
- **Validation criteria**: x.
`;
    const data = buildGraphData(orphan, "", {}, "");
    assert.equal(data.nodes[0].parent, null);
    assert.ok(data.edges.some(e => e.source === "root" && e.target === "RS-001"));
  });

  it("marks shipped and killed nodes as not forkable", () => {
    const md = `## Hypothesis: RS-001
- **Claim:** shipped one
- **Status:** CONFIRMED
- **Cost cap:** 20

## Hypothesis: RS-002
- **Claim:** killed one
- **Status:** KILLED
- **Cost cap:** 20
`;
    const research = `# RD: Fork
## 10. Research stories
### 10.1. A
- **ID**: RS-001
- **Description**: a.
- **Validation criteria**: x.
### 10.2. B
- **ID**: RS-002
- **Description**: b.
- **Validation criteria**: y.
`;
    const data = buildGraphData(research, md, {}, "RS-001 shipped");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.forkable, false); // shipped
    assert.equal(data.nodes.find(n => n.id === "RS-002")?.forkable, false); // killed
  });
});
