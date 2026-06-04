# Epistemic Spatial UX — Design Spec

**Date:** 2026-06-04  
**Status:** Draft  
**Scope:** The complete spatial research experience — browser graph panel, hypothesis lifecycle, brainstorming entry point, kill/ship decision UX.

---

## 1. Overview

Epistemic is a research-discipline agent that enforces the scientific method (pre-register → reproduce baseline → experiment → falsify → kill or ship). This spec defines the **spatial UX layer** on top of that methodology: a live browser graph panel paired with a Claude Code-familiar terminal, giving the experience of a research cockpit rather than a chat thread.

**Design principles:**
- The **Research Document is the root.** Everything branches from it.
- The **terminal is the authority.** The browser graph reflects decisions made there.
- **Proposals are discovered, not announced.** You stay in control of when to branch.
- **One keystroke to decide.** Kill/ship is fast and decisive.
- **Anti-vibe-research by default.** You cannot run experiments without pre-registration. The graph makes this visible.

---

## 2. Architecture

Two surfaces, clear separation of concerns:

```
┌─────────────────────────────┐    ┌──────────────────────────────┐
│   TERMINAL (epistemic CLI)   │    │   BROWSER (graph panel)       │
│                              │    │                               │
│  Authority surface:          │    │  Reflection surface:          │
│  - Brainstorming chat        │    │  - Live hypothesis graph      │
│  - Hypothesis chat           │    │  - Node status (color/state)  │
│  - Gate enforcement          │    │  - Proposals (dashed circles) │
│  - Kill/ship decision        │    │  - Click to navigate          │
│  - All agent interaction     │    │  - Research Document root     │
└──────────────┬───────────────┘    └───────────────┬──────────────┘
               │                                    │
               │◄──── graph updates from terminal ──┤
               │                                    │
               └──── click in graph → terminal ─────┘
                     switches hypothesis context
```

The terminal makes decisions. The browser reflects them. This directionality is intentional — evidence and tooling live in the terminal, so decisions live there too.

**Technical stack:**
- Terminal: existing epistemic CLI (pi-based TUI)
- Browser panel: local server (port auto-assigned), served from `.superpowers/brainstorm/` or `.epistemic/graph/`
- Graph: D3.js hierarchical tree, auto-refreshes by polling `HYPOTHESES.md` + Research Document
- Communication: terminal → browser via file-based state (same pattern as current monitor outbox); browser → terminal via a local HTTP endpoint or file event

---

## 3. Entry Point — Starting Research

### 3.1 First launch (empty repo)

```
$ epistemic
```

1. Terminal opens with the Ξ epistemic header
2. Browser opens automatically at `http://localhost:<port>`
3. Browser shows empty graph with one element:

```
┌──────────────────────────────┐
│                              │
│     ┌───────────────────┐    │
│     │   + New Research  │    │
│     └───────────────────┘    │
│                              │
│     no hypotheses yet        │
└──────────────────────────────┘
```

4. Clicking "+ New Research" OR typing `/new` in the terminal both trigger the brainstorming session.

### 3.2 Returning to existing research

If `HYPOTHESES.md` or a Research Document already exists:
- Terminal loads current state, shows active hypothesis in header
- Browser opens to populated graph with all existing nodes

### 3.3 Multiple research projects

Each project directory is its own epistemic workspace. `epistemic` always reads from the current working directory.

---

## 4. Brainstorming → Research Document

### 4.1 The session

Triggered by "+ New Research" (browser) or `/new` (terminal). The terminal begins a Socratic slot-filling conversation based on `docs/research-document.md`.

The agent asks one question at a time, filling 10 slots:

1. Research Overview (title, version, summary)
2. Research Questions & Hypotheses
3. Background & Motivation
4. Methodology
5. Experimental Setup
6. Expected Contributions
7. Evaluation Metrics
8. Technical Considerations
9. Milestones & Sequencing
10. **Research Stories** ← these become the graph nodes

**Key constraint:** Section 10 (Research Stories) must produce at least one falsifiable, testable RS with explicit validation criteria. The agent rejects vague stories and pushes for specificity on datasets, baselines, and metrics.

### 4.2 Live graph building

As slots fill, the browser graph builds in real time:
- Root node (Research Document rectangle) appears when title is set
- Child circles (Research Stories) appear one by one as RS-001, RS-002, etc. are defined
- Each circle starts in `proposed` state (dashed, amber outline)

### 4.3 Output

When all slots are filled, the agent generates `RESEARCH.md` in the repo root — the complete Research Document in Markdown. This file is the source of truth the graph reads from.

Research Stories from section 10 are automatically registered as hypotheses in `HYPOTHESES.md` (status: OPEN, not yet pre-registered).

---

## 5. The Graph

### 5.1 Layout

Hierarchical top-down tree:

```
┌─────────────────────────┐
│    Research Document    │  ← rectangle, always at root
└────────────┬────────────┘
             │
      ○──────────────○        ← Research Stories / hypotheses
   H-001           H-002
  confirmed        proposed
      │
   ○──────○                   ← sub-hypotheses (branches opened from results)
 H-004   H-005
killed  running
```

### 5.2 Node states and colors

| State | Visual |
|---|---|
| Proposed | Dashed circle, amber outline, dimmed |
| Open (registered) | Solid circle, amber outline |
| Running | Solid circle, amber fill (pulsing) |
| Confirmed | Solid circle, green fill |
| Falsified | Solid circle, red outline, ✗ |
| Killed | Solid circle, red fill, dimmed |
| Shipped | Solid circle, green fill, ✓ badge |

### 5.3 Node label

Each circle shows: hypothesis ID (top), 1-line claim preview (below), status indicator.

