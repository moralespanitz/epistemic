/**
 * In-chat mission-control dashboard — rendered as an omp widget so you can flip
 * to it from the real chat (/monitor) and back (/monitor off), like a
 * claude-agents-style dashboard. Plain text (no raw ANSI) so omp renders it
 * cleanly below the editor.
 */
import type { Fleet, ExperimentStat } from "../monitor/fleet.js";
import { renderResearchTree } from "./tree.js";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

const BLOCKS = "▁▂▃▄▅▆▇█";
function sparkline(series: number[], width = 8): string {
  if (series.length === 0) return "·".repeat(width);
  const tail = series.slice(-width);
  const min = Math.min(...tail), max = Math.max(...tail), span = max - min;
  return tail.map((v) => BLOCKS[span === 0 ? 0 : Math.round(((v - min) / span) * 7)]).join("");
}

function costBar(spent: number, cap: number, width = 12): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}

function experimentLine(s: ExperimentStat): string {
  const icon = STATUS_ICON[s.status] ?? "?";
  const id = `${icon} ${s.id}`.padEnd(12);
  const prog = `${s.trialsDone}/${s.trialsTotal}`.padEnd(7);
  const cost = `$${s.spent.toFixed(0)}`.padEnd(5);
  const spark = s.accSeries.length ? `acc ${sparkline(s.accSeries)}` : "";
  return `  ${id} ${prog} ${cost} ${spark}`;
}

/** Render the full dashboard as widget lines for `/monitor`. */
export function renderMonitorWidget(fleet: Fleet, selectedId?: string): string[] {
  const active = fleet.entries.find((e) => e.status === "RUNNING") ?? fleet.entries[0];
  const lines: string[] = [];

  lines.push(
    `Ξ epistemic · mission control   ${costBar(fleet.totalSpent, fleet.totalCap, 14)} $${fleet.totalSpent.toFixed(2)}/$${fleet.totalCap}` +
      `   ${fleet.running} running · ${fleet.shipped} shipped · ${fleet.killed} killed   (/monitor off · /view)`,
  );
  lines.push("");

  for (const l of renderResearchTree(fleet.entries, fleet.hypothesesContent, {}, selectedId ?? active?.id)) {
    lines.push(l);
  }

  lines.push("");
  lines.push("experiments");
  if (fleet.stats.length === 0) lines.push("  (none yet)");
  else for (const s of fleet.stats) lines.push(experimentLine(s));

  return lines;
}
