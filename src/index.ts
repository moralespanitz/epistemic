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

let initialized = false;
let sessionCtx: ExtensionContext | null = null;

const ACTIVE_GATES = ["prereg", "judge-lock", "smoke", "cost-ledger", "claim-interceptor", "kill-criteria", "baseline-staleness"];

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
      await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);
    } catch {}
  });

  pi.on("session_shutdown", async () => {});

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
  const TREE_KEY = "epistemic-tree";

  pi.registerCommand?.("tree", {
    description: "Toggle the epistemic decision tree (research program as a tree)",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "off") {
        ctx.ui.setWidget?.(TREE_KEY, undefined);
        ctx.ui.notify?.("Ξ tree hidden", "info");
        return;
      }
      const entries = await loadHypotheses(ctx.cwd);
      const content = (await safeReadFile(ctx.cwd, "HYPOTHESES.md")) ?? "";
      const active = getActiveHypothesis(entries);
      const lines = renderResearchTree(entries, content, {}, active?.id);
      ctx.ui.setWidget?.(TREE_KEY, ["Ξ research tree  (/tree off to hide)", ...lines], { placement: "belowEditor" });
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
