import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { registerPreregGate } from "./gates/prereg.js";
import { registerJudgeLockGate } from "./gates/judge-lock.js";
import { registerSmokeGate } from "./gates/smoke.js";
import { registerCostLedger } from "./gates/cost-ledger.js";
import { registerClaimInterceptor } from "./gates/claim-interceptor.js";
import { registerKillCriteriaGate } from "./gates/kill-criteria.js";
import { registerBaselineStalenessGate } from "./gates/baseline-staleness.js";
import { registerHuggingFaceTools } from "./extensions/huggingface.js";
import { loadRepoState, loadHypotheses, getActiveHypothesis, getHypothesisSpend } from "./state/repo.js";
import { refreshEpistemicWidget } from "./tui/widget.js";
import { renderResearchTree } from "./research/tree.js";
import { renderMonitorWidget } from "./research/monitor.js";
import { loadFleet } from "./monitor/fleet.js";

let initialized = false;
let sessionCtx: ExtensionContext | null = null;
let treeVisible = false; // whether the /tree widget is currently shown

// Research views cycled by /view. "monitor" is the full dashboard.
const RESEARCH_VIEWS = ["off", "monitor", "tree", "cost"] as const;
type ResearchView = (typeof RESEARCH_VIEWS)[number];
let currentView: ResearchView = "off";
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const ACTIVE_GATES = ["prereg", "judge-lock", "smoke", "cost-ledger", "claim-interceptor", "kill-criteria", "baseline-staleness"];

const TREE_KEY = "epistemic-tree";

/** Render the decision-tree widget into omp's UI (below the editor). */
async function showTree(ctx: any) {
  const entries = await loadHypotheses(ctx.cwd);
  const content = (await safeReadFile(ctx.cwd, "HYPOTHESES.md")) ?? "";
  const active = getActiveHypothesis(entries);
  const lines = renderResearchTree(entries, content, {}, active?.id);
  ctx.ui.setWidget?.(TREE_KEY, ["Ξ research map  (/map off to hide · /view to cycle)", ...lines], { placement: "belowEditor" });
}

/** Render whichever research view is active (or clear it). Used by /view + the shortcut. */
async function renderCurrentView(ctx: any) {
  if (currentView === "monitor") {
    treeVisible = false;
    const fleet = await loadFleet(ctx.cwd);
    ctx.ui.setWidget?.(TREE_KEY, renderMonitorWidget(fleet), { placement: "belowEditor" });
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
    ctx.ui.setWidget?.(TREE_KEY, ["Ξ cost  (/view to cycle)", ...(lines.length ? lines : ["  no hypotheses yet"])], { placement: "belowEditor" });
    return;
  }
  ctx.ui.setWidget?.(TREE_KEY, undefined); // "off"
}

function cycleView(dir: number) {
  const i = RESEARCH_VIEWS.indexOf(currentView);
  currentView = RESEARCH_VIEWS[(i + dir + RESEARCH_VIEWS.length) % RESEARCH_VIEWS.length];
}

export default async function (pi: ExtensionAPI) {
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

  // /monitor — the claude-agents-style live dashboard, inside the chat.
  pi.registerCommand?.("monitor", {
    description: "Live mission-control dashboard (tree + experiments + burn). /monitor off to hide.",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "off") {
        currentView = "off";
        ctx.ui.setWidget?.(TREE_KEY, undefined);
        ctx.ui.notify?.("Ξ monitor hidden", "info");
        return;
      }
      currentView = "monitor";
      await renderCurrentView(ctx);
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
