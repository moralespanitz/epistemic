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
import { deriveStage } from "../state/stage.js";
import { bold, dim, gold, green, yellow, red, gray, cyan, byStatus, costBar } from "../tui/color.js";

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
  lines.push(dim("  ↑↓ select · → open · enter actions · /idea new · /monitor off to chat"));
  lines.push("");

  // Per-node live state, shown as a second line under each node in the diagram.
  const sub: Record<string, string> = {};
  for (const s of fleet.stats) sub[s.id] = nodeState(s);

  // Centered top-down tree diagram (root on top, children fan out below).
  for (const l of renderTreeDiagram(fleet.entries, fleet.hypothesesContent, selectedId, sub)) lines.push(l);

  // Rich caption for the selected node: stage, gate checklist, next action,
  // claim, progress, and decision — the full current state at a glance.
  const sel = fleet.entries.find((e) => e.id === selectedId);
  const stat = sel && fleet.stats.find((s) => s.id === sel.id);
  if (sel && stat) {
    const icon = STATUS_ICON[sel.status] ?? "?";
    const plan = parseConditionalPlans(fleet.hypothesesContent).get(sel.id);
    const report = deriveStage({
      active: sel, spent: stat.spent,
      hasPrereg: stat.hasPrereg, hasJudgeLock: stat.hasJudgeLock, hasBaseline: stat.hasBaseline,
      hasSmokes: stat.hasSmokes, smokesSimulated: stat.hasSmokes && !(stat.hasPrereg && stat.hasJudgeLock),
      hasConfirmedResults: stat.inResults,
    });
    const gate = (ok: boolean, name: string) => (ok ? green(`${name} ✓`) : dim(`${name} ✗`));
    lines.push("");
    lines.push(`${byStatus(sel.status, `${icon} ${sel.id}`)}  ${sel.claim.slice(0, 58)}`);
    lines.push(`   ${dim("stage:")} ${cyan(report.stage)}   ${gate(stat.hasPrereg, "prereg")} · ${gate(stat.hasJudgeLock, "judge")} · ${gate(stat.hasBaseline, "baseline")} · ${gate(stat.inResults, "results")}`);
    if (stat.trialsTotal > 0 || stat.spent > 0) {
      const acc = stat.accSeries.length ? `  acc ${gold(sparkline(stat.accSeries))}` : "";
      lines.push(dim(`   ${stat.trialsDone}/${stat.trialsTotal} trials · $${stat.spent.toFixed(0)}/$${sel.costCap}`) + acc);
    }
    if (plan) lines.push(`   ${gold("◇")} ${dim(`${plan.condition} ?`)} ${green(plan.ifTrue)} ${dim(":")} ${gray(plan.ifFalse)}`);
    lines.push(`   ${bold(gold("→"))} ${report.nextAction.slice(0, 90)}`);
  }
  return lines;
}

/** Compact live-state sub-line shown under each diagram node. */
function nodeState(s: ExperimentStat): string {
  switch (s.status) {
    case "RUNNING": return `${s.trialsDone}/${s.trialsTotal}`;
    case "CONFIRMED": return "shipped";
    case "KILLED": return "killed";
    case "FALSIFIED": return "falsified";
    default: return s.hasPrereg ? (s.hasBaseline ? "ready" : "prereg✓") : "needs prereg";
  }
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
