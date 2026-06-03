import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { loadHypotheses, getActiveHypothesis, appendCostRecord, getHypothesisSpend } from "../../../../src/state/repo.js";
import type { CostCategory } from "../../../../src/state/repo.js";

// Rough cost estimates per tool call in USD
const COST_ESTIMATES: Record<string, { cost: number; category: CostCategory }> = {
  bash: { cost: 0.002, category: "compute" },
  computer: { cost: 0.005, category: "compute" },
  default: { cost: 0.001, category: "llm" },
};

export function registerCostLedger(pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    try {
      const entries = await loadHypotheses(ctx.cwd);
      const active = getActiveHypothesis(entries);
      if (!active) return;

      const toolName = event.type?.replace("tool_call:", "") ?? "unknown";
      const estimate = COST_ESTIMATES[toolName] ?? COST_ESTIMATES.default;

      await appendCostRecord(ctx.cwd, {
        timestamp: new Date().toISOString(),
        hypothesisId: active.id,
        toolName,
        estimatedCost: estimate.cost,
        category: estimate.category,
        isError: false,
      });

      // Warn if over cap (soft — KillCriteria will hard-block)
      const spent = await getHypothesisSpend(ctx.cwd, active.id);
      if (spent > active.costCap * 1.2) {
        return {
          notify: `⚠ Cost cap warning: $${spent.toFixed(2)} spent vs $${active.costCap} cap for ${active.id}`,
        };
      }
    } catch { /* never block on ledger errors */ }
  });
}
