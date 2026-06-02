/**
 * Parallel "mission control" board — the antidote to the linear funnel.
 *
 * Instead of one active hypothesis marching through nine sequential steps, the
 * board shows EVERY hypothesis as a card in its current pipeline lane, so many
 * advance concurrently and the parallelism is visible at a glance. Pairs with
 * the tree (which shows branching/decisions); this shows throughput.
 *
 * Pure + unit-tested.
 */
import type { Fleet, ExperimentStat } from "../monitor/fleet.js";
import type { HypothesisEntry } from "../state/repo.js";
import { deriveStage, type Stage } from "../state/stage.js";
import { bold, dim, gold, green, yellow, red, gray, byStatus } from "../tui/color.js";

export type Lane = "IDEA" | "PREREG" | "BASELINE" | "RUNNING" | "REVIEW" | "DECIDED";

export const LANES: Lane[] = ["IDEA", "PREREG", "BASELINE", "RUNNING", "REVIEW", "DECIDED"];

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

const STAGE_LANE: Record<Stage, Lane> = {
  "research-question": "IDEA",
  "preregistration": "PREREG",
  "baseline-reproduction": "BASELINE",
  "experiment-execution": "RUNNING",
  "statistical-rigor": "REVIEW",
  "falsification-review": "REVIEW",
  "kill-or-ship": "REVIEW",
  "verification-before-publication": "DECIDED",
};

/** Reconstruct the stage facts the router needs from a hypothesis + its stat. */
function factsFor(entry: HypothesisEntry, stat: ExperimentStat) {
  return {
    active: entry, spent: stat.spent,
    hasPrereg: stat.hasPrereg, hasJudgeLock: stat.hasJudgeLock, hasBaseline: stat.hasBaseline,
    hasSmokes: stat.hasSmokes, smokesSimulated: stat.hasSmokes && !(stat.hasPrereg && stat.hasJudgeLock),
    hasConfirmedResults: stat.inResults,
  };
}

/** Which lane a hypothesis belongs in right now (terminal status wins). */
export function laneOf(entry: HypothesisEntry, stat: ExperimentStat): Lane {
  if (entry.status === "CONFIRMED" || entry.status === "FALSIFIED" || entry.status === "KILLED") return "DECIDED";
  return STAGE_LANE[deriveStage(factsFor(entry, stat)).stage];
}

const LANE_GLYPH: Record<Lane, string> = {
  IDEA: "○", PREREG: "◇", BASELINE: "▭", RUNNING: "▶", REVIEW: "⚖", DECIDED: "✓",
};

function card(entry: HypothesisEntry, stat: ExperimentStat): string {
  const icon = STATUS_ICON[entry.status] ?? "?";
  const head = byStatus(entry.status, `●${icon} ${entry.id}`);
  let state = "";
  if (entry.status === "RUNNING") state = dim(`${stat.trialsDone}/${stat.trialsTotal} $${stat.spent.toFixed(0)}`);
  else if (entry.status === "CONFIRMED") state = green("shipped");
  else if (entry.status === "KILLED" || entry.status === "FALSIFIED") state = red(entry.status === "KILLED" ? "killed" : "falsified");
  else state = dim(stat.hasBaseline ? "ready" : stat.hasPrereg ? "prereg✓" : "needs prereg");
  return `   ${head}  ${state}  ${dim(entry.claim.slice(0, 34))}`;
}

/**
 * Render the fleet as parallel lanes. Only non-empty lanes are shown; each lane
 * header carries its card count so concurrency reads at a glance.
 */
export function renderBoard(fleet: Fleet): string[] {
  if (fleet.entries.length === 0) {
    return [bold(gold("Ξ parallel board")), "", dim("  no hypotheses yet — /idea to start one (or several)")];
  }
  const byId = new Map(fleet.stats.map((s) => [s.id, s]));
  const buckets: Record<Lane, string[]> = { IDEA: [], PREREG: [], BASELINE: [], RUNNING: [], REVIEW: [], DECIDED: [] };
  for (const e of fleet.entries) {
    const stat = byId.get(e.id);
    if (!stat) continue;
    buckets[laneOf(e, stat)].push(card(e, stat));
  }

  const inFlight = LANES.filter((l) => l !== "DECIDED").reduce((n, l) => n + buckets[l].length, 0);
  const lines = [
    `${bold(gold("Ξ parallel board"))}   ${yellow(`${inFlight} in flight`)} · ${green(`${fleet.shipped} shipped`)} · ${red(`${fleet.killed} killed`)}`,
    "",
  ];
  const laneColor: Record<Lane, (s: string) => string> = {
    IDEA: gray, PREREG: gold, BASELINE: gold, RUNNING: yellow, REVIEW: cyanish, DECIDED: green,
  };
  for (const lane of LANES) {
    const cards = buckets[lane];
    if (!cards.length) continue;
    lines.push(`${laneColor[lane](`${LANE_GLYPH[lane]} ${lane}`)} ${dim(`(${cards.length})`)}`);
    lines.push(...cards);
    lines.push("");
  }
  return lines;
}

// Local cyan-ish for the REVIEW lane (avoid importing the selection cyan).
function cyanish(s: string): string {
  return process.env.NO_COLOR ? s : `\x1b[38;5;51m${s}\x1b[0m`;
}

/**
 * Plain-text multi-lane summary for the system prompt: every in-flight (non-
 * terminal) hypothesis with its stage + next action, so the agent advances
 * lanes concurrently instead of serializing on one "active" hypothesis.
 * Returns [] when there's 0–1 lane (nothing parallel to coordinate).
 */
export function parallelLanesText(fleet: Fleet): string[] {
  const byId = new Map(fleet.stats.map((s) => [s.id, s]));
  const active = fleet.entries.filter(
    (e) => e.status === "OPEN" || e.status === "RUNNING",
  );
  if (active.length <= 1) return [];
  const lines = [
    `## Parallel lanes (${active.length}) — advance these concurrently; do NOT serialize on one`,
  ];
  for (const e of active) {
    const stat = byId.get(e.id);
    if (!stat) continue;
    const r = deriveStage(factsFor(e, stat));
    lines.push(`- ${e.id} [${r.stage}]: ${r.nextAction}`);
  }
  return lines;
}
