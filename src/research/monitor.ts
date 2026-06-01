/**
 * In-chat mission-control dashboard — styled like the `claude agents` view:
 * a header with counts, then hypotheses grouped into Needs input / Working /
 * Completed, each a row of name · description · age. Rendered as an omp widget
 * (plain text) so you flip to it with /monitor and back with /monitor off.
 */
import type { Fleet, ExperimentStat } from "../monitor/fleet.js";
import type { HypothesisEntry } from "../state/repo.js";

function age(ts: number, now: number): string {
  const ms = now - ts;
  if (!ts || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function shortHome(cwd: string): string {
  const home = process.env.HOME;
  return home && cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;
}

function describe(e: HypothesisEntry, stat?: ExperimentStat): string {
  switch (e.status) {
    case "OPEN": return "awaiting preregistration";
    case "RUNNING": return `running ${stat?.trialsDone ?? 0}/${stat?.trialsTotal ?? e.n} · $${(stat?.spent ?? 0).toFixed(0)}`;
    case "FALSIFIED": return "needs triage — result diverged";
    case "CONFIRMED": return "shipped — falsification clean";
    case "KILLED": return `killed — ${e.killReason ?? "below criteria"}`;
    default: return e.status;
  }
}

function row(marker: string, e: HypothesisEntry, desc: string, when: string): string {
  const name = `${e.id}  ${e.claim.slice(0, 22)}`.padEnd(30);
  return `${marker} ${name} ${desc.padEnd(38)} ${when}`;
}

/** Render the claude-agents-style dashboard as widget lines. `now` = Date.now(). */
export function renderMonitorWidget(fleet: Fleet, cwd = process.cwd(), now = Date.now()): string[] {
  const statById = new Map(fleet.stats.map((s) => [s.id, s]));

  const needsInput = fleet.entries.filter((e) => e.status === "OPEN" || e.status === "FALSIFIED");
  const working = fleet.entries.filter((e) => e.status === "RUNNING");
  const completed = fleet.entries.filter((e) => e.status === "CONFIRMED" || e.status === "KILLED");

  const lines: string[] = [];
  lines.push(`Ξ epistemic · research agent · ${shortHome(cwd)}`);
  lines.push(`${needsInput.length} awaiting input · ${working.length} working · ${completed.length} completed   ($${fleet.totalSpent.toFixed(2)}/$${fleet.totalCap})`);

  if (needsInput.length) {
    lines.push("");
    lines.push("Needs input");
    for (const e of needsInput) lines.push(row("*", e, describe(e, statById.get(e.id)), age(e.timestamp, now)));
  }
  if (working.length) {
    lines.push("");
    lines.push("Working");
    for (const e of working) lines.push(row("*", e, describe(e, statById.get(e.id)), age(e.timestamp, now)));
  }
  if (completed.length) {
    lines.push("");
    lines.push("Completed");
    for (const e of completed) lines.push(row("•", e, describe(e, statById.get(e.id)), age(e.timestamp, now)));
  }
  if (!needsInput.length && !working.length && !completed.length) {
    lines.push("");
    lines.push("  no hypotheses yet — describe a research idea to begin");
  }

  lines.push("");
  lines.push("/hypothesis open · /map tree · /monitor off · /view cycle");
  return lines;
}
