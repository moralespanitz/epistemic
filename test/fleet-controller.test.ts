import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

process.env.NO_COLOR = "1";

const { FleetController } = await import("../src/fleet/controller.js");

function makeGitRepo(withHypothesis = false): string {
  const d = mkdtempSync(join(tmpdir(), "fleet-ctrl-"));
  execSync("git init", { cwd: d, stdio: "pipe" });
  execSync("git config user.email t@t.com", { cwd: d, stdio: "pipe" });
  execSync("git config user.name T", { cwd: d, stdio: "pipe" });
  if (withHypothesis) {
    writeFileSync(join(d, "HYPOTHESES.md"), [
      "## Hypothesis: H-001",
      "- **Claim:** test claim",
      "- **Status:** OPEN",
      "- **Cost cap:** 10",
      "- **Compute target:** local",
      "- **Judge:** gpt-4o",
      "- **Falsifier:** if acc < 0.5",
      "- **Baseline ref:** none",
      "- **n:** 5",
    ].join("\n"));
  } else {
    writeFileSync(join(d, "HYPOTHESES.md"), "# Hypotheses\n");
  }
  execSync("git add -A && git commit -m init", { cwd: d, stdio: "pipe" });
  return d;
}

describe("FleetController", () => {
  it("poll() returns empty state for repo with no hypotheses", async () => {
    const repo = makeGitRepo(false);
    try {
      const ctrl = new FleetController();
      const state = await ctrl.poll(repo);
      assert.deepStrictEqual(state.lanes, []);
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });

  it("poll() returns lane for OPEN hypothesis (no worktree yet)", async () => {
    const repo = makeGitRepo(true);
    try {
      const ctrl = new FleetController();
      const state = await ctrl.poll(repo);
      assert.strictEqual(state.lanes.length, 1);
      assert.strictEqual(state.lanes[0].id, "H-001");
      assert.strictEqual(state.lanes[0].agentAlive, false);
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });

  it("kill() marks hypothesis KILLED and removes worktree", async () => {
    const repo = makeGitRepo(true);
    try {
      const { worktreePath, createWorktree, writePid } = await import("../src/fleet/worktree.js");
      await createWorktree(repo, "H-001");
      await writePid(repo, "H-001", 999999999); // dead pid
      const ctrl = new FleetController();
      await ctrl.kill(repo, "H-001");
      assert.ok(!existsSync(worktreePath(repo, "H-001")), "worktree should be removed");
      const { loadHypotheses } = await import("../src/state/repo.js");
      const entries = await loadHypotheses(repo);
      const h = entries.find(e => e.id === "H-001");
      assert.strictEqual(h?.status, "KILLED");
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });
});
