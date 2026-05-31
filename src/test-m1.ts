// Test script for epistemic M1 functionality
// Run with: npx tsx src/test-m1.ts

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadRepoState, parseHypotheses, getActiveHypothesis, hypothesisToMarkdown, fileExists } from "./state/repo.ts";
import type { HypothesisEntry } from "./state/repo.ts";

const TEST_DIR = process.argv[2] || "/tmp/epistemic-test";

async function test() {
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log("\n🧪 Epistemic M1 test suite\n");

  // Test 1: loadRepoState returns null for empty repo
  console.log("1. loadRepoState on empty repo");
  const state = await loadRepoState(TEST_DIR);
  assert("hypotheses is null", state.hypotheses === null);
  assert("baselines is null", state.baselines === null);
  assert("results is null", state.results === null);

  // Test 2: Create scaffold files
  console.log("\n2. Scaffold creation");
  const files = ["HYPOTHESES.md", "BASELINES.md", "RESULTS.md", "KILLED.md", "OVERRIDES.md", "JUDGES.md"];
  const dirs = ["experiments", "smokes", "verify"];
  
  for (const d of dirs) {
    await mkdir(join(TEST_DIR, d), { recursive: true });
  }
  for (const f of files) {
    await writeFile(join(TEST_DIR, f), `# ${f}\n\n`, "utf8");
  }
  
  for (const f of files) {
    assert(`${f} exists`, await fileExists(join(TEST_DIR, f)));
  }
  for (const d of dirs) {
    assert(`${d}/ exists`, await fileExists(join(TEST_DIR, d)));
  }

  // Test 3: Parse hypotheses from markdown
  console.log("\n3. Hypothesis parsing");
  const h1: HypothesisEntry = {
    id: "test-hypothesis-1",
    claim: "X beats Y by 5% on benchmark Z",
    falsifier: "Y beats X on the same benchmark",
    n: 30,
    judgeRef: "gpt-4o temp=0 seed=42",
    baselineRef: "Y published 0.85 on Z",
    costCap: 50,
    status: "OPEN",
    timestamp: Date.now(),
  };

  const md = hypothesisToMarkdown(h1);
  assert("markdown includes id", md.includes("test-hypothesis-1"));
  assert("markdown includes claim", md.includes("X beats Y by 5%"));
  assert("markdown includes status OPEN", md.includes("OPEN"));

  // Write and re-parse
  const hypoPath = join(TEST_DIR, "HYPOTHESES.md");
  await writeFile(hypoPath, "# Hypotheses\n\n" + md, "utf8");

  const freshState = await loadRepoState(TEST_DIR);
  assert("HYPOTHESES.md readable", freshState.hypotheses !== null);
  assert("HYPOTHESES.md has our content", freshState.hypotheses!.includes("test-hypothesis-1"));

  const parsed = parseHypotheses(freshState.hypotheses!);
  assert("parsed 1 hypothesis", parsed.length === 1);
  assert("parsed id matches", parsed[0].id === "test-hypothesis-1");
  assert("parsed status is OPEN", parsed[0].status === "OPEN");
  
  const active = getActiveHypothesis(parsed);
  assert("active hypothesis found", active !== undefined);
  assert("active is our hypothesis", active!.id === "test-hypothesis-1");

  // Test 4: Create prereg and check fileExists
  console.log("\n4. Prereg detection");
  await mkdir(join(TEST_DIR, "experiments", "test-hypothesis-1"), { recursive: true });
  await writeFile(join(TEST_DIR, "experiments", "test-hypothesis-1", "prereg.md"),
    "# Preregistration\n\nClaim: X beats Y by 5%\n", "utf8");
  
  assert("prereg.md exists", await fileExists(join(TEST_DIR, "experiments", "test-hypothesis-1", "prereg.md")));
  
  // Test 5: Baseline staleness detection
  console.log("\n5. Baseline staleness");
  const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const baselineEntry = [
    "## Baseline: Mem0",
    "- **URL:** https://example.com/mem0",
    "- **Score:** 0.85",
    `- **Retrieved:** ${oldDate}`,
    "",
  ].join("\n");
  await writeFile(join(TEST_DIR, "BASELINES.md"), "# Baselines\n\n" + baselineEntry, "utf8");

  // Verify the baseline file was written
  const blState = await loadRepoState(TEST_DIR);
  assert("BASELINES.md readable", blState.baselines !== null);
  assert("BASELINES.md has stale date", blState.baselines!.includes(oldDate));

  // Test 6: Judge lock hash
  console.log("\n6. Judge lock concept");
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256")
    .update(`gpt-4o temp=0 seed=42:test-hypothesis-1`)
    .digest("hex");
  assert("judge lock hash is 64 hex chars", /^[a-f0-9]{64}$/.test(hash));

  // Summary
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
