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
