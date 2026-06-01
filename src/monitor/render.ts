/**
 * Pure rendering for the epistemic monitor — a game-style mission-control
 * dashboard: research map on the left, live experiments on the right, fleet
 * burn up top. Pure string output so it's easy to reason about and test.
 */
import type { ExperimentStat, Fleet } from "./fleet.js";
import { renderResearchTree } from "../research/tree.js";

const ESC = "\x1b[";
const R = `${ESC}0m`;
const c = {
  white: (s: string) => `${ESC}97m${s}${R}`,
  bold: (s: string) => `${ESC}1m${s}${R}`,
  dim: (s: string) => `${ESC}2m${s}${R}`,
  cyan: (s: string) => `${ESC}38;5;51m${s}${R}`,
  magenta: (s: string) => `${ESC}38;5;213m${s}${R}`,
  green: (s: string) => `${ESC}38;5;42m${s}${R}`,
  yellow: (s: string) => `${ESC}38;5;221m${s}${R}`,
  red: (s: string) => `${ESC}38;5;203m${s}${R}`,
};

const STATUS_BADGE: Record<string, (s: string) => string> = {
  OPEN: c.dim, RUNNING: c.cyan, CONFIRMED: c.green, FALSIFIED: c.red, KILLED: c.red,
};
const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", CONFIRMED: "✓", FALSIFIED: "✗", KILLED: "☓",
};

const BLOCKS = "▁▂▃▄▅▆▇█";
export function sparkline(series: number[], width = 8): string {
  if (series.length === 0) return c.dim("·".repeat(width));
  const tail = series.slice(-width);
  const min = Math.min(...tail), max = Math.max(...tail), span = max - min;
  return tail.map((v) => BLOCKS[span === 0 ? 0 : Math.round(((v - min) / span) * 7)]).join("");
}

export function bar(spent: number, cap: number, width = 10): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const color = pct >= 100 ? c.red : pct >= 67 ? c.yellow : c.green;
  return color("█".repeat(filled)) + c.dim("░".repeat(width - filled)) + ` ${pct}%`;
}

/** Strip ANSI for visible-length math when padding columns. */
function visLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}
function padEnd(s: string, width: number): string {
  const pad = width - visLen(s);
  return pad > 0 ? s + " ".repeat(pad) : s;
}

function experimentRows(stats: ExperimentStat[]): string[] {
  if (stats.length === 0) return [c.dim("  no experiments yet")];
  return stats.map((s) => {
    const badge = (STATUS_BADGE[s.status] ?? c.white)(`${STATUS_ICON[s.status] ?? "?"} ${s.id}`);
    const prog = c.dim(`${s.trialsDone}/${s.trialsTotal}`);
    const cost = c.green(`$${s.spent.toFixed(0)}`);
    return `  ${padEnd(badge, 14)} ${padEnd(prog, 7)} ${padEnd(cost, 6)} ${c.cyan(sparkline(s.accSeries))}`;
  });
}

/**
 * Render the full dashboard. `cols`/`rows` are the terminal size; `selectedId`
 * highlights a node in the map.
 */
export function renderDashboard(fleet: Fleet, cols = 100, selectedId?: string): string {
  const active = fleet.entries.find((e) => e.status === "RUNNING") ?? fleet.entries[0];
  const tree = renderResearchTree(fleet.entries, fleet.hypothesesContent, {}, selectedId ?? active?.id);
  const rightCol = experimentRows(fleet.stats);

  const leftWidth = Math.max(40, Math.floor(cols * 0.55));
  const out: string[] = [];

  // Header / fleet burn.
  out.push(c.bold(c.magenta(" Ξ EPISTEMIC")) + c.dim("  ·  mission control"));
  out.push(
    `  burn ${c.green(`$${fleet.totalSpent.toFixed(2)}`)} / $${fleet.totalCap}  ${bar(fleet.totalSpent, fleet.totalCap, 16)}` +
      `   ${c.cyan(`${fleet.running} running`)} · ${c.green(`${fleet.shipped} shipped`)} · ${c.red(`${fleet.killed} killed`)}`,
  );
  out.push("");

  // Column headers + body (map | experiments).
  out.push(padEnd(c.yellow(" RESEARCH MAP"), leftWidth) + c.yellow("EXPERIMENTS"));
  const bodyRows = Math.max(tree.length, rightCol.length);
  for (let i = 0; i < bodyRows; i++) {
    const left = padEnd(" " + (tree[i] ?? ""), leftWidth);
    const right = rightCol[i] ?? "";
    out.push(left + right);
  }

  out.push("");
  out.push(c.dim(" q quit · refreshes live · in chat: /map · /hypothesis · /view"));
  return out.join("\n");
}
