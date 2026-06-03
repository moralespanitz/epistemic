import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NO_COLOR = "1";

// Import after env is set
const { renderResearchSidebar } = await import("../packages/omp/src/layout/ResearchSidebar.js");

function makeFakeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "ep-sidebar-"));
  writeFileSync(join(dir, "HYPOTHESES.md"), [
    "## Hypothesis: H-001",
    "- **Claim:** LoRA beats baseline",
    "- **Status:** RUNNING",
    "- **Cost cap:** 100",
    "- **Compute target:** local",
  ].join("\n"));
  mkdirSync(join(dir, "experiments", "H-001"), { recursive: true });
  writeFileSync(join(dir, "experiments", "H-001", "prereg.md"), "# Prereg\n");
  return dir;
}

describe("renderResearchSidebar", () => {
  it("returns string array", async () => {
    const dir = makeFakeRepo();
    const lines = await renderResearchSidebar(dir);
    assert.ok(Array.isArray(lines));
    assert.ok(lines.length > 0);
  });

  it("shows hypothesis id in first line", async () => {
    const dir = makeFakeRepo();
    const lines = await renderResearchSidebar(dir);
    assert.ok(lines[0].includes("H-001"), `expected H-001 in: ${lines[0]}`);
  });

  it("shows RUNNING status", async () => {
    const dir = makeFakeRepo();
    const lines = await renderResearchSidebar(dir);
    const all = lines.join("\n");
    assert.ok(all.includes("RUNNING"), `expected RUNNING in: ${all}`);
  });

  it("shows prereg gate check", async () => {
    const dir = makeFakeRepo();
    const lines = await renderResearchSidebar(dir);
    const all = lines.join("\n");
    assert.ok(all.includes("prereg"), `expected prereg gate in: ${all}`);
  });

  it("returns idle line when no hypotheses", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ep-sidebar-empty-"));
    writeFileSync(join(dir, "HYPOTHESES.md"), "# Hypotheses\n");
    const lines = await renderResearchSidebar(dir);
    assert.ok(lines.some(l => l.includes("idle") || l.includes("no active")), `expected idle state in: ${lines.join(" | ")}`);
  });

  it("all lines are strings", async () => {
    const dir = makeFakeRepo();
    const lines = await renderResearchSidebar(dir);
    for (const line of lines) {
      assert.strictEqual(typeof line, "string");
    }
  });
});
