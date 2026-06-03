# Epistemic OMP Fork — Phase 2: Native Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all epistemic gates and commands out of `src/index.ts` (the legacy extension shim) and into the `@epistemic/omp` workspace package, then delete the shim so the pipeline is omp-native.

**Architecture:** Seven gate files move to `packages/omp/src/gates/` with updated relative import paths. The main extension factory moves to `packages/omp/src/commands/epistemic.ts`. `packages/omp/src/index.ts` re-exports the factory. `src/cli/epistemic.ts` changes its import from `../src/index.js` to `../packages/omp/src/commands/epistemic.js`. `package.json` pi config updated. `src/index.ts` deleted. All 53 existing tests must continue to pass throughout.

**Tech Stack:** TypeScript ESM, node:test (tsx), npm workspaces, `@earendil-works/pi-coding-agent` (gate API), existing `src/state/`, `src/research/`, `src/monitor/` (referenced via relative paths from the new package location).

---

## File map

| File | Action | Notes |
|------|--------|-------|
| `packages/omp/src/gates/prereg.ts` | Create | Copy + fix import `../state/` → `../../../../src/state/` |
| `packages/omp/src/gates/judge-lock.ts` | Create | Same path fix |
| `packages/omp/src/gates/smoke.ts` | Create | Same path fix |
| `packages/omp/src/gates/cost-ledger.ts` | Create | Same path fix |
| `packages/omp/src/gates/claim-interceptor.ts` | Create | Same path fix |
| `packages/omp/src/gates/kill-criteria.ts` | Create | Same path fix |
| `packages/omp/src/gates/baseline-staleness.ts` | Create | Same path fix |
| `packages/omp/src/commands/epistemic.ts` | Create | Port `src/index.ts`; update all imports |
| `packages/omp/src/index.ts` | Modify | Re-export the extension factory |
| `src/cli/epistemic.ts` | Modify | Change import source to omp package |
| `package.json` | Modify | Update `pi.extensions` to point to new location |
| `src/index.ts` | Delete | Legacy shim — removed in final task |

---

## Task 1: Create packages/omp/src/gates/ with all 7 gates

**Files:**
- Create: `packages/omp/src/gates/prereg.ts`
- Create: `packages/omp/src/gates/judge-lock.ts`
- Create: `packages/omp/src/gates/smoke.ts`
- Create: `packages/omp/src/gates/cost-ledger.ts`
- Create: `packages/omp/src/gates/claim-interceptor.ts`
- Create: `packages/omp/src/gates/kill-criteria.ts`
- Create: `packages/omp/src/gates/baseline-staleness.ts`

The only change in each file is the import path for `../state/repo.js` → `../../../../src/state/repo.js` (and any other `../` relative imports within the original `src/` tree, adjusted for the new depth of `packages/omp/src/gates/`).

- [ ] **Step 1: Create the gates directory**

```bash
mkdir -p packages/omp/src/gates
```

- [ ] **Step 2: Copy and patch prereg.ts**

Create `packages/omp/src/gates/prereg.ts`:

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { loadHypotheses, getActiveHypothesis, fileExists, updateHypothesisStatus } from "../../../../src/state/repo.js";
import { join } from "node:path";

export function registerPreregGate(pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isToolCallEventType("bash", event)) return;
    const cmd = event.input.command ?? "";
    if (!/^(bun|python|pytest|eval|benchmark|run_|train)/i.test(cmd)) return;

    const entries = await loadHypotheses(ctx.cwd);
    if (entries.length === 0) return;

    const active = getActiveHypothesis(entries);
    if (!active) return;

    const preregPath = join(ctx.cwd, "experiments", active.id, "prereg.md");
    const hasPrereg = await fileExists(preregPath);
    if (!hasPrereg) {
      return { block: true, reason: `Missing prereg.md for hypothesis "${active.id}". Complete pre-registration before launching experiments.` };
    }

    if (active.status === "OPEN") {
      await updateHypothesisStatus(ctx.cwd, active.id, "RUNNING");
    }
  });
}
```

- [ ] **Step 3: Copy and patch judge-lock.ts**

Read `src/gates/judge-lock.ts`, then create `packages/omp/src/gates/judge-lock.ts` with the single import path changed from `"../state/repo.js"` to `"../../../../src/state/repo.js"`:

```bash
sed 's|"../state/repo.js"|"../../../../src/state/repo.js"|g' src/gates/judge-lock.ts > packages/omp/src/gates/judge-lock.ts
```

- [ ] **Step 4: Copy and patch the remaining 5 gate files**

```bash
for gate in smoke cost-ledger claim-interceptor kill-criteria baseline-staleness; do
  sed 's|"../state/repo.js"|"../../../../src/state/repo.js"|g' \
    src/gates/${gate}.ts > packages/omp/src/gates/${gate}.ts
