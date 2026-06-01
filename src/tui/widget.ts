import { truncateToWidth } from "@earendil-works/pi-tui";
import type { HypothesisEntry } from "../state/repo.js";
import { loadHypotheses, getActiveHypothesis, getHypothesisSpend } from "../state/repo.js";

/**
 * Clamp widget lines to the terminal width. pi crashes if a widget renders a
 * line wider than the terminal — every setWidget payload must go through this.
 */
export function fitWidth(lines: string[]): string[] {
  const w = Math.max(20, (process.stdout.columns ?? 80) - 2);
  return lines.map((l) => truncateToWidth(l, w));
}

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
    return [`Ξ epistemic  ·  no active hypothesis  ·  ${gates.length} gates armed  ·  describe your research idea to begin`];
  }

  const icon = STATUS_ICON[active.status] ?? "?";
  const pct  = active.costCap > 0 ? Math.min(Math.round((spent / active.costCap) * 100), 100) : 0;
  const bar  = costBar(pct, 10);
  const killPct = active.costCap > 0 ? (spent / (active.costCap * 1.5)) * 100 : 0;
  const killWarn = killPct >= 80 ? `  ⚠ kill@${Math.round(killPct)}%` : "";
  const preview = active.claim.length > 80 ? active.claim.slice(0, 80) + "…" : active.claim;

  return [
    `Ξ  ${icon} ${active.id} [${active.status}]  ·  $${spent.toFixed(2)} / $${active.costCap}  ${bar}${killWarn}  ·  ${gates.length} gates ✓  ·  ${active.computeTarget}`,
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

    ctx.ui.setWidget?.("epistemic", fitWidth(buildEpistemicWidget(active, spent, gates)), { placement: "belowEditor" });
    ctx.ui.setStatus?.("epistemic", buildEpistemicStatus(active));
  } catch {}
}

function costBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}
