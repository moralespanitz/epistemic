import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

process.env.NO_COLOR = "1";

const { createWorktree, removeWorktree, listWorktrees, writePid, readPid, worktreePath } =
  await import("../src/fleet/worktree.js");

function makeGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "ep-fleet-"));
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@test.com", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name Test", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "README.md"), "# test");
  execSync("git add -A && git commit -m init", { cwd: dir, stdio: "pipe" });
  return dir;
}

describe("worktree", () => {
  let repo: string;
  before(() => { repo = makeGitRepo(); });
  after(() => { try { rmSync(repo, { recursive: true, force: true }); } catch {} });

  it("worktreePath returns .worktrees/<id> under cwd", () => {
    assert.strictEqual(worktreePath(repo, "H-001"), join(repo, ".worktrees", "H-001"));
  });

  it("createWorktree creates the directory", async () => {
    const p = await createWorktree(repo, "H-001");
    assert.ok(existsSync(p), `expected ${p} to exist`);
    assert.strictEqual(p, worktreePath(repo, "H-001"));
  });

  it("createWorktree is idempotent (no error if already exists)", async () => {
    await createWorktree(repo, "H-001");
    await assert.doesNotReject(() => createWorktree(repo, "H-001"));
  });

  it("listWorktrees returns created worktree ids", async () => {
    await createWorktree(repo, "H-002");
    const list = await listWorktrees(repo);
    assert.ok(list.some(w => w.id === "H-001"), "H-001 missing");
    assert.ok(list.some(w => w.id === "H-002"), "H-002 missing");
  });

  it("writePid / readPid round-trip", async () => {
    await createWorktree(repo, "H-003");
    await writePid(repo, "H-003", 99999);
    const pid = await readPid(repo, "H-003");
    assert.strictEqual(pid, 99999);
  });

  it("readPid returns null when file absent", async () => {
    const pid = await readPid(repo, "H-nonexistent");
    assert.strictEqual(pid, null);
  });

  it("removeWorktree removes the directory", async () => {
    await createWorktree(repo, "H-004");
    const p = worktreePath(repo, "H-004");
    assert.ok(existsSync(p));
    await removeWorktree(repo, "H-004");
    assert.ok(!existsSync(p));
  });
});
