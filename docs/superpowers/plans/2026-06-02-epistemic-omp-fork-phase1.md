# Epistemic OMP Fork — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork oh-my-pi into `packages/omp/`, apply the Amber Lab color theme, add a ResearchSidebar widget that shows active hypothesis state, and wire it into the existing extension — without breaking any existing functionality.

**Architecture:** npm workspaces adds `packages/omp/` as `@epistemic/omp`. The Amber Lab palette lives in two places: a TypeScript token file (`packages/omp/src/theme/amber-lab.ts`) and the pi theme JSON (`themes/epistemic.json`, updated hex values). The `ResearchSidebar` is a standalone module that calls `loadFleet()` + `deriveStage()` and returns `string[]` lines — wired into `src/index.ts` via the existing `linesWidget` + `setWidget` pattern. The existing extension and all tests continue to pass unchanged.

**Tech Stack:** TypeScript ESM, node:test, npm workspaces, `@earendil-works/pi-tui` (truncateToWidth), existing `src/monitor/fleet.ts` + `src/state/stage.ts`.

---

## File map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `"workspaces": ["packages/*"]` |
| `packages/omp/package.json` | Create | `@epistemic/omp` workspace package |
| `packages/omp/tsconfig.json` | Create | TSConfig for the omp package |
| `packages/omp/src/theme/amber-lab.ts` | Create | Amber Lab color token constants |
| `themes/epistemic.json` | Modify | Update hex values to Amber Lab palette |
| `packages/omp/src/layout/ResearchSidebar.ts` | Create | Sidebar widget: reads fleet + stage, returns lines |
| `test/research-sidebar.test.ts` | Create | Unit tests for ResearchSidebar |
| `src/index.ts` | Modify | Wire ResearchSidebar into `before_agent_start` + refresh loop |
| `packages/omp/src/index.ts` | Create | Package entry point, re-exports |

---

## Task 1: npm workspace scaffold

**Files:**
- Modify: `package.json`
- Create: `packages/omp/package.json`
- Create: `packages/omp/tsconfig.json`
- Create: `packages/omp/src/index.ts`

- [ ] **Step 1: Add workspaces to root package.json**

Open `package.json`. Add `"workspaces": ["packages/*"]` after the `"type"` field:

```json
{
  "name": "epistemic",
  "version": "1.0.0",
  "type": "module",
  "workspaces": ["packages/*"],
  ...
}
```

- [ ] **Step 2: Create packages/omp/package.json**

```bash
mkdir -p packages/omp/src/theme packages/omp/src/layout
```

Write `packages/omp/package.json`:

```json
{
  "name": "@epistemic/omp",
  "version": "1.0.0",
  "type": "module",
  "description": "Epistemic TUI shell — forked from oh-my-pi, rethemed for research discipline.",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@earendil-works/pi-tui": "*"
  }
}
```

- [ ] **Step 3: Create packages/omp/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create packages/omp/src/index.ts**

```typescript
export { AMBER_LAB } from "./theme/amber-lab.js";
export { renderResearchSidebar } from "./layout/ResearchSidebar.js";
```

- [ ] **Step 5: Verify npm install sees the workspace**

```bash
npm install
```

Expected: output mentions `packages/omp` as a workspace, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/omp/ package.json package-lock.json
git commit -m "chore: add packages/omp workspace scaffold (@epistemic/omp)"
```

---

## Task 2: Fork oh-my-pi source

**Files:**
- Create: `packages/omp/src/omp-upstream/` (cloned source, read-only reference)

- [ ] **Step 1: Clone oh-my-pi into a temp location**

```bash
git clone https://github.com/can1357/oh-my-pi /tmp/omp-upstream --depth=1
ls /tmp/omp-upstream
```

Expected: see the repo contents (src/, package.json, README.md, etc.)

- [ ] **Step 2: Copy source into packages/omp/**

```bash
cp -r /tmp/omp-upstream/. packages/omp/src/omp-upstream/
```

- [ ] **Step 3: Record the upstream commit SHA**

```bash
git -C /tmp/omp-upstream rev-parse HEAD
```

Add that SHA as a comment at the top of `packages/omp/src/omp-upstream/README.md` (or create the file if absent):

```markdown
<!-- Forked from https://github.com/can1357/oh-my-pi at <SHA> -->
```

- [ ] **Step 4: Commit the upstream snapshot**

```bash
git add packages/omp/src/omp-upstream/
git commit -m "chore: import oh-my-pi upstream snapshot into packages/omp/src/omp-upstream/"
```

---

## Task 3: Amber Lab theme tokens

**Files:**
- Create: `packages/omp/src/theme/amber-lab.ts`
- Modify: `themes/epistemic.json`

- [ ] **Step 1: Write the failing test**

Create `test/amber-lab.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AMBER_LAB } from "../packages/omp/src/theme/amber-lab.js";

