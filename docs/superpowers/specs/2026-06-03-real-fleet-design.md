# Epistemic Fleet — Real Parallel Experiments Design Spec

**Goal:** Replace the simulated `epistemic fleet` POC with real parallel experiment execution — each OPEN/RUNNING hypothesis gets a git worktree sandbox and a detached `claude --print` subprocess following the epistemic pipeline, visualized live in a split-pane TUI with kill controls.

**Architecture:** Detached child processes + PID files. The TUI spawns `claude --print "<stage prompt>"` per hypothesis in `.worktrees/<id>/`, writes `.worktrees/<id>/fleet.pid`, then polls each worktree's state files every 2s using the existing `loadFleet()`. On reopen, reconnects to live PIDs. Kill: SIGTERM + mark KILLED + remove worktree.

**Agent:** Claude Code CLI (`claude --print`). Uses the installed epistemic skills. No new auth required.

**Interaction:** Kill controls — arrow keys to select a pane, `k` to kill. Read-only otherwise.

**Hypothesis source:** Existing OPEN/RUNNING entries in `HYPOTHESES.md`. Fleet runs what's already preregistered.

---

## Components

### 1. Worktree manager — `src/fleet/worktree.ts`

```typescript
createWorktree(cwd, hypothesisId): Promise<string>  // returns worktree path
removeWorktree(cwd, hypothesisId): Promise<void>
listWorktrees(cwd): Promise<{id, path, pid?}[]>
```

- Creates `.worktrees/<id>/` via `git worktree add`
- Copies `.env` if present (API keys)
- Reads/writes `.worktrees/<id>/fleet.pid`

### 2. Agent spawner — `src/fleet/spawner.ts`

```typescript
spawnAgent(worktreePath, stagePrompt): Promise<number>  // returns PID
isAlive(pid): boolean
killAgent(pid): void
buildStagePrompt(hypothesis, stageFacts): string
```

- Spawns `claude --print "<prompt>"` detached with stdout/stderr piped to `.worktrees/<id>/fleet.log`
- Returns PID immediately (does not await completion)
- `buildStagePrompt`: constructs the epistemic methodology prompt for the current stage

### 3. Fleet controller — `src/fleet/controller.ts`

```typescript
class FleetController {
  start(cwd): Promise<void>        // create worktrees + spawn agents for all OPEN/RUNNING
  reconnect(cwd): Promise<void>    // read existing PIDs, check alive
  kill(cwd, id): Promise<void>     // SIGTERM + KILLED + rm worktree
  poll(cwd): Promise<FleetState>   // loadFleet() per worktree, merge with pid status
  stop(): void                     // cleanup timers
}
```

### 4. Real fleet TUI — `src/fleet/app.ts` (replaces `src/research/fleet-app.ts`)

- Alt-screen, same pane layout using existing `renderForest()` + `renderPanes()`  
- Arrow key selection, `k` to kill selected pane, `q` to quit (processes keep running)
- Status header shows: running / shipped / killed counts + `[detached — processes survive quit]`
- Pane content: hypothesis id, current stage, gate checklist, cost bar, last log line

### 5. Stage prompt builder

The prompt injected into each `claude --print` call follows the epistemic mechanism:

```
You are running hypothesis <id>: "<claim>"
Current stage: <stage> (based on what exists in experiments/<id>/)
Use the epistemic skill to advance this hypothesis one stage.
Follow the full methodology — do not skip gates.
Working directory: <worktree-path>
```

---

## Data flow

```
HYPOTHESES.md
  → FleetController.start()
    → createWorktree() per hypothesis
    → spawnAgent(worktreePath, stagePrompt) → writes fleet.pid
  
  [every 2s]
  → FleetController.poll()
    → loadFleet(worktreePath) per active worktree
    → isAlive(pid) check
    → FleetState { panes: PaneData[] }
  
  → renderForest(panes) → TUI output

  [user hits k]
  → FleetController.kill(cwd, selectedId)
    → killAgent(pid) → SIGTERM
    → updateHypothesisStatus(worktreePath, id, "KILLED")
    → removeWorktree(cwd, id)
```

---

## File structure

```
src/fleet/
  worktree.ts     — git worktree create/remove/list
  spawner.ts      — claude process spawn/kill/alive check
  controller.ts   — orchestrates start/reconnect/kill/poll
  app.ts          — TUI (replaces src/research/fleet-app.ts)
  prompt.ts       — buildStagePrompt()
test/
  fleet-worktree.test.ts   — worktree operations (temp git repo fixture)
  fleet-spawner.test.ts    — spawner unit tests (mock child_process)
  fleet-controller.test.ts — controller integration (temp git repo)
```

---

## What's NOT in scope

- Starting new experiments from within the fleet view (hypothesis creation stays in main agent chat)
- Full action menus (approve/chat) — kill only
- Multi-repo fleets
- The background daemon pattern — processes are detached children, not a separate daemon

---

## Success criteria

- `epistemic fleet` in a repo with ≥1 OPEN hypothesis: creates worktree, spawns `claude`, shows live pane
- Closing the TUI with `q`: processes keep running (verified via `ps`)
- Reopening `epistemic fleet`: reconnects to live PIDs, shows correct stage/gate state
- Pressing `k` on a pane: process killed, hypothesis marked KILLED, worktree removed
- All unit tests pass; no tests require `claude` to be installed (spawner is mockable)
