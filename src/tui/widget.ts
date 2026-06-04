import { truncateToWidth } from "@earendil-works/pi-tui";
import type { HypothesisEntry } from "../state/repo.js";
import { loadHypotheses, getActiveHypothesis, getHypothesisSpend } from "../state/repo.js";

/**
 * Clamp widget lines to the terminal width. pi crashes if a widget renders a
 * line wider than the terminal. NOTE: this uses process.stdout.columns, which
 * can OVERESTIMATE pi's actual render width (pi reserves gutters / sidebars),
 * so prefer linesWidget() for setWidget — it truncates at the true width.
 */
export function fitWidth(lines: string[]): string[] {
  const w = Math.max(20, (process.stdout.columns ?? 80) - 2);
  return lines.map((l) => truncateToWidth(l, w));
}

/**
 * Width-correct widget: returns a setWidget factory whose Component truncates
 * each line to the ACTUAL render width pi passes at draw time. This is the only
 * reliable way to avoid pi's "Rendered line exceeds terminal width" crash —
 * the real content width is unknown until render (stdout.columns lies).
 */
export function linesWidget(lines: string[]) {
  return () => ({
    render(width: number): string[] {
      const w = Math.max(1, width);
      return lines.map((l) => truncateToWidth(l, w));
    },
    invalidate() {},
  });
}

const STATUS_ICON: Record<string, string> = {
  OPEN:      "○",
  RUNNING:   "▶",
  FALSIFIED: "✗",
  CONFIRMED: "✓",
  KILLED:    "☓",
};

export interface HypothesisGates {
  prereg: boolean;
  judgeLock: boolean;
  stats: boolean;
  falsif: boolean;
}

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

    ctx.ui.setWidget?.("epistemic", linesWidget(buildEpistemicWidget(active, spent, gates)), { placement: "belowEditor" });
    ctx.ui.setStatus?.("epistemic", buildEpistemicStatus(active));
  } catch {}
}

function costBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}

export function buildHypothesisHeader(
  active: HypothesisEntry | undefined,
  spent: number,
  gates: HypothesisGates,
  trialsDone: number,
  trialsTotal: number,
): string[] {
  if (!active) return [];

  const icon = STATUS_ICON[active.status] ?? "○";
  const chars = [...active.claim];
  const claim = chars.length > 40 ? chars.slice(0, 40).join("") + "…" : active.claim;
  const stage = deriveStageFromStatus(active.status);
  const cost = `$${spent.toFixed(2)}/$${active.costCap}`;
  const trials = trialsTotal > 0 ? ` · ${trialsDone}/${trialsTotal} runs` : "";

  const line1 = `${icon} ${active.id} · ${claim}   stage ${stage}/9 · ${cost}${trials}`;
  const g = (ok: boolean, label: string) => `${ok ? "✓" : "✗"} ${label}`;
  const line2 = `${g(gates.prereg, "prereg")}   ${g(gates.judgeLock, "judge")}   ${g(gates.stats, "stats")}   ${g(gates.falsif, "falsif")}`;

  return [line1, line2];
}

function deriveStageFromStatus(status: HypothesisEntry["status"]): number {
  switch (status) {
    case "OPEN":      return 1;
    case "RUNNING":   return 4;
    case "CONFIRMED": return 7;
    case "FALSIFIED": return 6;
    case "KILLED":    return 8;
    default:          return 1;
  }
}
