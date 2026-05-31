# Epistemic Cockpit — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning
**Scope:** A new spatial research UI for epistemic. Does not modify the existing Pi extension.

## Problem

The current epistemic experience is the pi/omp chat plus methodology gates. It works, but the interface is a linear conversation. Research is not linear: you run multiple experiments in parallel, weigh a hypothesis against its alternatives, follow conditional plans ("if this confirms, do that"), and learn from killed branches. A chat flattens all of that into scrollback.

We want a **spatial research environment** — one that feels like piloting a research program, where exploring the structure is part of the work. It should make parallel experiments, alternatives, and conditional plans first-class and visible. The agent conversation becomes a tool you summon, not the interface itself.

## Non-Goals

- **Do not modify the existing extension** (`src/index.ts`, `src/gates/`, `src/extensions/`, `src/adversary/`). The cockpit is additive.
- Not replacing pi/omp as the agent. omp remains the reasoning engine.
- Not a web or desktop app. Terminal-native (Ink).
- Not a general-purpose TUI framework. Purpose-built for epistemic's research model.

## Foundation

- **Ink v5** (React for the terminal, Yoga flexbox layout). Chosen over OpenTUI for stability and zero native dependencies; the React API means a later migration to OpenTUI is low-cost if performance demands it.
- **TypeScript throughout** — reuses the existing `src/state/repo.ts` parsers directly.
- Ships as a **separate workspace package** (`packages/tui/`) with its own `bin`, so it never entangles the extension.

## Core Architectural Decision: Two Kinds of "Run"

The design hinges on separating two things the word "run" conflates:

1. **Experiment jobs** — compute processes (local subprocess / docker / modal). Many run **in parallel**. The cockpit launches and kills them directly via keystrokes. They write telemetry to `experiments/{id}/smokes/` and the cost ledger — exactly where the agent writes today.
2. **The agent (omp)** — a **single, on-demand** interactive reasoning session, summoned with ⌘K for the *thinking* work: forming hypotheses, preregistration, falsification review, kill-or-ship decisions. The ⌘K agent is **context-aware** — when summoned with a node selected, it inherits that hypothesis's context.

**Parallelism lives in the compute layer; the agent stays singular and contextual.** This is what lets you fly multiple missions while keeping one coherent agent conversation.

## The One Invariant

**The filesystem is the single source of truth.** Every action follows one path:

```
keypress ─▶ Command ─┬─▶ ExperimentRunner (spawn/kill job)──┐
                     ├─▶ AgentBridge (summon omp)───────────┤
                     └─▶ form/lock writes ──────────────────┤
                                                             ▼
                                       filesystem (.epistemic/, experiments/, *.md)
                                                             │ chokidar watch (debounced)
                                                             ▼
                                  StateStore ─▶ WorldModel ─▶ Ink re-render
```

No unit holds private state that can drift from epistemic's ledger. This is also why the extension needs no changes: the filesystem is the contract between cockpit and extension.

## Units

Each unit has one purpose, a defined interface, and is testable in isolation.

### WorldModel (pure)
Domain types and derivation. Builds the research **graph** from flat hypotheses.

- Types: `ResearchWorld`, `HypothesisNode` (children, alternatives, conditional-plan edges), `ExperimentRun` (status, trial series, cost series, accuracy series), `Lesson`.
- Derivation: flat `HypothesisEntry[]` + `treeNodeId` + experiment `dependsOn` → graph with edges. (The existing data model already carries `treeNodeId` and `dependsOn`.)
- Depends on: nothing. Pure functions.

### StateStore
Watches the filesystem, parses into a `ResearchWorld`, emits change events.

- Reuses `loadHypotheses`, `getHypothesisSpend`, `getHypothesisSpendByCategory`, `loadLessons`, `loadBaselines` from `src/state/repo.ts`.
- Watches: `HYPOTHESES.md`, `RESULTS.md`, `BASELINES.md`, `.epistemic/cost-ledger.jsonl`, `.epistemic/lessons.jsonl`, `experiments/**`.
- Debounces partial-write races; keeps last-good model on parse failure.
- Depends on: chokidar, repo.ts.

### ExperimentRunner
Launches and kills experiment jobs by `computeTarget`; maintains a PID registry; parses stdout into trial/cost/accuracy series.

