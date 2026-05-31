import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { registerPreregGate } from "./gates/prereg.js";
import { registerHuggingFaceTools } from "./extensions/huggingface.js";
import { loadRepoState, loadHypotheses, getActiveHypothesis } from "./state/repo.js";
import { refreshEpistemicWidget } from "./tui/widget.js";

let initialized = false;
let sessionCtx: ExtensionContext | null = null;

// Gates currently registered — extended as more gates are added.
const ACTIVE_GATES = ["prereg"];

export default async function (pi: ExtensionAPI) {
  // ─── Session start: detect epistemic repo, activate gates ───
  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    try {
      const state = await loadRepoState(ctx.cwd);
      if (!initialized) {
        const hasState = state.hypotheses || state.baselines || state.results;
        ctx.ui.notify(
          hasState
            ? "Ξ epistemic active. Gates are enforcing methodology."
            : "Ξ epistemic loaded. Describe your research idea — the agent will guide you.",
          "info"
        );
        initialized = true;
      }
      await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);
    } catch {}
  });

  // ─── Session shutdown: cleanup ───
  pi.on("session_shutdown", async () => {
    // Cleanup handled by individual subscribers
  });

  // ─── State injection into system prompt ─────────────────────
  setupBeforeAgentStart(pi);

  // ─── Gates (methodology enforcement) ──────────────────────────
  registerPreregGate(pi as any); // Block unprereg'd experiments
  registerHuggingFaceTools(pi);   // HF dataset metadata tools

  // Planned gates (not yet implemented):
  // registerJudgeLockGate(pi as any);   // Lock judge config
  // registerSmokeGate(pi as any);       // Block provisional numbers in headlines
  // registerCostLedger(pi as any);      // Track every tool call cost
  // registerClaimInterceptor(pi as any);// Detect claims, warn about reproductions
  // registerKillCriteria(pi as any);    // Enforce kill criteria
  // registerBaselineStalenessGate(pi as any); // Block stale baselines
}

/**
 * Inject live epistemic state into the system prompt on every turn.
 * The agent reads this to know which hypothesis is active and what gates are in play.
 */
function setupBeforeAgentStart(pi: any) {
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    try {
      const entries = await loadHypotheses(event.cwd);
      const active = getActiveHypothesis(entries);

      if (sessionCtx) {
        await refreshEpistemicWidget(sessionCtx, event.cwd, ACTIVE_GATES);
      }
      if (!active) return;

      const summary = [
        `## Epistemic runtime state`,
        `- Active hypothesis: ${active.id}`,
        `- Claim: ${active.claim.slice(0, 100)}`,
        `- Status: ${active.status}`,
        `- Judge: ${active.judgeRef.slice(0, 40)}`,
        `- Cost cap: $${active.costCap}`,
        `- Falsifier: ${active.falsifier.slice(0, 80)}`,
        ``,
        `Methodology gates active: prereg ✓`,
        `Provisional results go in smokes/ only. Headline files require confirmed experiments.`,
        `Overrides are recorded in OVERRIDES.md with a mandatory reason.`,
        ``,
      ].join("\n");

      return {
        systemPrompt: event.systemPrompt + "\n\n" + summary,
      };
    } catch {
      return;
    }
  });
}
