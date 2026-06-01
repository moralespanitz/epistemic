import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { registerPreregGate } from "./gates/prereg.js";
import { registerJudgeLockGate } from "./gates/judge-lock.js";
import { registerSmokeGate } from "./gates/smoke.js";
import { registerCostLedger } from "./gates/cost-ledger.js";
import { registerClaimInterceptor } from "./gates/claim-interceptor.js";
import { registerKillCriteriaGate } from "./gates/kill-criteria.js";
import { registerBaselineStalenessGate } from "./gates/baseline-staleness.js";
import { registerHuggingFaceTools } from "./extensions/huggingface.js";
import { loadRepoState, loadHypotheses, getActiveHypothesis, getHypothesisSpend, loadLessons, summarizeLessons } from "./state/repo.js";
import { refreshEpistemicWidget, fitWidth } from "./tui/widget.js";
import { renderResearchTree } from "./research/tree.js";
import { renderMonitor, type MonitorMode } from "./research/monitor.js";
import { parseKey, reduceNav, actionPrompt, type ActionLabel } from "./research/monitor-nav.js";
import { loadFleet, type Fleet } from "./monitor/fleet.js";

let initialized = false;
let sessionCtx: ExtensionContext | null = null;
let treeVisible = false; // whether the /tree widget is currently shown

// Research views cycled by /view. "monitor" is the interactive dashboard.
const RESEARCH_VIEWS = ["off", "monitor", "tree", "cost"] as const;
type ResearchView = (typeof RESEARCH_VIEWS)[number];
let currentView: ResearchView = "off";
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// Interactive monitor-mode navigation state.
let monitorMode: MonitorMode = "tree";
let monitorIdx = 0;
let lastFleet: Fleet | null = null;
let navRegistered = false;

const ACTIVE_GATES = ["prereg", "judge-lock", "smoke", "cost-ledger", "claim-interceptor", "kill-criteria", "baseline-staleness"];

const TREE_KEY = "epistemic-tree";

/** Render the decision-tree widget into omp's UI (below the editor). */
async function showTree(ctx: any) {
  const entries = await loadHypotheses(ctx.cwd);
  const content = (await safeReadFile(ctx.cwd, "HYPOTHESES.md")) ?? "";
  const active = getActiveHypothesis(entries);
  const lines = renderResearchTree(entries, content, {}, active?.id);
  ctx.ui.setWidget?.(TREE_KEY, fitWidth(["Ξ research map  (/map off to hide · /view to cycle)", ...lines]), { placement: "belowEditor" });
}

/** Render whichever research view is active (or clear it). Used by /view + the shortcut. */
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
  if (currentView === "cost") {
    const entries = await loadHypotheses(ctx.cwd);
    const lines = await Promise.all(entries.map(async (e) => {
      const spent = await getHypothesisSpend(ctx.cwd, e.id);
      return `  ${e.id} [${e.status}]  $${spent.toFixed(2)} / $${e.costCap}`;
    }));
    ctx.ui.setWidget?.(TREE_KEY, fitWidth(["Ξ cost  (/view to cycle)", ...(lines.length ? lines : ["  no hypotheses yet"])]), { placement: "belowEditor" });
    return;
  }
  ctx.ui.setWidget?.(TREE_KEY, undefined); // "off"
}

function cycleView(dir: number) {
  const i = RESEARCH_VIEWS.indexOf(currentView);
  currentView = RESEARCH_VIEWS[(i + dir + RESEARCH_VIEWS.length) % RESEARCH_VIEWS.length];
}

/** Re-render the interactive monitor widget from the cached fleet. */
function rerenderMonitor(ctx: any) {
  if (!lastFleet) return;
  ctx.ui.setWidget?.(TREE_KEY, fitWidth(renderMonitor(lastFleet, monitorMode, monitorIdx)), { placement: "belowEditor" });
}

const ACTION_LABELS: Record<string, ActionLabel> = {
  "chat about it": "chat", "approve (ship)": "approve", "reject (kill)": "reject", "modify (refine/pivot)": "modify",
};

/** Open the action menu for the selected hypothesis (chat / approve / reject / modify). */
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

/** Arrow-key navigation while monitor mode is active. Returns true if consumed. */
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

export default async function (pi: ExtensionAPI) {
  // Load exactly once. The launcher injects this extension (so it works from any
  // directory), and a research repo's .pi/settings.json also discovers it — the
  // process-wide guard prevents double-registration (which would conflict).
  if ((globalThis as any).__epistemicLoaded) return;
  (globalThis as any).__epistemicLoaded = true;

  // ─── Session start ───────────────────────────────────────────
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
      // Brand the footer + working indicator as epistemic (the startup banner
      // still says "pi" — that's internal to the framework; full rename = fork).
      ctx.ui.setStatus?.("epistemic-brand", "Ξ epistemic");
      ctx.ui.setWorkingMessage?.("Ξ epistemic is working…");

      // Capture arrow keys for interactive monitor-mode navigation. Only acts
      // when /monitor is open; otherwise passes input straight to the editor.
      if (!navRegistered) {
        ctx.ui.onTerminalInput?.((data: string) => {
          if (handleMonitorKey(ctx, data)) return { consume: true };
          return undefined;
        });
        navRegistered = true;
      }

      await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);

      // Live refresh: while a research view is open, keep it current even when
      // idle — like a real dashboard.
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

  // ─── State injection into system prompt ─────────────────────
  setupBeforeAgentStart(pi);

  // ─── Gates ────────────────────────────────────────────────────
  registerPreregGate(pi as any);
  registerJudgeLockGate(pi as any);
  registerSmokeGate(pi as any);
  registerCostLedger(pi as any);
  registerClaimInterceptor(pi as any);
  registerKillCriteriaGate(pi as any);
  registerBaselineStalenessGate(pi as any);

  // ─── Tools ────────────────────────────────────────────────────
  registerHuggingFaceTools(pi);

  // ─── Spatial research views (inside real omp) ─────────────────
  registerResearchCommands(pi);
}

