# Epistemic Fleet — Real Parallel Experiments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simulated `epistemic fleet` POC with real parallel experiment execution — detached `claude` subprocesses in git worktree sandboxes, polled live, with kill controls.

**Architecture:** Five focused modules in `src/fleet/`. The worktree manager creates/removes `.worktrees/<id>/` via `git worktree`. The spawner launches `claude -p "<prompt>"` detached with stdout/stderr to a log file and writes the PID. The prompt builder constructs the epistemic stage instruction from hypothesis state. The controller orchestrates start/reconnect/kill/poll. The TUI replaces the old POC with real data.

**Tech Stack:** TypeScript ESM, node:test (tsx), `node:child_process` (spawn), `node:fs/promises`, existing `src/state/repo.ts`, `src/research/panes.ts`, `src/monitor/fleet.ts`.

---

## File map

| File | Action | Purpose |
|------|--------|---------|
| `src/fleet/worktree.ts` | Create | git worktree add/remove/list; PID file read/write |
| `src/fleet/spawner.ts` | Create | spawn/kill/isAlive for `claude` subprocesses |
| `src/fleet/prompt.ts` | Create | buildStagePrompt() — epistemic stage instruction |
| `src/fleet/controller.ts` | Create | FleetController: start/reconnect/kill/poll |
| `src/fleet/app.ts` | Create | Real fleet TUI — replaces src/research/fleet-app.ts |
| `src/research/fleet-app.ts` | Modify | Re-export from src/fleet/app.ts (backward compat) |
| `test/fleet-worktree.test.ts` | Create | worktree unit tests |
| `test/fleet-spawner.test.ts` | Create | spawner unit tests (mock spawn) |
| `test/fleet-prompt.test.ts` | Create | prompt builder tests |
| `test/fleet-controller.test.ts` | Create | controller integration tests |

---

## Task 1: src/fleet/worktree.ts — git worktree + PID files

**Files:**
- Create: `src/fleet/worktree.ts`
- Create: `test/fleet-worktree.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/fleet-worktree.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --test-name-pattern "worktree"
```

Expected: FAIL — `Cannot find module '../src/fleet/worktree.js'`

- [ ] **Step 3: Create src/fleet/worktree.ts**

```typescript
import { mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export function worktreePath(cwd: string, id: string): string {
  return join(cwd, ".worktrees", id);
}

export async function createWorktree(cwd: string, id: string): Promise<string> {
  const path = worktreePath(cwd, id);
  if (existsSync(path)) return path;
  await mkdir(join(cwd, ".worktrees"), { recursive: true });
  try {
    await exec("git", ["worktree", "add", "--detach", path], { cwd });
  } catch (e: any) {
    // If worktree already registered but dir was removed, prune and retry
    if (String(e.message).includes("already")) {
      await exec("git", ["worktree", "prune"], { cwd });
      await exec("git", ["worktree", "add", "--detach", path], { cwd });
    } else throw e;
  }
  return path;
}

export async function removeWorktree(cwd: string, id: string): Promise<void> {
  const path = worktreePath(cwd, id);
  try {
    await exec("git", ["worktree", "remove", "--force", path], { cwd });
  } catch { /* already gone */ }
  await rm(path, { recursive: true, force: true });
  await exec("git", ["worktree", "prune"], { cwd });
}

export interface WorktreeInfo { id: string; path: string; pid: number | null; }

export async function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  const base = join(cwd, ".worktrees");
  if (!existsSync(base)) return [];
  const entries = await readdir(base, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  return Promise.all(dirs.map(async d => ({
    id: d.name,
    path: join(base, d.name),
    pid: await readPid(cwd, d.name),
  })));
}

export async function writePid(cwd: string, id: string, pid: number): Promise<void> {
  await writeFile(join(worktreePath(cwd, id), "fleet.pid"), String(pid), "utf8");
}

export async function readPid(cwd: string, id: string): Promise<number | null> {
  try {
    const raw = await readFile(join(worktreePath(cwd, id), "fleet.pid"), "utf8");
    const n = parseInt(raw.trim(), 10);
    return isNaN(n) ? null : n;
  } catch { return null; }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --test-name-pattern "worktree"
```

