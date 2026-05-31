import type { HypothesisEntry } from "../state/repo.js";
import { loadHypotheses, getActiveHypothesis, getHypothesisSpend } from "../state/repo.js";

const STATUS_ICON: Record<string, string> = {
  OPEN:      "○",
  RUNNING:   "▶",
  FALSIFIED: "✗",
  CONFIRMED: "✓",
  KILLED:    "☓",
};

export function buildEpistemicWidget(
  active: HypothesisEntry | undefined,
  spent: number,
  gates: string[]
): string[] {
  if (!active) {
    return ["Ξ epistemic  ·  no active hypothesis  ·  describe your research idea to begin"];
  }

  const icon = STATUS_ICON[active.status] ?? "?";
  const pct  = active.costCap > 0 ? Math.min(Math.round((spent / active.costCap) * 100), 100) : 0;
  const bar  = costBar(pct, 8);
  const gateStr = gates.length ? gates.map(g => `${g} ✓`).join("  ") : "none";
  const preview = active.claim.length > 90 ? active.claim.slice(0, 90) + "…" : active.claim;

  return [
    `Ξ  ${icon} ${active.id} [${active.status}]  ·  $${spent.toFixed(2)} / $${active.costCap}  ${bar}  ·  ${gateStr}  ·  ${active.computeTarget}`,
    `   "${preview}"`,
  ];
}

export function buildEpistemicStatus(active: HypothesisEntry | undefined): string {
  if (!active) return "Ξ idle";
  return `Ξ ${active.id} ${STATUS_ICON[active.status] ?? "?"} ${active.status}`;
}

export async function refreshEpistemicWidget(ctx: any, cwd: string, gates: string[]): Promise<void> {
  try {
    const entries = await loadHypotheses(cwd);
    const active  = getActiveHypothesis(entries);
    const spent   = active ? await getHypothesisSpend(cwd, active.id) : 0;

    ctx.ui.setWidget?.("epistemic", buildEpistemicWidget(active, spent, gates), { placement: "belowEditor" });
    ctx.ui.setStatus?.("epistemic", buildEpistemicStatus(active));
  } catch {}
}

function costBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}
