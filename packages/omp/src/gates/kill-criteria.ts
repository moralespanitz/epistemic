import { loadHypotheses, getActiveHypothesis, getHypothesisSpend, fileExists } from "../../../../src/state/repo.js";
import { join } from "node:path";

const KILL_COST_MULTIPLIER = 1.5;
const KILL_STALE_DAYS = 21;

export function registerKillCriteriaGate(pi: any) {
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    try {
      const cwd = event.cwd;
      const entries = await loadHypotheses(cwd);
      const active = getActiveHypothesis(entries);
      if (!active) return;

      const overridePath = join(cwd, "OVERRIDES.md");
      const hasOverride = await fileExists(overridePath);

      const spent = await getHypothesisSpend(cwd, active.id);
      const killBudget = active.costCap * KILL_COST_MULTIPLIER;
      const staleDays = (Date.now() - active.timestamp) / (1000 * 60 * 60 * 24);

      const overBudget = spent > killBudget;
      const stale = staleDays > KILL_STALE_DAYS;

      if (!overBudget && !stale) return;

      // If there's an override, inject warning but don't block
      if (hasOverride) {
        const reasons: string[] = [];
        if (overBudget) reasons.push(`$${spent.toFixed(2)} spent vs $${killBudget.toFixed(2)} kill threshold`);
        if (stale) reasons.push(`${Math.floor(staleDays)} days since registration (limit: ${KILL_STALE_DAYS})`);
        return {
          systemPrompt: event.systemPrompt + `\n\n⚠ KILL CRITERIA EXCEEDED (override active): ${reasons.join("; ")}. Proceed with caution.`,
        };
      }

      // Hard block
      const reasons: string[] = [];
      if (overBudget) reasons.push(`$${spent.toFixed(2)} spent (kill threshold: $${killBudget.toFixed(2)}, cap: $${active.costCap})`);
      if (stale) reasons.push(`${Math.floor(staleDays)} days old (limit: ${KILL_STALE_DAYS} days)`);

      return {
        systemPrompt: event.systemPrompt + `\n\n🛑 KILL CRITERIA TRIGGERED for hypothesis "${active.id}": ${reasons.join("; ")}. You MUST run the kill-or-ship skill and make a KILL, PIVOT, REFINE, RECOMMIT, or SHIP decision before continuing. Record any override in OVERRIDES.md with a mandatory reason (≥50 chars).`,
      };
    } catch { return; }
  });
}