describe("AMBER_LAB", () => {
  it("has all required color tokens", () => {
    const required = ["bg", "bgPanel", "border", "primary", "text", "dim", "green", "red", "yellow", "cyan"];
    for (const key of required) {
      assert.ok(key in AMBER_LAB, `missing token: ${key}`);
      assert.match((AMBER_LAB as any)[key], /^#[0-9a-fA-F]{6}$/, `${key} must be a 6-digit hex color`);
    }
  });

  it("primary is amber (warm hue)", () => {
    // #f59e0b — R high, G medium, B low = amber
    assert.strictEqual(AMBER_LAB.primary, "#f59e0b");
  });

  it("bg is near-black dark amber", () => {
    assert.strictEqual(AMBER_LAB.bg, "#0f0a00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern "AMBER_LAB"
```

Expected: FAIL — `Cannot find module '../packages/omp/src/theme/amber-lab.js'`

- [ ] **Step 3: Create packages/omp/src/theme/amber-lab.ts**

```typescript
export const AMBER_LAB = {
  bg:      "#0f0a00",
  bgPanel: "#1a0f00",
  border:  "#2a1a00",
  primary: "#f59e0b",
  text:    "#fbbf24",
  dim:     "#78492a",
  green:   "#34d399",
  red:     "#ef4444",
  yellow:  "#fcd34d",
  cyan:    "#fde68a",
} as const;

export type AmberLabToken = keyof typeof AMBER_LAB;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --test-name-pattern "AMBER_LAB"
```

Expected: PASS

- [ ] **Step 5: Update themes/epistemic.json with Amber Lab hex values**

Replace the `vars` block in `themes/epistemic.json`:

```json
"vars": {
  "bgPanel":      "#1a0f00",
  "border":       "#2a1a00",
  "primary":      "#f59e0b",
  "amber":        "#f59e0b",
  "amberBright":  "#fbbf24",
  "text":         "#fbbf24",
  "gray":         "#78492a",
  "dimGray":      "#4a2e10",
  "darkGray":     "#2a1a00",
  "accent":       "#f59e0b",
  "green":        "#34d399",
  "red":          "#ef4444",
  "yellow":       "#fcd34d",
  "cyan":         "#fde68a",
  "selectedBg":   "#2a1a00",
  "userMsgBg":    "#1a0f00",
  "toolPendingBg":"#1f1200",
  "toolSuccessBg":"#0f1a0a",
  "toolErrorBg":  "#1a0a0a",
  "customMsgBg":  "#1a1000"
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/omp/src/theme/amber-lab.ts test/amber-lab.test.ts themes/epistemic.json
git commit -m "feat: Amber Lab color tokens + update pi theme JSON"
```

---

## Task 4: ResearchSidebar widget

**Files:**
- Create: `packages/omp/src/layout/ResearchSidebar.ts`
- Create: `test/research-sidebar.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/research-sidebar.test.ts`:

```typescript
import { describe, it, before } from "node:test";
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
    "## H-001",
    "- **Claim:** LoRA beats baseline",
    "- **Status:** RUNNING",
    "- **Cost cap:** $100",
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --test-name-pattern "renderResearchSidebar"
```

Expected: FAIL — `Cannot find module '../packages/omp/src/layout/ResearchSidebar.js'`

- [ ] **Step 3: Implement ResearchSidebar.ts**

Create `packages/omp/src/layout/ResearchSidebar.ts`:

```typescript
import { loadFleet } from "../../src/monitor/fleet.js";
import { deriveStage, type StageFacts } from "../../src/state/stage.js";
import { getActiveHypothesis, getHypothesisSpend } from "../../src/state/repo.js";

const SEP = "────────────────────";

function gate(label: string, ok: boolean): string {
  return `${label.padEnd(8)} ${ok ? "✓" : "✗"}`;
}

function costBar(spent: number, cap: number, width = 10): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%`;
}

/** Render the research sidebar lines for the active hypothesis. */
export async function renderResearchSidebar(cwd: string): Promise<string[]> {
  try {
    const fleet = await loadFleet(cwd);
    const active = getActiveHypothesis(fleet.entries);

    if (!active) {
      return [
        "Ξ epistemic",
        SEP,
        "no active hypothesis",
        "describe your idea to begin",
      ];
    }

    const stat = fleet.stats.find(s => s.id === active.id);
    const spent = stat?.spent ?? 0;
    const cap = active.costCap ?? 0;
    const stageNum = fleet.stats.indexOf(stat!) + 1;

    // Derive next action via stage engine
    const facts: StageFacts = {
      active,
      spent,
      hasPrereg:            stat?.hasPrereg ?? false,
      hasJudgeLock:         stat?.hasJudgeLock ?? false,
      hasBaseline:          stat?.hasBaseline ?? false,
      hasSmokes:            stat?.hasSmokes ?? false,
      smokesSimulated:      false,
      hasConfirmedResults:  stat?.inResults ?? false,
    };
    const report = deriveStage(facts);
    const pipelineIdx = ["research-question","preregistration","baseline-reproduction",
      "experiment-execution","statistical-rigor","falsification-review",
      "kill-or-ship","verification-before-publication"].indexOf(report.stage) + 1;

    const title = active.claim.length > 18
      ? active.claim.slice(0, 18) + "…"
      : active.claim;

    return [
      `Ξ ${active.id}  ${title}`,
      `${active.status} · stage ${pipelineIdx}/8`,
      SEP,
      gate("prereg",   facts.hasPrereg),
      gate("judge",    facts.hasJudgeLock),
      gate("baseline", facts.hasBaseline),
      gate("results",  facts.hasConfirmedResults),
      SEP,
      `$${spent.toFixed(0)} / $${cap}`,
      costBar(spent, cap),
      SEP,
      `→ ${report.nextAction.slice(0, 20)}`,
    ];
  } catch {
    return ["Ξ epistemic", "─ sidebar error"];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --test-name-pattern "renderResearchSidebar"
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/omp/src/layout/ResearchSidebar.ts test/research-sidebar.test.ts
git commit -m "feat: ResearchSidebar widget — active hypothesis state in 28-col panel"
```

---

## Task 5: Wire ResearchSidebar into the extension

**Files:**
- Modify: `src/index.ts`

The sidebar is wired as a `belowEditor` widget that refreshes on every `before_agent_start` and on the same timer as the existing epistemic widget. It sits alongside (not replacing) the existing `buildEpistemicWidget` status line.

- [ ] **Step 1: Add the import to src/index.ts**

At the top of `src/index.ts`, after the existing imports, add:

```typescript
import { renderResearchSidebar } from "../packages/omp/src/layout/ResearchSidebar.js";
```

- [ ] **Step 2: Add a refreshSidebar helper after refreshEpistemicWidget calls**

Find the `refreshEpistemicWidget` call inside the `before_agent_start` handler (around line 60–80). After it, add:

```typescript
// Research sidebar — Amber Lab right panel
try {
  const sidebarLines = await renderResearchSidebar(ctx.cwd);
  ctx.ui.setWidget?.("epistemic-sidebar", linesWidget(sidebarLines), { placement: "belowEditor" });
} catch { /* never block the agent on sidebar errors */ }
```

- [ ] **Step 3: Add sidebar refresh inside the refreshTimer interval**

Find the `setInterval` block that calls `refreshEpistemicWidget`. Add the same sidebar refresh inside it:

```typescript
try {
  const sidebarLines = await renderResearchSidebar(ctx.cwd);
  ctx.ui.setWidget?.("epistemic-sidebar", linesWidget(sidebarLines), { placement: "belowEditor" });
} catch {}
```

- [ ] **Step 4: Run existing tests to verify nothing broke**

```bash
npm test
```

Expected: all existing tests still PASS (monitor.test.ts, score.test.ts, stage.test.ts, board.test.ts, panes.test.ts, etc.)

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire ResearchSidebar into extension (belowEditor widget, auto-refresh)"
```

---

## Task 6: Smoke test + final cleanup

**Files:**
- Modify: `README.md` (add packages/omp mention)

- [ ] **Step 1: Run the full test suite**

```bash
npm run verify
```

Expected: typecheck passes, all tests pass.

- [ ] **Step 2: Verify workspace is clean**

```bash
npm ls --workspaces 2>&1 | head -20
```

Expected: `@epistemic/omp@1.0.0` listed, no unmet peer deps errors.

- [ ] **Step 3: Update README.md — add packages/omp to the repo layout**

In `README.md`, after the `## Install` section add:

```markdown
### Repo layout

| Path | What it is |
|------|-----------|
| `packages/omp/` | `@epistemic/omp` — forked oh-my-pi TUI shell (Amber Lab theme, ResearchSidebar) |
| `src/` | Extension wired into omp: gates, commands, monitor, board |
| `skills/` | Claude Code skills (methodology manuals) |
| `hooks/` | Claude Code hooks (SessionStart, prereg gate) |
```

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: note packages/omp in README repo layout"
```

---

## Self-review

**Spec coverage:**
- ✓ Clone oh-my-pi into `packages/omp/` — Task 2
- ✓ Strip pi/earendil branding, rename to `@epistemic/omp` — Task 1 + 2
- ✓ Amber Lab theme tokens — Task 3
- ✓ `themes/epistemic.json` updated — Task 3
- ✓ `ResearchSidebar` widget reads `loadFleet()` + `deriveStage()` — Task 4
- ✓ Wired into `src/index.ts` via `linesWidget` + `setWidget` — Task 5
- ✓ Existing extension not broken — Task 5 step 4
- ✓ npm workspaces — Task 1

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `renderResearchSidebar(cwd: string): Promise<string[]>` used consistently in Tasks 4 and 5. `StageFacts` fields match `src/state/stage.ts` interface exactly (`hasPrereg`, `hasJudgeLock`, `hasBaseline`, `hasSmokes`, `smokesSimulated`, `hasConfirmedResults`). `loadFleet` import path is `../../src/monitor/fleet.js` — matches actual file location relative to `packages/omp/src/layout/`.
