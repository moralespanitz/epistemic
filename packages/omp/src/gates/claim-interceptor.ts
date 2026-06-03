import { loadHypotheses, getActiveHypothesis, loadBaselines } from "../../../../src/state/repo.js";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

// Patterns that indicate a comparative claim
const CLAIM_PATTERNS = [
  /outperform/i, /better than/i, /improves? over/i, /surpass/i,
  /beats?/i, /exceeds?/i, /\+\d+(\.\d+)?%/, /state.of.the.art/i,
];

async function getReproducedBaselines(cwd: string, hypothesisId: string): Promise<Set<string>> {
  const reproduced = new Set<string>();
  try {
    const baselineDir = join(cwd, "experiments", hypothesisId, "baselines");
    const files = await readdir(baselineDir);
    for (const f of files) {
      if (f.endsWith(".md")) reproduced.add(f.replace(".md", "").toLowerCase());
    }
  } catch { /* no baselines dir */ }
  return reproduced;
}

export function registerClaimInterceptor(pi: any) {
  pi.on("message", async (event: any, ctx: any) => {
    // Only intercept assistant messages that contain comparison claims
    if (event.role !== "assistant") return;
    const text = (event.content ?? "").toString();

    const hasComparativeClaim = CLAIM_PATTERNS.some(p => p.test(text));
    if (!hasComparativeClaim) return;

    const entries = await loadHypotheses(ctx.cwd);
    const active = getActiveHypothesis(entries);
    if (!active) return;

    const baselines = await loadBaselines(ctx.cwd);
    if (baselines.length === 0) {
      return {
        notify: `⚠ Claim interceptor: comparison claim detected but no baselines are registered. Reproduce the baseline before making comparative claims.`,
      };
    }

    const reproduced = await getReproducedBaselines(ctx.cwd, active.id);
    const unreproduced = baselines.filter(b => !reproduced.has(b.name.toLowerCase()));

    if (unreproduced.length > 0) {
      const names = unreproduced.map(b => b.name).join(", ");
      return {
        notify: `⚠ Claim interceptor: comparative claim detected. Baseline(s) not yet reproduced under your judge: ${names}. Run baseline-reproduction skill first.`,
      };
    }
  });
}