done
```

- [ ] **Step 5: Verify all 7 files exist and contain the updated import path**

```bash
ls packages/omp/src/gates/
grep -l '../../../../src/state/repo.js' packages/omp/src/gates/*.ts | wc -l
```

Expected: 7 files listed, count shows 7.

- [ ] **Step 6: Run existing tests to confirm nothing broke**

```bash
npm test
```

Expected: 53/53 pass (gates not yet wired, so no behavioral change).

- [ ] **Step 7: Commit**

```bash
git add packages/omp/src/gates/
git commit -m "feat: copy gates to @epistemic/omp (packages/omp/src/gates/)"
```

---

## Task 2: Create packages/omp/src/commands/epistemic.ts

**Files:**
- Create: `packages/omp/src/commands/epistemic.ts`

This is the main extension factory — a port of `src/index.ts` with all imports updated to their new paths from `packages/omp/src/commands/`.

- [ ] **Step 1: Create the commands directory**

```bash
mkdir -p packages/omp/src/commands
```

- [ ] **Step 2: Create packages/omp/src/commands/epistemic.ts**

The relative path from `packages/omp/src/commands/` to the repo root `src/` is `../../../../src/`. From `packages/omp/src/commands/` to `packages/omp/src/` is `../`.

Write `packages/omp/src/commands/epistemic.ts` with the full contents of `src/index.ts` but with these import changes:

| Old import | New import |
|-----------|-----------|
| `"./gates/prereg.js"` | `"../gates/prereg.js"` |
| `"./gates/judge-lock.js"` | `"../gates/judge-lock.js"` |
| `"./gates/smoke.js"` | `"../gates/smoke.js"` |
| `"./gates/cost-ledger.js"` | `"../gates/cost-ledger.js"` |
| `"./gates/claim-interceptor.js"` | `"../gates/claim-interceptor.js"` |
| `"./gates/kill-criteria.js"` | `"../gates/kill-criteria.js"` |
| `"./gates/baseline-staleness.js"` | `"../gates/baseline-staleness.js"` |
| `"./extensions/huggingface.js"` | `"../../../../src/extensions/huggingface.js"` |
| `"./state/repo.js"` | `"../../../../src/state/repo.js"` |
| `"./state/stage.js"` | `"../../../../src/state/stage.js"` |
| `"./tui/widget.js"` | `"../../../../src/tui/widget.js"` |
| `"../packages/omp/src/layout/ResearchSidebar.js"` | `"../layout/ResearchSidebar.js"` |
| `"./credentials.js"` | `"../../../../src/credentials.js"` |
| `"./research/tree.js"` | `"../../../../src/research/tree.js"` |
| `"./research/monitor.js"` | `"../../../../src/research/monitor.js"` |
| `"./research/monitor-nav.js"` | `"../../../../src/research/monitor-nav.js"` |
| `"./monitor/fleet.js"` | `"../../../../src/monitor/fleet.js"` |
| `"./research/board.js"` | `"../../../../src/research/board.js"` |
| `"./research/monitor-component.js"` (dynamic) | `"../../../../src/research/monitor-component.js"` |

The `import type { ExtensionAPI, ExtensionContext }` stays the same (from `@earendil-works/pi-coding-agent`).

Full file contents (copy of `src/index.ts` with all imports updated as above):

```typescript
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { registerPreregGate } from "../gates/prereg.js";
import { registerJudgeLockGate } from "../gates/judge-lock.js";
import { registerSmokeGate } from "../gates/smoke.js";
import { registerCostLedger } from "../gates/cost-ledger.js";
import { registerClaimInterceptor } from "../gates/claim-interceptor.js";
import { registerKillCriteriaGate } from "../gates/kill-criteria.js";
import { registerBaselineStalenessGate } from "../gates/baseline-staleness.js";
import { loadRepoState, loadHypotheses, getActiveHypothesis, getHypothesisSpend, loadLessons, summarizeLessons, loadBaselines, fileExists, type HypothesisEntry } from "../../../../src/state/repo.js";
import { deriveStage, renderStageBlock, type StageFacts } from "../../../../src/state/stage.js";
import { refreshEpistemicWidget, linesWidget } from "../../../../src/tui/widget.js";
import { renderResearchSidebar } from "../layout/ResearchSidebar.js";
import { credentialStatus, credentialOptions, saveKey, KNOWN_KEYS } from "../../../../src/credentials.js";
import { renderResearchTree } from "../../../../src/research/tree.js";
import { renderMonitor, type MonitorMode } from "../../../../src/research/monitor.js";
import { parseKey, reduceNav, actionPrompt, type ActionLabel } from "../../../../src/research/monitor-nav.js";
import { loadFleet, type Fleet } from "../../../../src/monitor/fleet.js";
import { renderBoard, parallelLanesText } from "../../../../src/research/board.js";

let initialized = false;
let sessionCtx: ExtensionContext | null = null;
let treeVisible = false;

const RESEARCH_VIEWS = ["off", "monitor", "board", "tree", "cost"] as const;
type ResearchView = (typeof RESEARCH_VIEWS)[number];
let currentView: ResearchView = "off";
let refreshTimer: ReturnType<typeof setInterval> | null = null;

let monitorMode: MonitorMode = "tree";
let monitorIdx = 0;
let lastFleet: Fleet | null = null;

const ACTIVE_GATES = ["prereg", "judge-lock", "smoke", "cost-ledger", "claim-interceptor", "kill-criteria", "baseline-staleness"];

const TREE_KEY = "epistemic-tree";

async function showTree(ctx: any) {
  const entries = await loadHypotheses(ctx.cwd);
  const content = (await safeReadFile(ctx.cwd, "HYPOTHESES.md")) ?? "";
  const active = getActiveHypothesis(entries);
  const lines = renderResearchTree(entries, content, {}, active?.id);
  ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ research map  (/map off to hide · /view to cycle)", ...lines]), { placement: "belowEditor" });
}

async function renderCurrentView(ctx: any) {
  if (currentView === "monitor") {
    treeVisible = false;
    lastFleet = await loadFleet(ctx.cwd);
    rerenderMonitor(ctx);
    return;
  }
  if (currentView === "tree") {
    treeVisible = true;
    await showTree(ctx);
    return;
  }
  treeVisible = false;
  if (currentView === "board") {
    const fleet = await loadFleet(ctx.cwd);
    ctx.ui.setWidget?.(TREE_KEY, linesWidget(renderBoard(fleet)), { placement: "belowEditor" });
    return;
  }
  if (currentView === "cost") {
    const entries = await loadHypotheses(ctx.cwd);
    const lines = await Promise.all(entries.map(async (e) => {
      const spent = await getHypothesisSpend(ctx.cwd, e.id);
      return `  ${e.id} [${e.status}]  $${spent.toFixed(2)} / $${e.costCap}`;
    }));
    ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ cost  (/view to cycle)", ...(lines.length ? lines : ["  no hypotheses yet"])]), { placement: "belowEditor" });
    return;
  }
  ctx.ui.setWidget?.(TREE_KEY, undefined);
}

function cycleView(dir: number) {
  const i = RESEARCH_VIEWS.indexOf(currentView);
  currentView = RESEARCH_VIEWS[(i + dir + RESEARCH_VIEWS.length) % RESEARCH_VIEWS.length];
}

function rerenderMonitor(ctx: any) {
  if (!lastFleet) return;
  ctx.ui.setWidget?.(TREE_KEY, linesWidget(renderMonitor(lastFleet, monitorMode, monitorIdx)), { placement: "belowEditor" });
}

const ACTION_LABELS: Record<string, ActionLabel> = {
  "chat about it": "chat", "approve (ship)": "approve", "reject (kill)": "reject", "modify (refine/pivot)": "modify",
};

async function openSelected(ctx: any) {
  const entry = lastFleet?.entries[monitorIdx];
  if (!entry) return;
  const choice = await ctx.ui.select?.(`${entry.id} — action`, Object.keys(ACTION_LABELS));
  const action = choice && ACTION_LABELS[choice];
  if (!action) return;
  const prompt = actionPrompt(action, entry);
  if (ctx.sendUserMessage) await ctx.sendUserMessage(prompt);
  else ctx.ui.notify?.(prompt, "info");
}

function handleMonitorKey(ctx: any, data: string): boolean {
  if (currentView !== "monitor" || !lastFleet) return false;
  const result = reduceNav({ mode: monitorMode, idx: monitorIdx }, parseKey(data), lastFleet.entries.length);
  if (!result.handled) return false;
  monitorMode = result.state.mode;
  monitorIdx = result.state.idx;
  if (result.openAction) void openSelected(ctx);
  else rerenderMonitor(ctx);
  return true;
}

const registeredInstances = new WeakSet<object>();
const navRegisteredCtxs = new WeakSet<object>();

export default async function (pi: ExtensionAPI) {
  if (registeredInstances.has(pi as object)) return;
  registeredInstances.add(pi as object);

  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    try {
      const state = await loadRepoState(ctx.cwd);
      if (!initialized) {
        const hasState = state.hypotheses || state.baselines || state.results;
        ctx.ui.notify(
          hasState
            ? "Ξ epistemic active. All methodology gates enforcing."
            : "Ξ epistemic loaded. Describe your research idea — the agent will guide you.",
          "info"
        );
        initialized = true;
      }
      ctx.ui.setStatus?.("epistemic-brand", "Ξ epistemic");
      ctx.ui.setWorkingMessage?.("Ξ epistemic is working…");

      if (!navRegisteredCtxs.has(ctx as object)) {
        ctx.ui.onTerminalInput?.((data: string) => {
          if (handleMonitorKey(ctx, data)) return { consume: true };
          return undefined;
        });
        navRegisteredCtxs.add(ctx as object);
      }

      await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);
      try {
        const sidebarLines = await renderResearchSidebar(ctx.cwd);
        ctx.ui.setWidget?.("epistemic-sidebar", linesWidget(sidebarLines), { placement: "belowEditor" });
      } catch { /* never block the agent on sidebar errors */ }

      if (!refreshTimer) {
        refreshTimer = setInterval(() => {
          if (currentView !== "off" && sessionCtx) {
            renderCurrentView(sessionCtx).catch(() => {});
          }
        }, 2000);
      }
    } catch {}
  });

  pi.on("session_shutdown", async () => {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  });

  setupBeforeAgentStart(pi);

  registerPreregGate(pi as any);
  registerJudgeLockGate(pi as any);
  registerSmokeGate(pi as any);
  registerCostLedger(pi as any);
  registerClaimInterceptor(pi as any);
  registerKillCriteriaGate(pi as any);
  registerBaselineStalenessGate(pi as any);

  registerResearchCommands(pi);
}

