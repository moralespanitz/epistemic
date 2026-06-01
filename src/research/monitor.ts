/**
 * Interactive in-chat mission control. A "monitor mode" you navigate with the
 * arrow keys (captured via onTerminalInput) — like a menu in a game:
 *   ↑/↓  move between experiments
 *   →    open the selected experiment's detail interface
 *   ←    back to the tree
 *   enter open the action menu (chat / approve / reject / modify)
 * Rendered as an omp widget (plain text) so the real chat stays untouched.
 */
import type { Fleet, ExperimentStat } from "../monitor/fleet.js";
import type { HypothesisEntry } from "../state/repo.js";
import { renderResearchTree, parseConditionalPlans } from "./tree.js";

export type MonitorMode = "tree" | "detail";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

const BLOCKS = "▁▂▃▄▅▆▇█";
function sparkline(series: number[], width = 10): string {
  if (series.length === 0) return "·".repeat(width);
  const tail = series.slice(-width);
  const min = Math.min(...tail), max = Math.max(...tail), span = max - min;
  return tail.map((v) => BLOCKS[span === 0 ? 0 : Math.round(((v - min) / span) * 7)]).join("");
}

function costBar(spent: number, cap: number, width = 14): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}

function header(fleet: Fleet): string {
  return (
    `Ξ epistemic · mission control   ${costBar(fleet.totalSpent, fleet.totalCap)} $${fleet.totalSpent.toFixed(2)}/$${fleet.totalCap}` +
    `   ${fleet.running} running · ${fleet.shipped} shipped · ${fleet.killed} killed`
  );
}

function treeInterface(fleet: Fleet, selectedId?: string): string[] {
  const lines = [header(fleet), ""];
  lines.push("  ↑↓ select · → open · enter actions · /monitor off to chat");
  lines.push("");
  for (const l of renderResearchTree(fleet.entries, fleet.hypothesesContent, {}, selectedId)) lines.push(l);
  lines.push("");
  lines.push("experiments");
  if (fleet.stats.length === 0) lines.push("  (none yet)");
  else for (const s of fleet.stats) {
    const sel = s.id === selectedId ? "▸" : " ";
    const icon = STATUS_ICON[s.status] ?? "?";
    lines.push(`  ${sel}${icon} ${s.id.padEnd(8)} ${`${s.trialsDone}/${s.trialsTotal}`.padEnd(7)} $${s.spent.toFixed(0).padEnd(5)} ${s.accSeries.length ? "acc " + sparkline(s.accSeries) : ""}`);
  }
  return lines;
}

function detailInterface(fleet: Fleet, entry: HypothesisEntry, stat?: ExperimentStat): string[] {
  const plan = parseConditionalPlans(fleet.hypothesesContent).get(entry.id);
  const icon = STATUS_ICON[entry.status] ?? "?";
  const lines = [
    header(fleet),
    "",
    "  ← back · enter actions · /monitor off to chat",
    "",
    `${icon} ${entry.id}  [${entry.status}]`,
    `claim:     ${entry.claim}`,
    `falsifier: ${entry.falsifier}`,
    `target:    ${entry.computeTarget}    judge: ${entry.judgeRef ?? "—"}`,
    `cost:      ${costBar(stat?.spent ?? 0, entry.costCap)} $${(stat?.spent ?? 0).toFixed(2)} / $${entry.costCap}`,
  ];
  if (stat) lines.push(`trials:    ${stat.trialsDone}/${stat.trialsTotal}    acc ${sparkline(stat.accSeries)}`);
  if (plan) {
    lines.push("");
    lines.push("decision:");
    lines.push(`  ◇ if ${plan.condition}`);
    lines.push(`  ├─ yes → ${plan.ifTrue}`);
    lines.push(`  └─ no  → ${plan.ifFalse}`);
  }
  if (entry.killReason) lines.push(`killed:    ${entry.killReason}`);
  lines.push("");
  lines.push("press enter → chat / approve / reject / modify this hypothesis");
  return lines;
}

/** Render the monitor in its current mode with the selected index highlighted. */
export function renderMonitor(fleet: Fleet, mode: MonitorMode, selectedIdx: number): string[] {
  if (fleet.entries.length === 0) {
    return [header(fleet), "", "  no hypotheses yet — describe a research idea to begin", "", "/monitor off to chat"];
  }
  const idx = Math.max(0, Math.min(selectedIdx, fleet.entries.length - 1));
  const entry = fleet.entries[idx];
  if (mode === "detail") return detailInterface(fleet, entry, fleet.stats.find((s) => s.id === entry.id));
  return treeInterface(fleet, entry.id);
}