/**
 * Register slash commands that add the spatial research experience INSIDE omp.
 * This keeps epistemic as "pi.dev + extensions" — the real omp chat, plus a
 * live decision-tree widget and a hypothesis action menu.
 */
function registerResearchCommands(pi: any) {
  // View-switching is via the /view command. We intentionally register NO
  // keyboard shortcut: pi reserves nearly every modifier+key for its editor
  // (emacs bindings) and tree navigation, so any global shortcut either
  // conflicts or silently breaks an expected key.
  pi.registerCommand?.("view", {
    description: "Cycle epistemic research views (off → monitor → tree → cost)",
    handler: async (args: string, ctx: any) => {
      const want = args.trim() as ResearchView;
      if (RESEARCH_VIEWS.includes(want)) currentView = want;
      else cycleView(1);
      await renderCurrentView(ctx);
    },
  });

  // /monitor — full interactive monitor that TAKES OVER the view (ctx.ui.custom),
  // then returns to pi's real chat. Full height, native arrow nav, no truncation.
  pi.registerCommand?.("monitor", {
    description: "Open the interactive monitor (↑↓ select · → detail · enter actions · q back to chat)",
    handler: async (_args: string, ctx: any) => {
      if (!ctx.ui.custom) {
        currentView = "monitor"; monitorMode = "tree"; monitorIdx = 0;
        await renderCurrentView(ctx);
        return;
      }
      const fleet = await loadFleet(ctx.cwd);
      const { MonitorComponent, monitorActionPrompt } = await import("./research/monitor-component.js");
      const result = await ctx.ui.custom((tui: any, _theme: any, _kb: any, done: any) =>
        new MonitorComponent(ctx.cwd, fleet, tui, done),
      );
      if (result) {
        const prompt = monitorActionPrompt(result, fleet);
        if (prompt) {
          if (ctx.ui.setEditorText) ctx.ui.setEditorText(prompt); // prefill chat for review
          else ctx.ui.notify?.(prompt, "info");
        }
      }
    },
  });

  // /sweep — fan out experiment variants in parallel (omp's parallel-subagents
  // signature, applied to research). Prefills a structured instruction for review.
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

  // /lessons — cross-run memory (every kill/pivot/overrun, surfaced for reuse).
  // Inspired by omp's persistent memory; epistemic-native via .epistemic/lessons.jsonl.
  pi.registerCommand?.("lessons", {
    description: "Show cross-run research lessons (past kills, pivots, overruns)",
    handler: async (_args: string, ctx: any) => {
      const lessons = await loadLessons(ctx.cwd);
      const text = summarizeLessons(lessons);
      ctx.ui.setWidget?.(TREE_KEY, fitWidth(["Ξ lessons  (/lessons off to hide)", ...text.split("\n")]), { placement: "belowEditor" });
      if (ctx.ui.notify) ctx.ui.notify("Ξ cross-run lessons shown below", "info");
    },
  });

  // /map (not /tree — that's a built-in pi command).
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
      // Hand the instruction to omp's real agent by prefilling/sending it.
      if (ctx.ui.input) {
        ctx.ui.notify?.(`Ξ ${action} → ask the agent: ${prompt.slice(0, 60)}…`, "info");
      }
      // Surface the composed instruction so the user can send it in the real chat.
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

function setupBeforeAgentStart(pi: any) {
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    try {
      const entries = await loadHypotheses(event.cwd);
      const active = getActiveHypothesis(entries);

      if (sessionCtx) {
        await refreshEpistemicWidget(sessionCtx, event.cwd, ACTIVE_GATES);
        if (treeVisible) { try { await showTree(sessionCtx); } catch {} }
      }
      if (!active) return;

      const spent = await getHypothesisSpend(event.cwd, active.id);
      const pct = active.costCap > 0 ? Math.round((spent / active.costCap) * 100) : 0;

      const summary = [
        `## Epistemic runtime state`,
        `- Active hypothesis: ${active.id}`,
        `- Claim: ${active.claim.slice(0, 100)}`,
        `- Status: ${active.status}`,
        `- Judge: ${active.judgeRef.slice(0, 40)}`,
        `- Falsifier: ${active.falsifier.slice(0, 80)}`,
        `- Cost: $${spent.toFixed(2)} / $${active.costCap} (${pct}%)`,
        `- Compute: ${active.computeTarget}`,
        ``,
        `Methodology gates active: ${ACTIVE_GATES.join(" ✓  ")} ✓`,
        `Provisional results go in smokes/ only. Headline files require confirmed experiments.`,
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
