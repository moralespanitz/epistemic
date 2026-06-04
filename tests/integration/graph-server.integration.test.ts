/**
 * Graph server integration tests — runs the real server against real repo files.
 * No mocks. Creates temp dirs, writes RESEARCH.md + HYPOTHESES.md, polls /api/state.
 *
 *   npx tsx --test tests/integration/graph-server.integration.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startGraphServer, type GraphServer } from "../../src/graph/server.js";

const RESEARCH_MD = `# RD: CoT for Code

## 1. Research overview
### 1.2 Research summary
Does CoT improve code generation?

## 10. Research stories

### 10.1. Establish baseline
- **ID**: RS-001
- **Description**: Reproduce gpt-4o baseline.
- **Validation criteria**: Match ±1%.

### 10.2. Test CoT
- **ID**: RS-002
- **Description**: Compare CoT vs vanilla.
- **Validation criteria**: p < 0.05.
`;

const HYPOTHESES_MD = `## Hypothesis: RS-001
- **Claim:** Reproduce gpt-4o HumanEval baseline
- **Status:** CONFIRMED
- **Cost cap:** 20
- **N:** 30
- **Compute target:** local
- **Timestamp:** 1748995200000
- **Falsifier:** If pass@1 <= 0, claim is wrong
- **Best case conclusion:** Baseline confirmed
- **Judge:** gpt-4o
- **Baseline:** zero-shot gpt-4o

## Hypothesis: RS-002
- **Claim:** CoT improves HumanEval pass@1
- **Status:** RUNNING
- **Cost cap:** 20
- **N:** 30
- **Compute target:** local
- **Timestamp:** 1748995200001
- **Falsifier:** If CoT delta <= 0, claim is wrong
- **Best case conclusion:** Publish result
- **Judge:** gpt-4o
- **Baseline:** zero-shot gpt-4o
`;

let dir: string;
let server: GraphServer;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "ep-graph-int-"));
  await writeFile(join(dir, "RESEARCH.md"), RESEARCH_MD);
  await writeFile(join(dir, "HYPOTHESES.md"), HYPOTHESES_MD);
  server = await startGraphServer(dir, Date.now());
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true });
});

describe("graph server integration — real RESEARCH.md + HYPOTHESES.md", () => {
  it("returns root node with correct title", async () => {
    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    assert.equal(data.root.label, "CoT for Code");
    assert.equal(data.root.id, "root");
  });

  it("returns two nodes matching research stories", async () => {
    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    assert.equal(data.nodes.length, 2);
    const ids = data.nodes.map((n: any) => n.id).sort();
    assert.deepEqual(ids, ["RS-001", "RS-002"]);
  });

  it("merges HYPOTHESES.md status into node", async () => {
    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    const rs1 = data.nodes.find((n: any) => n.id === "RS-001");
    assert.equal(rs1.status, "CONFIRMED");
    assert.equal(rs1.isProposal, false);
  });

  it("RUNNING node reflects status", async () => {
    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    const rs2 = data.nodes.find((n: any) => n.id === "RS-002");
    assert.equal(rs2.status, "RUNNING");
    assert.equal(rs2.stage, 4);
  });

  it("nodes have gate fields (even if all false — no experiments dir)", async () => {
    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    const rs1 = data.nodes.find((n: any) => n.id === "RS-001");
    assert.ok("prereg" in rs1.gates);
    assert.ok("judgeLock" in rs1.gates);
    assert.ok("baseline" in rs1.gates);
    assert.ok("falsif" in rs1.gates);
  });

  it("gates are true when experiment files exist", async () => {
    const expDir = join(dir, "experiments", "RS-001");
    await mkdir(expDir, { recursive: true });
    await writeFile(join(expDir, "prereg.md"), "# Pre-registration\n");
    await writeFile(join(expDir, "judge.lock"), "sha256:abc123\n");
    await writeFile(join(expDir, "baseline.md"), "# Baseline\n");

    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    const rs1 = data.nodes.find((n: any) => n.id === "RS-001");
    assert.equal(rs1.gates.prereg, true);
    assert.equal(rs1.gates.judgeLock, true);
    assert.equal(rs1.gates.baseline, true);
  });

  it("edges connect root to all nodes", async () => {
    const res = await fetch(server.url + "/api/state");
    const data = await res.json() as any;
    const rootEdges = data.edges.filter((e: any) => e.source === "root");
    assert.equal(rootEdges.length, 2);
  });

  it("empty repo returns no-document root and zero nodes", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "ep-empty-"));
    const emptyServer = await startGraphServer(emptyDir, Date.now());
    try {
      const res = await fetch(emptyServer.url + "/api/state");
      const data = await res.json() as any;
      assert.equal(data.nodes.length, 0);
      assert.ok(data.root.label.length > 0);
    } finally {
      emptyServer.close();
      await rm(emptyDir, { recursive: true });
    }
  });
});
