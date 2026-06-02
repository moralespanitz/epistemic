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
import { parseConditionalPlans } from "./tree.js";
import { renderTreeDiagram } from "./diagram.js";
import { computeScore, xpToNextLevel } from "./score.js";
import { bold, dim, gold, green, yellow, red, gray, byStatus, costBar } from "../tui/color.js";

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

/** Two-line gamified header: mission control + XP/rank/discipline. */
function header(fleet: Fleet): string[] {
  const sc = computeScore(fleet);
  const counts =
    `${yellow(`▶ ${fleet.running}`)}  ${green(`✓ ${fleet.shipped}`)}  ${red(`☓ ${fleet.killed}`)}`;
  const toNext = xpToNextLevel(sc.xp);
  const game =
    `${bold(gold(`LV.${sc.level} ${sc.rank}`))}  ${gold(`★ ${sc.xp} XP`)}` +
    (sc.badges.length ? `  ${sc.badges.join(" ")}` : "") +
    `  ${dim(`discipline: ${sc.discipline} · kill:ship ${sc.ksRatio.toFixed(1)}:1 · ${toNext} XP → LV.${sc.level + 1}`)}`;
  return [
    `${bold(gold("Ξ epistemic · mission control"))}   ${costBar(fleet.totalSpent, fleet.totalCap)} ${dim(`$${fleet.totalSpent.toFixed(2)}/$${fleet.totalCap}`)}   ${counts}`,
    game,
  ];
}

function treeInterface(fleet: Fleet, selectedId?: string): string[] {
  const lines = [...header(fleet), ""];
  lines.push(dim("  ↑↓ select · → open · enter actions · /monitor off to chat"));
  lines.push("");

  // Centered top-down tree diagram (root on top, children fan out below).
  for (const l of renderTreeDiagram(fleet.entries, fleet.hypothesesContent, selectedId)) lines.push(l);

  // Caption for the selected node: claim + decision + live progress. Keeps the
  // diagram nodes compact while still showing the detail at a glance.
  const sel = fleet.entries.find((e) => e.id === selectedId);
  if (sel) {
    const icon = STATUS_ICON[sel.status] ?? "?";
    const stat = fleet.stats.find((s) => s.id === sel.id);
    const plan = parseConditionalPlans(fleet.hypothesesContent).get(sel.id);
    lines.push("");
    lines.push(`${byStatus(sel.status, `${icon} ${sel.id}`)}  ${sel.claim.slice(0, 60)}`);
    if (stat && (stat.trialsTotal > 0 || stat.spent > 0)) {
      const acc = stat.accSeries.length ? `  acc ${gold(sparkline(stat.accSeries))}` : "";
      lines.push(dim(`   ${stat.trialsDone}/${stat.trialsTotal} trials · $${stat.spent.toFixed(0)}/$${sel.costCap}`) + acc);
    }
    if (plan) lines.push(`   ${gold("◇")} ${dim(`${plan.condition} ?`)} ${green(plan.ifTrue)} ${dim(":")} ${gray(plan.ifFalse)}`);
  }
  return lines;
}

function detailInterface(fleet: Fleet, entry: HypothesisEntry, stat?: ExperimentStat): string[] {
  const plan = parseConditionalPlans(fleet.hypothesesContent).get(entry.id);
  const icon = STATUS_ICON[entry.status] ?? "?";
  const lines = [
    ...header(fleet),
    "",
    dim("  ← back · enter actions · /monitor off to chat"),
    "",
    `${byStatus(entry.status, `${icon} ${entry.id}  [${entry.status}]`)}`,
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
    return [...header(fleet), "", dim("  no hypotheses yet — describe a research idea to begin"), "", dim("/monitor off to chat")];
  }
  const idx = Math.max(0, Math.min(selectedIdx, fleet.entries.length - 1));
  const entry = fleet.entries[idx];
  if (mode === "detail") return detailInterface(fleet, entry, fleet.stats.find((s) => s.id === entry.id));
  return treeInterface(fleet, entry.id);
}