**Brief only** — no metrics in the circle. Details appear in the card on click.

### 5.4 Auto-refresh

Graph polls `HYPOTHESES.md` and `RESEARCH.md` every 2 seconds. State changes in the terminal (gate passes, status updates, kill/ship) are reflected in the graph within one poll cycle.

---

## 6. Navigating the Graph

### 6.1 Click a node → details card

First click on any circle expands a details card alongside the node:

```
┌──────────────────────────────┐
│ H-001                        │
│ CoT prompting → HumanEval    │
│ ─────────────────────────── │
│ ● running  14/30 trials      │
│ $4.20 / $20                  │
│ ✓ prereg  ✓ judge            │
│ ✗ stats   ✗ falsif           │
│ stage 4 / 9                  │
│                              │
│ [ Open in terminal → ]       │
└──────────────────────────────┘
```

### 6.2 "Open in terminal →"

Clicking this button switches the terminal to that hypothesis's chat context. The terminal header updates to show H-001. The graph highlights the active node with a thicker border.

### 6.3 Click outside → dismiss card

Clicking anywhere outside the card dismisses it without navigating.

---

## 7. Inside a Hypothesis (Terminal)

### 7.1 Persistent header

When inside a hypothesis, the terminal always shows a one-line header above the chat:

```
◎ H-001 · CoT → HumanEval   stage 4/9 · $4.20/$20 · 14/30 runs
✓ prereg   ✓ judge   ✗ stats   ✗ falsif
──────────────────────────────────────────────────────────────
```

Gates tick from ✗ to ✓ as each stage completes. This is the primary anti-vibe-research signal — you always see what's enforced and what's still open.

### 7.2 Chat

Below the header: standard Claude Code-style chat. The agent is scoped to this hypothesis — it reads `experiments/H-001/` and follows the epistemic pipeline from the current stage.

### 7.3 Back to graph

Typing `/graph` or pressing the configured keybinding returns focus to the browser graph without leaving the hypothesis context. The hypothesis stays active (header persists).

---

## 8. Auto-Proposals After Results

When an experiment confirms (falsification passes), the agent analyses trial variance and generates 1–3 branch proposals.

**These appear silently** as dashed circles in the browser graph, branching from the confirmed node. No modal. No interruption. The terminal shows a single brief line:

```
✓ H-001 confirmed · 3 branches proposed → graph
```

You notice them when you look at the graph. You decide when to act on them.

**Opening a proposal:**
1. Click the dashed circle in graph → details card appears (brief hypothesis description)
2. Click "Open in terminal →" → terminal starts the pre-registration flow for that branch
3. Pre-registration locks it; dashed outline becomes solid

**Dismissing a proposal:**
- Click the dashed circle → details card → "Dismiss" button
- Node disappears from graph, recorded as `dismissed` in `HYPOTHESES.md`

---

## 9. Kill or Ship

### 9.1 Trigger

When all gates are green (`✓ prereg ✓ judge ✓ stats ✓ falsif`) and the agent reaches stage 8 (kill-or-ship), the terminal presents the decision:

```
◎ H-001 · stage 8/9 · kill-or-ship   ✓ ✓ ✓ ✓   $11.40/$20
──────────────────────────────────────────────────────────
Result:     +2.2%   p=0.03   d=0.41
Adversaries: 2/2 failed to falsify

[S]hip   [K]ill   [P]ivot   [R]efine
> _
```

### 9.2 Keyboard shortcuts

| Key | Action | Graph effect |
|---|---|---|
| `S` | Ship — tag and publish | Node → solid green, ✓ badge |
| `K` | Kill — write KILLED.md | Node → dimmed red |
| `P` | Pivot — kill this, open new | Node → red; new dashed circle appears |
| `R` | Refine — re-run from execution | Node stays amber, stage resets to 4 |

### 9.3 XP and rank

After every decision, the header briefly flashes the XP delta:

```
+100 XP  (shipped)   Lv.4 → Lv.5
```

or

```
+40 XP  (killed fast — good discipline)
```

Kill-to-ship ratio tracks toward the discipline badges in the graph panel footer.

---

## 10. Research Document as Source of Truth

`RESEARCH.md` (generated by brainstorming) is the canonical document. The graph reads from it. When the agent updates hypothesis status, it writes to `HYPOTHESES.md`. The graph reads both.

**Files the graph reads:**
- `RESEARCH.md` — root node content, Research Stories list
- `HYPOTHESES.md` — hypothesis status, parent edges, kill reasons
- `experiments/*/prereg.md` — pre-registration presence
- `experiments/*/judge.lock` — judge lock presence
- `experiments/*/smokes/` — results presence
- `RESULTS.md` — shipped hypotheses
- `.epistemic/cost-ledger.jsonl` — spend per hypothesis

**The graph never writes.** It is read-only. All writes go through the terminal (agent or user commands).

---

## 11. Skill Mapping

| Moment | Skill triggered |
|---|---|
| `/new` or "+ New Research" | `research-question` (brainstorming mode, full slot-fill) |
| Proposal opened, pre-registration | `preregistration` |
| Pre-registration done | `baseline-reproduction` |
| Baseline done | `experiment-execution` |
| Results land in smokes/ | `statistical-rigor` → `falsification-review` |
| Results diverge >15% | `surprise-triage` |
| All gates green | `kill-or-ship` |
| Ship pressed | `verification-before-publication` |

---

## 12. Out of Scope (this spec)

- Multi-user / collaborative graph (single researcher only)
- Cloud sync of graph state
- Mobile or tablet support
- Non-terminal harnesses (Codex, Claude Code plugin) — graph panel is epistemic TUI only
- Real-time agent streaming into graph (2s poll is sufficient for v1)