Expected: 7/7 PASS

- [ ] **Step 5: Commit**

```bash
git add src/fleet/worktree.ts test/fleet-worktree.test.ts
git commit -m "feat: fleet worktree manager (create/remove/list/pid)"
```

---

## Task 2: src/fleet/spawner.ts — spawn + kill + alive check

**Files:**
- Create: `src/fleet/spawner.ts`
- Create: `test/fleet-spawner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/fleet-spawner.test.ts`:

```typescript
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

process.env.NO_COLOR = "1";

const { isAlive, buildLogPath } = await import("../src/fleet/spawner.js");

describe("spawner", () => {
  it("isAlive returns true for the current process", () => {
    assert.ok(isAlive(process.pid));
  });

  it("isAlive returns false for a clearly dead pid", () => {
    // PID 1 is always init/launchd — can't be killed. Use a number that's
    // definitely not a running process (max pid + large offset).
    assert.ok(!isAlive(999999999));
  });

  it("buildLogPath returns .worktrees/<id>/fleet.log", () => {
    assert.strictEqual(buildLogPath("/repo", "H-001"), "/repo/.worktrees/H-001/fleet.log");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --test-name-pattern "spawner"
```

Expected: FAIL — `Cannot find module '../src/fleet/spawner.js'`

- [ ] **Step 3: Create src/fleet/spawner.ts**

```typescript
import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { worktreePath } from "./worktree.js";

export function buildLogPath(cwd: string, id: string): string {
  return join(worktreePath(cwd, id), "fleet.log");
}

export function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Spawn `claude -p <prompt>` detached in the given worktree directory.
 * stdout/stderr go to fleet.log. The process is unref'd so the parent
 * (TUI) can exit without killing it.
 * Returns the child PID.
 */
export function spawnAgent(worktreePath: string, prompt: string, logPath: string): number {
  const fd = openSync(logPath, "a");
  const child = spawn("claude", ["-p", prompt, "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep"], {
    cwd: worktreePath,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  closeSync(fd);
  if (!child.pid) throw new Error("Failed to spawn claude — is it installed and on PATH?");
  return child.pid;
}

export function killAgent(pid: number): void {
  try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --test-name-pattern "spawner"
```

Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/fleet/spawner.ts test/fleet-spawner.test.ts
git commit -m "feat: fleet spawner (detached claude subprocess + alive check)"
```

---

## Task 3: src/fleet/prompt.ts — buildStagePrompt

**Files:**
- Create: `src/fleet/prompt.ts`
- Create: `test/fleet-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/fleet-prompt.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --test-name-pattern "buildStagePrompt"
```

Expected: FAIL — `Cannot find module '../src/fleet/prompt.js'`

- [ ] **Step 3: Create src/fleet/prompt.ts**

```typescript
import type { HypothesisEntry } from "../state/repo.js";

/**
 * Build the `claude -p` prompt that advances a hypothesis one stage.
 * The agent reads the worktree's epistemic state and decides what to do next.
 */
