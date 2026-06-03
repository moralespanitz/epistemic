import { loadFleet } from "../../../../src/monitor/fleet.js";
import { deriveStage, type StageFacts } from "../../../../src/state/stage.js";
import { getActiveHypothesis } from "../../../../src/state/repo.js";

const SEP = "────────────────────";

function gate(label: string, ok: boolean): string {
  return `${label.padEnd(8)} ${ok ? "✓" : "✗"}`;
}

function costBar(spent: number, cap: number, width = 10): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%`;
}

/** Render the research sidebar lines for the active hypothesis. */
export async function renderResearchSidebar(cwd: string): Promise<string[]> {
  try {
    const fleet = await loadFleet(cwd);
    const active = getActiveHypothesis(fleet.entries);

    if (!active) {
      return [
        "Ξ epistemic",
        SEP,
        "no active hypothesis",
        "describe your idea to begin",
      ];
    }

    const stat = fleet.stats.find(s => s.id === active.id);
    const spent = stat?.spent ?? 0;
    const cap = active.costCap ?? 0;

    // Derive next action via stage engine
    const facts: StageFacts = {
      active,
      spent,
      hasPrereg:            stat?.hasPrereg ?? false,
      hasJudgeLock:         stat?.hasJudgeLock ?? false,
      hasBaseline:          stat?.hasBaseline ?? false,
      hasSmokes:            stat?.hasSmokes ?? false,
      smokesSimulated:      false, // TODO: ExperimentStat doesn't expose this yet — suppresses smokes-simulated anomaly
      hasConfirmedResults:  stat?.inResults ?? false,
    };
    const report = deriveStage(facts);
    const pipelineIdx = ["research-question","preregistration","baseline-reproduction",
      "experiment-execution","statistical-rigor","falsification-review",
      "kill-or-ship","verification-before-publication"].indexOf(report.stage) + 1;

    const title = active.claim.length > 18
      ? active.claim.slice(0, 18) + "…"
      : active.claim;

    return [
      `Ξ ${active.id}  ${title}`,
      `${active.status} · stage ${pipelineIdx}/8`,
      SEP,
      gate("prereg",   facts.hasPrereg),
      gate("judge",    facts.hasJudgeLock),
      gate("baseline", facts.hasBaseline),
      gate("results",  facts.hasConfirmedResults),
      SEP,
      `$${spent.toFixed(0)} / $${cap}`,
      costBar(spent, cap),
      SEP,
      `→ ${report.nextAction.slice(0, 20)}`,
    ];
  } catch (e) {
    process.stderr.write(`[epistemic sidebar] ${String(e)}\n`);
    return ["Ξ epistemic", "─ sidebar error"];
  }
}