- Routing mirrors the experiment-execution skill: `local` (subprocess in venv), `docker` (`docker run`), `modal` (`modal run`).
- **Writes only to `experiments/{id}/smokes/`** — never headline files. Respects all existing gates because it writes to the same provisional location the agent does.
- Crash → run marked `failed`.
- Depends on: node-pty / child_process, repo.ts paths.

### AgentBridge
Spawns `omp` via PTY for the ⌘K reasoning session; streams output into the overlay. One session at a time. Context-aware (passes selected node context into the prompt).

- `omp` absent → bridge disabled, surfaced in the command bar; lenses keep working.
- Depends on: node-pty, omp binary.

### Commands
The cockpit verbs, mapping keystrokes/palette entries to Runner/Bridge calls.

- Phase 1: `spawn`, `kill`, `summon-agent`, `switch-lens`, `select`.
- Phase 2: `fork-alternative`, `edit-conditional-plan`.
- Phase 3: `ship`, verdict actions.
- Depends on: Runner, Bridge, StateStore.

### Ink UI
The cockpit shell.

- `App` — global keyboard routing, active lens, selection state.
- `LensTree` `[1]` — research program as a tech tree. Nodes = hypotheses; sideways branches = alternatives; edges = conditional plans. Killed branches render red and persist as visible lessons.
- `LensMissions` `[2]` — live grid of `ExperimentRun` cards: cost + accuracy sparklines, trial progress, state-colored borders.
- `LensFocus` `[3]` — one experiment deep: smokes, stats, baseline reproduction, falsifier verdicts.
- `Inspector` — persistent right panel; shows the selected node/run in any lens.
- `CommandBar` — ⌘K overlay: command palette + context-aware agent chat.
- `StatusFooter` — fleet burn ($ spent / total cap), running count, gate status.
- Primitives: `Sparkline`, `CostBar`, `TreeRenderer`.
- Depends on: ink, WorldModel.

### bin
`packages/tui/bin/epistemic-tui` — boots StateStore on cwd, renders `<App>`, wires Runner + Bridge.

## Lenses

- **[1] Tree** — the whole research program at a glance; alternatives and conditional plans are structural, not buried in text.
- **[2] Missions** — parallel experiments breathing live; spot divergence early; fleet burn rate.
- **[3] Focus** — depth on one experiment.

Inspector is always present. ⌘K is always one keystroke away.

## Error Handling

| Failure | Behavior |
|---------|----------|
| Experiment process crash | Run → `failed`; red card in Missions; optional lesson. |
| `omp` not found | AgentBridge disabled; command bar shows it; lenses fully work. |
| Corrupt / partial state file | Keep last-good model; show parse-warning indicator. |
| Partial-write watch race | Debounced re-read. |
| `docker`/`modal` unavailable for a target | Spawn rejected with a clear message; experiment stays `pending`. |

## Testing

- **WorldModel** — pure functions; unit-test graph derivation from fixtures.
- **StateStore** — point at a temp dir, write fixture files, assert the model and change events.
- **ExperimentRunner** — launch a fake script emitting trial lines; assert telemetry parsing; assert it only writes to `smokes/`.
- **Ink components** — `ink-testing-library` snapshots per lens.
- **Guard:** existing extension tests and build must stay green; the TUI adds no dependency to the extension.

## Phasing

**Phase 1 — The Cockpit (first deliverable).** WorldModel + StateStore + App shell + all three lenses + Inspector + Footer + context-aware ⌘K AgentBridge + ExperimentRunner with `spawn`/`kill`. This is a working cockpit, not a dashboard — you can launch and kill parallel experiments and watch them live from the first cut.

**Phase 2 — Structure authoring.** `fork-alternative`, conditional-plan editing in the Tree, alternative comparison view.

**Phase 3 — Depth.** Full Focus-lens internals, falsifier verdict rendering, kill-or-ship actions from inside the cockpit.

## Packaging

- New workspace `packages/tui/` with its own `package.json` and `bin`.
- Imports `src/state/repo.ts` parsers (no duplication).
- Existing extension untouched — verified by it gaining zero dependencies on the TUI.
- Launch: `npx epistemic-tui` (or linked binary) from a research repo.