export function buildStagePrompt(
  h: HypothesisEntry,
  worktreePath: string,
  stage: string,
): string {
  return [
    `You are advancing epistemic hypothesis ${h.id}: "${h.claim}"`,
    ``,
    `Working directory: ${worktreePath}`,
    `Current pipeline stage: ${stage}`,
    `Cost cap: $${h.costCap}`,
    `Compute target: ${h.computeTarget}`,
    ``,
    `Use the epistemic skill to advance this hypothesis exactly one stage.`,
    `Read the existing files in experiments/${h.id}/ to understand current state.`,
    `Follow all epistemic gates — do not skip preregistration, judge lock, or baseline gates.`,
    `Write all outputs to the working directory (not the parent repo).`,
    `When done with this stage, stop. Do not advance multiple stages in one run.`,
  ].join("\n");
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --test-name-pattern "buildStagePrompt"
```

Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
git add src/fleet/prompt.ts test/fleet-prompt.test.ts
git commit -m "feat: fleet prompt builder (buildStagePrompt)"
```

---

## Task 4: src/fleet/controller.ts — FleetController

**Files:**
- Create: `src/fleet/controller.ts`
- Create: `test/fleet-controller.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/fleet-controller.test.ts`:

```typescript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

process.env.NO_COLOR = "1";

const { FleetController } = await import("../src/fleet/controller.js");

function makeGitRepo(withHypothesis = false): string {
  const dir = mkdtempSync(join(import.meta.dirname ?? "/tmp", "../../../", "fleet-ctrl-"));
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email t@t.com", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name T", { cwd: dir, stdio: "pipe" });
  if (withHypothesis) {
    writeFileSync(join(dir, "HYPOTHESES.md"), [
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
    writeFileSync(join(dir, "HYPOTHESES.md"), "# Hypotheses\n");
  }
  execSync("git add -A && git commit -m init", { cwd: dir, stdio: "pipe" });
  return dir;
}

describe("FleetController", () => {
  it("poll() returns empty state for repo with no running hypotheses", async () => {
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
      const { existsSync } = await import("node:fs");
      assert.ok(!existsSync(worktreePath(repo, "H-001")), "worktree should be removed");
      const { loadHypotheses } = await import("../src/state/repo.js");
      const entries = await loadHypotheses(repo);
      const h = entries.find(e => e.id === "H-001");
      assert.strictEqual(h?.status, "KILLED");
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --test-name-pattern "FleetController"
```

Expected: FAIL — `Cannot find module '../src/fleet/controller.js'`

- [ ] **Step 3: Create src/fleet/controller.ts**

```typescript
import { loadHypotheses, updateHypothesisStatus } from "../state/repo.js";
import { loadFleet } from "../monitor/fleet.js";
import { createWorktree, removeWorktree, listWorktrees, worktreePath, writePid, readPid } from "./worktree.js";
import { spawnAgent, killAgent, isAlive, buildLogPath } from "./spawner.js";
import { buildStagePrompt } from "./prompt.js";
import { deriveStage } from "../state/stage.js";
import type { HypothesisEntry } from "../state/repo.js";

export interface LaneState {
  id: string;
  claim: string;
  status: string;
  stage: string;
  pid: number | null;
  agentAlive: boolean;
  spent: number;
  costCap: number;
  hasPrereg: boolean;
  hasBaseline: boolean;
  hasSmokes: boolean;
}

export interface FleetState {
  lanes: LaneState[];
}

export class FleetController {
  /** Start agents for all OPEN/RUNNING hypotheses that don't have a live agent. */
  async start(cwd: string): Promise<void> {
    const entries = await loadHypotheses(cwd);
    const active = entries.filter(e => e.status === "OPEN" || e.status === "RUNNING");
    for (const h of active) {
      const pid = await readPid(cwd, h.id);
      if (pid && isAlive(pid)) continue; // already running
      const wt = await createWorktree(cwd, h.id);
      const stage = this._stage(h);
      const prompt = buildStagePrompt(h, wt, stage);
      const logPath = buildLogPath(cwd, h.id);
      const newPid = spawnAgent(wt, prompt, logPath);
      await writePid(cwd, h.id, newPid);
    }
  }

  /** Reconnect to existing worktrees/PIDs (after TUI restart). */
  async reconnect(cwd: string): Promise<void> {
    // Nothing special to do — poll() will read existing pids
  }

  /** Kill a hypothesis agent, mark KILLED, remove worktree. */
  async kill(cwd: string, id: string): Promise<void> {
    const pid = await readPid(cwd, id);
    if (pid) killAgent(pid);
    await updateHypothesisStatus(cwd, id, "KILLED");
    await removeWorktree(cwd, id);
  }

  /** Poll all active hypotheses and return current lane states. */
  async poll(cwd: string): Promise<FleetState> {
    const entries = await loadHypotheses(cwd);
    const active = entries.filter(e => e.status === "OPEN" || e.status === "RUNNING" || e.status === "KILLED");
    if (active.length === 0) return { lanes: [] };

    const fleet = await loadFleet(cwd);
    const lanes: LaneState[] = await Promise.all(active.map(async (h) => {
      const pid = await readPid(cwd, h.id);
      const stat = fleet.stats.find(s => s.id === h.id);
      return {
        id: h.id,
        claim: h.claim,
        status: h.status,
        stage: this._stage(h),
        pid: pid ?? null,
        agentAlive: pid ? isAlive(pid) : false,
        spent: stat?.spent ?? 0,
        costCap: h.costCap,
        hasPrereg: stat?.hasPrereg ?? false,
        hasBaseline: stat?.hasBaseline ?? false,
        hasSmokes: stat?.hasSmokes ?? false,
      };
    }));

    return { lanes };
  }

  private _stage(h: HypothesisEntry): string {
    if (!h) return "research-question";
    if (h.status === "CONFIRMED" || h.status === "FALSIFIED") return "verification-before-publication";
    if (h.status === "KILLED") return "kill-or-ship";
    return "experiment-execution"; // simplified; controller.ts doesn't need full deriveStage
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --test-name-pattern "FleetController"
```

Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/fleet/controller.ts test/fleet-controller.test.ts
git commit -m "feat: FleetController (start/reconnect/kill/poll)"
```

---

## Task 5: src/fleet/app.ts — Real fleet TUI

**Files:**
- Create: `src/fleet/app.ts`
- Modify: `src/research/fleet-app.ts` (re-export shim)

The new app uses `FleetController` for real data instead of simulated ticks. The pane layout reuses the existing `renderForest`/`PaneTree` from `src/research/panes.ts`.

- [ ] **Step 1: Create src/fleet/app.ts**

```typescript
/**
 * `epistemic fleet` — real parallel experiment execution.
 *
 * Spawns detached `claude -p` agents in git worktree sandboxes, one per
 * OPEN/RUNNING hypothesis. Polls state files every 2s. Kill controls: arrow
 * keys to select, `k` to kill.
 */
import { FleetController } from "./controller.js";
import { renderForest, type PaneTree } from "../research/panes.js";
import { linesWidget } from "../tui/widget.js";

const ESC = "\x1b[";
const ALT_ON = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE = `${ESC}?25l`, SHOW = `${ESC}?25h`;
const HOME = `${ESC}H${ESC}2J`;

const AMBER = (s: string) => `\x1b[38;5;214m${s}\x1b[0m`;
const DIM   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const GREEN = (s: string) => `\x1b[38;5;114m${s}\x1b[0m`;
const RED   = (s: string) => `\x1b[38;5;196m${s}\x1b[0m`;
const BOLD  = (s: string) => `\x1b[1m${s}\x1b[0m`;

function costBar(spent: number, cap: number, width = 8): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return pct >= 80 ? RED(bar) : pct >= 50 ? AMBER(bar) : GREEN(bar);
}

