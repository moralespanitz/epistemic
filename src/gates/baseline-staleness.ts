import { loadHypotheses, getActiveHypothesis, loadBaselines, getBaselineAgeDays } from "../state/repo.js";

const MAX_BASELINE_AGE_DAYS = 30;

export function registerBaselineStalenessGate(pi: any) {
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    try {
      const cwd = event.cwd;
      const entries = await loadHypotheses(cwd);
      const active = getActiveHypothesis(entries);
      if (!active) return;

      const baselines = await loadBaselines(cwd);
      if (baselines.length === 0) return;

      const stale = baselines.filter(b => {
        try { return getBaselineAgeDays(b) > MAX_BASELINE_AGE_DAYS; }
        catch { return false; }
      });

      if (stale.length === 0) return;

      const names = stale.map(b => `${b.name} (${Math.floor(getBaselineAgeDays(b))}d)`).join(", ");
      return {
        systemPrompt: event.systemPrompt + `\n\n⚠ STALE BASELINES: ${names} are more than ${MAX_BASELINE_AGE_DAYS} days old. Refresh these baselines before running new experiments to ensure comparisons are valid.`,
      };
    } catch { return; }
  });
}
