# Epistemic OMP Fork — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fork oh-my-pi into `packages/omp/` inside the epistemic repo, retheme it to Amber Lab, add a always-visible research sidebar, and progressively replace the pi extension model so epistemic's pipeline (gates, `/monitor`, `/board`, stage engine) is native to the TUI rather than loaded as a plugin on top.

**Architecture:** Three layers — `pi-agent-core` stays as the LLM backend (streaming, tool calls, context); `packages/omp/` is the forked TUI shell (renderer, layout, input loop, theme); the epistemic research core (gates, commands, sidebar) moves from `src/index.ts` extension shim into omp's own command layer. A third-party plugin API (Phase 3) replaces pi's `registerCommand`/`on`/`setWidget`.

**Tech Stack:** TypeScript ESM, oh-my-pi source (fork), `@earendil-works/pi-agent-core` (kept as agent backend), existing `src/state/`, `src/monitor/fleet.ts`, `src/research/` modules.

---

## Phases

### Phase 1 — Fork + Retheme + Research Sidebar

Deliverable: a working epistemic agent with Amber Lab colors and a research sidebar panel. The existing `src/index.ts` extension still loads on top (no behavior change).

**What changes:**
- Clone oh-my-pi source into `packages/omp/src/`
- Strip pi/earendil branding; rename package to `@epistemic/omp`
- Apply Amber Lab color tokens throughout
- Add `ResearchSidebar` widget to the right panel slot
- Rename binary entry point to `epistemic`
- Update root `package.json` to use `packages/omp/` as workspace

**What stays:**
- `src/index.ts` extension (wired through the new omp, no behavior change)
- `src/monitor/`, `src/research/`, `src/state/` (read by ResearchSidebar)
- `skills/`, `hooks/` (unchanged)
- `pi-agent-core` as LLM backend

### Phase 2 — Native Pipeline (replace extension model)

Deliverable: epistemic's gates, commands, and stage engine live inside `packages/omp/src/commands/` — not loaded as an extension. `src/index.ts` extension shim is deleted.

**What changes:**
- Port all commands from `src/index.ts` → `packages/omp/src/commands/epistemic.ts`
- Port gates (prereg-gate, judge-lock, cost-ledger) → `packages/omp/src/gates/`
- Port stage engine (`src/state/stage.ts`) → `packages/omp/src/research/stage.ts`
- Delete `src/index.ts` and the `extensionFactories` injection in `src/cli/epistemic.ts`
- `/monitor`, `/board`, `/idea`, `/map`, `/fleet` are registered as omp-native commands

### Phase 3 — Epistemic Plugin API

Deliverable: third parties extend epistemic using `epistemic.registerCommand()`, `epistemic.on()`, `epistemic.panel()`, `epistemic.gate()` — not pi's API.

**What changes:**
- Add `packages/omp/src/plugin/api.ts` — typed plugin interface
- Replace all internal uses of `pi.registerCommand` / `pi.on` / `ctx.ui.setWidget` with the new API
- Document the plugin API in README
- Publish `@epistemic/omp` to npm so others can build on it

---

## Research Sidebar Spec

Width: 28 columns. Collapses to a single bottom status line when terminal width < 100.

```
Ξ H-004  Scaling LoRA…        ← active hypothesis id + truncated title
RUNNING · stage 4/9            ← colored by status (amber=running, green=ship, red=kill)
────────────────────
prereg  ✓                      ← gate checklist (green ✓ / red ✗)
judge   ✓
baseline ✗
results  ✗
────────────────────
$34 / $210                     ← cost spent / cap
████░░░░ 16%                   ← amber <50%, yellow 50-80%, red ≥80%
────────────────────
→ run baseline                 ← next action from deriveStage()
```

Data source: `src/monitor/fleet.ts:loadFleet()` + `src/state/stage.ts:deriveStage()`. Updates on every tool-call completion (same tick as the monitor widget).

---

## Theme: Amber Lab

Color tokens (replace omp's default palette):

| Token | Value | Use |
|-------|-------|-----|
| `bg` | `#0f0a00` | Terminal background |
| `bg-panel` | `#1a0f00` | Sidebar / panel background |
| `border` | `#2a1a00` | Panel borders |
| `primary` | `#f59e0b` | Brand color, headings |
| `text` | `#fbbf24` | Body text |
| `dim` | `#78492a` | Dim/secondary text |
| `green` | `#34d399` | Success, shipped, gate pass |
| `red` | `#ef4444` | Error, killed, gate fail |
| `yellow` | `#fcd34d` | Warning, 50-80% cost |
| `cyan` | `#fde68a` | Highlight (warm white-amber) |

---

## File Structure

```
epistemic/
  packages/
    omp/
      src/
        theme/
          amber-lab.ts         ← color tokens
        layout/
          ResearchSidebar.ts   ← sidebar widget
          index.ts             ← layout composition (Phase 1: adds sidebar slot)
        commands/
          epistemic.ts         ← Phase 2: native commands
        gates/
          prereg.ts            ← Phase 2: native gates
          judge-lock.ts
          cost-ledger.ts
        research/
          stage.ts             ← Phase 2: moved from src/state/stage.ts
        plugin/
          api.ts               ← Phase 3: plugin interface
      package.json             (name: @epistemic/omp, bin: epistemic)
      tsconfig.json
  src/                         ← existing code (deleted in Phase 2)
  skills/                      ← unchanged
  hooks/                       ← unchanged
  bin/epistemic.mjs            ← updated to point at packages/omp
```

---

## What Is NOT in Scope

- Replacing `pi-agent-core` (the LLM backend) — that stays for all three phases
- Rewriting the monitor TUI from scratch — existing `src/monitor/` code is reused
- Changing the Claude Code skills or hooks format
- A GUI or web-based frontend

---

## Success Criteria per Phase

| Phase | Done when |
|-------|-----------|
| 1 | `epistemic` binary works, Amber Lab theme visible, research sidebar shows active hypothesis state |
| 2 | `src/index.ts` deleted, all commands work natively, no `extensionFactories` in launcher |
| 3 | External plugin can call `epistemic.registerCommand()` and have it appear in the TUI |