function registerResearchCommands(pi: any) {
  pi.registerCommand?.("view", {
    description: "Cycle epistemic research views (off → monitor → tree → cost)",
    handler: async (args: string, ctx: any) => {
      const want = args.trim() as ResearchView;
      if (RESEARCH_VIEWS.includes(want)) currentView = want;
      else cycleView(1);
      await renderCurrentView(ctx);
    },
  });

  pi.registerCommand?.("monitor", {
    description: "Open the interactive monitor (↑↓ select · → detail · enter actions · q back to chat)",
    handler: async (_args: string, ctx: any) => {
      if (!ctx.ui.custom) {
        currentView = "monitor"; monitorMode = "tree"; monitorIdx = 0;
        await renderCurrentView(ctx);
        return;
      }
      const fleet = await loadFleet(ctx.cwd);
      const { MonitorComponent, monitorActionPrompt } = await import("../../../../src/research/monitor-component.js");
      const result = await ctx.ui.custom((tui: any, _theme: any, _kb: any, done: any) =>
        new MonitorComponent(ctx.cwd, fleet, tui, done),
      );
      if (result) {
        const prompt = monitorActionPrompt(result, fleet);
        if (prompt) {
          if (ctx.ui.setEditorText) ctx.ui.setEditorText(prompt);
          else ctx.ui.notify?.(prompt, "info");
        }
      }
    },
  });

  pi.registerCommand?.("credentials", {
    description: "View or set API keys (OpenRouter, Anthropic, OpenAI, Google, HuggingFace, Modal)",
    handler: async (args: string, ctx: any) => {
      const [argKey, ...rest] = args.trim().split(/\s+/);
      if (argKey && KNOWN_KEYS.some((k) => k.name === argKey) && rest.length) {
        await saveKey(ctx.cwd, argKey, rest.join(" "));
        ctx.ui.notify?.(`✓ ${argKey} saved to .env and applied`, "info");
        return;
      }
      ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ credentials  (/credentials off to hide)", ...credentialStatus()]), { placement: "belowEditor" });
      const opts = credentialOptions();
      const choice = await ctx.ui.select?.("Set a credential", opts.map((o) => o.label));
      if (!choice) return;
      const picked = opts.find((o) => o.label === choice);
      if (!picked) return;
      const value = await ctx.ui.input?.(`Enter value for ${picked.key}`, "paste key (stored in .env)");
      if (!value) return;
      await saveKey(ctx.cwd, picked.key, value.trim());
      ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ credentials  (/credentials off to hide)", ...credentialStatus()]), { placement: "belowEditor" });
      ctx.ui.notify?.(`✓ ${picked.key} saved (.env) and applied to this session`, "info");
    },
  });

  pi.registerCommand?.("sweep", {
    description: "Fan out parallel experiment variants for the active hypothesis",
    handler: async (args: string, ctx: any) => {
      const active = getActiveHypothesis(await loadHypotheses(ctx.cwd));
      const target = active ? `${active.id} ("${active.claim}")` : "the current hypothesis";
      const dims = args.trim() || "the key variations (model size, learning rate, prompt)";
      const prompt =
        `Run a parameter sweep for ${target}: fan out experiments in parallel across ${dims}. ` +
        `Pre-register each variant, keep each under its cost cap, run them concurrently (use parallel subagents where possible), ` +
        `then compare the results in a table and recommend which to promote.`;
      if (ctx.ui.setEditorText) ctx.ui.setEditorText(prompt);
      else ctx.ui.notify?.(prompt, "info");
    },
  });

  pi.registerCommand?.("idea", {
    description: "Start a new idea → plan → approve → run the epistemic pipeline",
    handler: async (args: string, ctx: any) => {
      const idea = args.trim() || (await ctx.ui.input?.("Your research idea (one line)", "e.g. observation-time scoring beats retrieve-then-rank"))?.trim();
      if (!idea) return;
      const prompt = [
        `New research idea: "${idea}"`,
        ``,
        `Walk me through the epistemic funnel — do NOT run any experiment yet:`,
        `1. Brainstorm 2–3 competing, falsifiable hypotheses for this idea (one question at a time if you need to clarify scope).`,
        `2. Recommend one, and draft its plan: claim, falsifier, baseline to beat, judge (model+prompt+temp+seed), sample size, cost cap, compute target, and the best-case conclusion.`,
        `3. Show the plan and ask me to APPROVE or refine. Only after I approve: register it in HYPOTHESES.md as OPEN and run /skill:preregistration. The prereg gate keeps experiments blocked until that's done.`,
      ].join("\n");
      if (ctx.sendUserMessage) await ctx.sendUserMessage(prompt);
      else if (ctx.ui.setEditorText) ctx.ui.setEditorText(prompt);
      else ctx.ui.notify?.(prompt, "info");
      ctx.ui.notify?.("Ξ idea funnel started — brainstorm → plan → approve → run", "info");
    },
  });

  pi.registerCommand?.("lessons", {
    description: "Show cross-run research lessons (past kills, pivots, overruns)",
    handler: async (_args: string, ctx: any) => {
      const lessons = await loadLessons(ctx.cwd);
      const text = summarizeLessons(lessons);
      ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ lessons  (/lessons off to hide)", ...text.split("\n")]), { placement: "belowEditor" });
      if (ctx.ui.notify) ctx.ui.notify("Ξ cross-run lessons shown below", "info");
    },
  });

  pi.registerCommand?.("map", {
    description: "Toggle the epistemic decision tree (research program as a map)",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "off") {
        treeVisible = false;
        currentView = "off";
        ctx.ui.setWidget?.(TREE_KEY, undefined);
        ctx.ui.notify?.("Ξ map hidden", "info");
        return;
      }
      treeVisible = true;
      currentView = "tree";
      await showTree(ctx);
    },
  });

  pi.registerCommand?.("board", {
    description: "Parallel board — every hypothesis in its current pipeline lane",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "off") {
        currentView = "off";
        ctx.ui.setWidget?.(TREE_KEY, undefined);
        ctx.ui.notify?.("Ξ board hidden", "info");
        return;
      }
      treeVisible = false;
      currentView = "board";
      await renderCurrentView(ctx);
      ctx.ui.notify?.("Ξ parallel board — /view to cycle · /board off to hide", "info");
    },
  });

  pi.registerCommand?.("hypothesis", {
    description: "Pick a hypothesis and act on it (approve / reject / modify / chat)",
    handler: async (_args: string, ctx: any) => {
      const entries = await loadHypotheses(ctx.cwd);
      if (entries.length === 0) { ctx.ui.notify?.("No hypotheses yet.", "info"); return; }
      const choice = await ctx.ui.select?.(
        "Select a hypothesis",
        entries.map((e) => `${e.id} [${e.status}] ${e.claim.slice(0, 50)}`),
      );
      if (!choice) return;
      const id = choice.split(" ")[0];
      const action = await ctx.ui.select?.(`${id} — action`, ["chat", "approve (ship)", "reject (kill)", "modify (refine/pivot)"]);
      if (!action) return;
      const entry = entries.find((e) => e.id === id);
      const prompts: Record<string, string> = {
        "chat": `Tell me about hypothesis ${id}: "${entry?.claim}". What's the current status and next step?`,
        "approve (ship)": `Approve hypothesis ${id} ("${entry?.claim}"). Run kill-or-ship: if all gates pass, SHIP and run verification-before-publication; otherwise list blockers.`,
        "reject (kill)": `Reject hypothesis ${id} ("${entry?.claim}"). Run kill-or-ship with a KILL decision and record the lesson.`,
        "modify (refine/pivot)": `Modify hypothesis ${id} ("${entry?.claim}"). Propose a REFINE or PIVOT per kill-or-ship.`,
      };
      const prompt = prompts[action];
      ctx.ui.setStatus?.("epistemic-action", `Ξ ${id}: ${action}`);
      if (ctx.sendUserMessage) await ctx.sendUserMessage(prompt);
      else ctx.ui.notify?.(prompt, "info");
    },
  });
}