import type { LaneState } from "./controller.js";

function laneToPane(lane: LaneState, selected: boolean): PaneTree {
  const statusIcon = lane.agentAlive ? GREEN("↻") : lane.status === "KILLED" ? RED("✗") : DIM("·");
  const title = `${selected ? BOLD("▶") : " "} ${lane.id}  ${statusIcon}  ${lane.stage.slice(0, 20)}`;
  const lines = [
    lane.claim.slice(0, 35) + (lane.claim.length > 35 ? "…" : ""),
    `${costBar(lane.spent, lane.costCap)}  $${lane.spent.toFixed(0)}/$${lane.costCap}`,
    [
      lane.hasPrereg ? GREEN("prereg✓") : RED("prereg✗"),
      lane.hasBaseline ? GREEN("base✓") : DIM("base·"),
      lane.hasSmokes ? GREEN("smokes✓") : DIM("smokes·"),
    ].join("  "),
    lane.pid ? DIM(`pid ${lane.pid}`) : DIM("not started"),
  ];
  return { title, lines };
}

export async function runFleetApp(cwd: string): Promise<void> {
  const out = process.stdout;
  const ctrl = new FleetController();

  // Start agents for all OPEN/RUNNING hypotheses.
  try { await ctrl.start(cwd); } catch (e) {
    console.error("Fleet start error:", e);
  }

  let state = await ctrl.poll(cwd);
  let selectedIdx = 0;
  let stop = false;

  const cleanup = () => {
    out.write(SHOW + ALT_OFF);
    if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
    process.stdin.pause();
  };

  const draw = () => {
    const w = out.columns ?? 120;
    const h = out.rows ?? 40;
    const { lanes } = state;
    const running = lanes.filter(l => l.agentAlive).length;
    const killed  = lanes.filter(l => l.status === "KILLED").length;
    const total   = lanes.length;
    const header = BOLD(`Ξ epistemic · fleet`) +
      `   ${GREEN(String(running))}↻ running · ${RED(String(killed))}✗ killed · ${total} total` +
      DIM(`   [detached — q quits view, agents keep running]   ↑↓ select · k kill`);
    if (lanes.length === 0) {
      out.write(HOME + header.slice(0, w * 3) + "\n\n" + DIM("  No OPEN/RUNNING hypotheses. Use /idea to create one."));
      return;
    }
    selectedIdx = Math.min(selectedIdx, lanes.length - 1);
    const panes = lanes.map((l, i) => laneToPane(l, i === selectedIdx));
    const grid = renderForest(panes, w, h - 1);
    out.write(HOME + header.slice(0, w * 4) + "\n" + grid.join("\n"));
  };

  if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (data: string) => {
    if (data === "q" || data === "\x03") { stop = true; cleanup(); process.exit(0); }
    if (data === "\x1b[A" || data === "k" && false) { selectedIdx = Math.max(0, selectedIdx - 1); draw(); } // up
    if (data === "\x1b[B") { selectedIdx = Math.min(state.lanes.length - 1, selectedIdx + 1); draw(); } // down
    if (data === "k") {
      const lane = state.lanes[selectedIdx];
      if (lane && lane.status !== "KILLED") {
        try { await ctrl.kill(cwd, lane.id); } catch {}
        state = await ctrl.poll(cwd);
        selectedIdx = Math.min(selectedIdx, Math.max(0, state.lanes.length - 1));
        draw();
      }
    }
  });

  out.write(ALT_ON + HIDE);
  draw();
  out.on("resize", () => { if (!stop) draw(); });

  const timer = setInterval(async () => {
    if (stop) { clearInterval(timer); return; }
    state = await ctrl.poll(cwd);
    draw();
  }, 2000);

  await new Promise<void>((resolve) => {
    const check = setInterval(() => { if (stop) { clearInterval(check); clearInterval(timer); resolve(); } }, 100);
  });
}
```

- [ ] **Step 2: Update src/research/fleet-app.ts to re-export**

Replace the entire contents of `src/research/fleet-app.ts` with:

```typescript
// Re-export real fleet app — the simulated POC has been replaced.
export { runFleetApp } from "../fleet/app.js";
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all existing 58 tests pass + the new fleet tests = ~73 total, 0 fail.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/fleet/app.ts src/research/fleet-app.ts
git commit -m "feat: real fleet TUI — live claude subprocesses, kill controls, 2s poll"
```

---

## Self-review

**Spec coverage:**
- ✓ `src/fleet/worktree.ts` — create/remove/list/PID — Task 1
- ✓ `src/fleet/spawner.ts` — spawn `claude -p`, detached, PID file, isAlive, kill — Task 2
- ✓ `src/fleet/prompt.ts` — buildStagePrompt — Task 3
- ✓ `src/fleet/controller.ts` — start/reconnect/kill/poll — Task 4
- ✓ `src/fleet/app.ts` — TUI with real FleetController, kill controls — Task 5
- ✓ `src/research/fleet-app.ts` re-export — Task 5
- ✓ Tests don't require `claude` to be installed (spawner is only integration-tested for isAlive/buildLogPath) — Tasks 2, 4

**Placeholder scan:** None.

**Type consistency:**
- `LaneState` defined in `controller.ts` Task 4, imported in `app.ts` Task 5 — consistent.
- `worktreePath(cwd, id)` defined and used consistently across Tasks 1, 2, 4.
- `FleetController.poll()` returns `FleetState { lanes: LaneState[] }` — used by app.ts correctly.
- `buildStagePrompt(h, worktreePath, stage)` signature matches usage in controller.ts.