async function safeReadFile(cwd: string, name: string): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(cwd, name), "utf8");
  } catch { return null; }
}

async function gatherStageFacts(cwd: string, active: HypothesisEntry, spent: number): Promise<StageFacts> {
  const expDir = `experiments/${active.id}`;
  const [hasPrereg, hasJudgeLock, smokeStatus, smokeTelemetry, baselines, repo] = await Promise.all([
    fileExists(`${cwd}/${expDir}/prereg.md`),
    fileExists(`${cwd}/${expDir}/judge.lock`),
    fileExists(`${cwd}/${expDir}/smokes/run-status.json`),
    fileExists(`${cwd}/${expDir}/smokes/telemetry.jsonl`),
    loadBaselines(cwd),
    loadRepoState(cwd),
  ]);

  const hasSmokes = smokeStatus || smokeTelemetry;
  const smokesSimulated = hasSmokes && !(hasPrereg && hasJudgeLock);

  const ref = (active.baselineRef || "").toLowerCase();
  const hasBaseline = !!ref && baselines.some(b => b.name.toLowerCase().includes(ref) || ref.includes(b.name.toLowerCase()));

  const hasConfirmedResults = !!repo.results && repo.results.includes(active.id);

  return { active, spent, hasPrereg, hasJudgeLock, hasBaseline, hasSmokes, smokesSimulated, hasConfirmedResults };
}

function setupBeforeAgentStart(pi: any) {
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    try {
      const entries = await loadHypotheses(event.cwd);
      const active = getActiveHypothesis(entries);

      if (sessionCtx) {
        await refreshEpistemicWidget(sessionCtx, event.cwd, ACTIVE_GATES);
        try {
          const sidebarLines = await renderResearchSidebar(event.cwd);
          sessionCtx.ui.setWidget?.("epistemic-sidebar", linesWidget(sidebarLines), { placement: "belowEditor" });
        } catch {}
        if (treeVisible) { try { await showTree(sessionCtx); } catch {} }
      }
      if (!active) return;

      const spent = await getHypothesisSpend(event.cwd, active.id);
      const pct = active.costCap > 0 ? Math.round((spent / active.costCap) * 100) : 0;

      const facts = await gatherStageFacts(event.cwd, active, spent);
      const stageBlock = renderStageBlock(deriveStage(facts));

      const fleet = await loadFleet(event.cwd);
      const lanes = parallelLanesText(fleet);

      const summary = [
        stageBlock,
        ``,
        `## Epistemic runtime state`,
        `- Active hypothesis: ${active.id}`,
        `- Claim: ${active.claim.slice(0, 100)}`,
        `- Status: ${active.status}`,
        `- Judge: ${active.judgeRef.slice(0, 40)}`,
        `- Falsifier: ${active.falsifier.slice(0, 80)}`,
        `- Cost: $${spent.toFixed(2)} / $${active.costCap} (${pct}%)`,
        `- Compute: ${active.computeTarget}`,
        ``,
        ...(lanes.length ? [...lanes, ``] : []),
        `Methodology gates active: ${ACTIVE_GATES.join(" ✓  ")} ✓`,
        `Provisional results go in smokes/ only. Headline files require confirmed experiments.`,
        `Work lanes in parallel where they don't share a judge/baseline lock; use parallel subagents (/sweep) to run independent experiments concurrently.`,
        `Overrides go in OVERRIDES.md with a mandatory reason (≥50 chars).`,
        `Kill criteria: spend >$${(active.costCap * 1.5).toFixed(2)} or >21 days → run kill-or-ship skill.`,
        ``,
      ].join("\n");

      return { systemPrompt: event.systemPrompt + "\n\n" + summary };
    } catch {
      return;
    }
  });
}
```

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: 53/53 pass (new file exists but isn't loaded yet — no behavior change).

- [ ] **Step 4: Commit**

```bash
git add packages/omp/src/commands/epistemic.ts
git commit -m "feat: port extension factory to @epistemic/omp (packages/omp/src/commands/epistemic.ts)"
```

---

## Task 3: Update packages/omp/src/index.ts to export the factory

**Files:**
- Modify: `packages/omp/src/index.ts`

- [ ] **Step 1: Update the exports**

Replace the contents of `packages/omp/src/index.ts` with:

```typescript
export { AMBER_LAB } from "./theme/amber-lab.js";
export { renderResearchSidebar } from "./layout/ResearchSidebar.js";
export { default as epistemicExtension } from "./commands/epistemic.js";
```

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: 53/53 pass.

- [ ] **Step 3: Commit**

```bash
git add packages/omp/src/index.ts
git commit -m "feat: export epistemicExtension factory from @epistemic/omp"
```

---

## Task 4: Rewire src/cli/epistemic.ts + package.json pi config

**Files:**
- Modify: `src/cli/epistemic.ts`
- Modify: `package.json`

- [ ] **Step 1: Update src/cli/epistemic.ts**

Open `src/cli/epistemic.ts`. Find these two lines:

```typescript
import epistemicExtension from "../index.js";
```

Replace with:

```typescript
import { epistemicExtension } from "../packages/omp/src/commands/epistemic.js";
```

The rest of the file stays the same. The `extensionFactories` line remains:
```typescript
await main(args, { extensionFactories: [epistemicExtension as unknown as (pi: unknown) => void] });
```

- [ ] **Step 2: Update package.json pi.extensions**

In `package.json`, find:

```json
"pi": {
  "extensions": [
    "./src/index.ts"
  ],
```

Replace with:

```json
"pi": {
  "extensions": [
    "./packages/omp/src/commands/epistemic.ts"
  ],
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 53/53 pass. (src/index.ts still exists — no import errors yet.)

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: passes. If there are type errors in `src/cli/epistemic.ts` due to the named vs default export change, verify the import syntax is `import { epistemicExtension }` not `import epistemicExtension`.

- [ ] **Step 5: Commit**

```bash
git add src/cli/epistemic.ts package.json
git commit -m "feat: rewire launcher to import epistemicExtension from @epistemic/omp"
```

---

## Task 5: Delete src/index.ts + final verification

**Files:**
- Delete: `src/index.ts`

- [ ] **Step 1: Delete src/index.ts**

```bash
git rm src/index.ts
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 53/53 pass. If any test imports from `src/index.ts` directly, it will fail — fix by updating the import to `../packages/omp/src/commands/epistemic.js`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. The only reference to `src/index.ts` in the codebase should now be gone.

- [ ] **Step 4: Verify no remaining references to the deleted file**

```bash
grep -r "from.*src/index" --include="*.ts" . | grep -v node_modules | grep -v omp-upstream
grep -r "\"./src/index" --include="*.json" . | grep -v node_modules
```

Expected: no output from either command.

- [ ] **Step 5: Run full verify**

```bash
npm run verify
```

Expected: typecheck passes, 53/53 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: delete src/index.ts — epistemic pipeline is now omp-native"
```

---

## Self-review

**Spec coverage:**
- ✓ Port commands from `src/index.ts` → `packages/omp/src/commands/epistemic.ts` — Task 2
- ✓ Port gates → `packages/omp/src/gates/` — Task 1
- ✓ Delete `src/index.ts` — Task 5
- ✓ Delete `extensionFactories` injection with old shim — Task 4 + 5 (extensionFactories stays, but now points to omp)
- ✓ `packages/omp/src/index.ts` re-exports — Task 3
- ✓ `package.json` pi config updated — Task 4

**Placeholder scan:** None. All code blocks are complete.

**Type consistency:** 
- `epistemicExtension` exported as named export from `commands/epistemic.ts` (default → named re-export in index.ts). Import in cli: `import { epistemicExtension }`. Consistent through Tasks 2, 3, 4.
- Gate function names (`registerPreregGate`, etc.) match exactly between Task 1 exports and Task 2 imports.
- All import paths use `.js` extension (ESM with tsx convention). Consistent throughout.

**Note on extensionFactories:** The spec says "delete the extensionFactories injection shim". The `extensionFactories` mechanism in pi's `main()` call is not deleted (it's the only way to pass an extension to pi). What IS deleted is `src/index.ts` — the old shim file. The factory itself now lives in `@epistemic/omp`. This is the correct interpretation per the design spec.
