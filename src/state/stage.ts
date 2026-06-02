/**
 * Pipeline-stage derivation — the "you are here → do X next" router.
 *
 * The methodology lives in the skills; this module tells the agent which skill
 * is next and what's inconsistent, so a "continue" / "proceed" turn is
 * deterministic instead of re-derived from scratch every session (and so it
 * doesn't depend on the model being strong enough to reconstruct the protocol).
 *
 * Pure and unit-tested: takes already-gathered facts, returns a report. No I/O.
 */
import type { HypothesisEntry } from "./repo.js";

/** Everything the router needs, gathered from disk by the caller. */
export interface StageFacts {
  active: HypothesisEntry;
  spent: number;
  hasPrereg: boolean;          // experiments/<id>/prereg.md
  hasJudgeLock: boolean;       // experiments/<id>/judge.lock
  hasBaseline: boolean;        // baseline named by the hypothesis is reproduced
  hasSmokes: boolean;          // experiments/<id>/smokes has any data
  smokesSimulated: boolean;    // smoke data is marked simulated (stub, not a real run)
  hasConfirmedResults: boolean; // RESULTS.md references this hypothesis
}

/** Ordered pipeline — used for display and to name the next skill. */
export const PIPELINE = [
  "research-question",
  "preregistration",
  "baseline-reproduction",
  "experiment-execution",
  "statistical-rigor",
  "falsification-review",
  "kill-or-ship",
  "verification-before-publication",
] as const;

export type Stage = (typeof PIPELINE)[number];

export interface StageReport {
  stage: Stage;
  nextSkill: Stage;
  nextAction: string;
  anomalies: string[];
}

/**
 * Detect state that contradicts the protocol — surfaced so ANY model sees it
 * without having to deduce it by hand (the failure mode in the transcript:
 * status RUNNING with no prereg, spend logged before prereg existed).
 */
export function detectAnomalies(f: StageFacts): string[] {
  const a: string[] = [];
  const { active, spent } = f;

  if (active.status === "RUNNING" && !f.hasPrereg)
    a.push("Status is RUNNING but no prereg.md exists — preregistration was skipped (protocol breach).");

  if (spent > 0 && !f.hasPrereg)
    a.push(`Spend ($${spent.toFixed(2)}) logged before preregistration exists — reconcile or kill before claiming anything.`);

  if (f.hasSmokes && !f.hasPrereg)
    a.push("Smoke data exists before preregistration — it cannot back any claim; treat as scratch only.");

  if (f.hasSmokes && f.smokesSimulated)
    a.push("smokes/ data is marked SIMULATED (stub, not a real run) — do not report it as a result.");

  if (f.hasJudgeLock && !f.hasPrereg)
    a.push("judge.lock exists without prereg.md — broken/partial preregistration state.");

  if (active.costCap > 0 && spent > active.costCap * 1.5)
    a.push(`Spend ($${spent.toFixed(2)}) exceeds 1.5× the cost cap ($${active.costCap}) — kill criteria met; run kill-or-ship.`);

  if (active.status === "CONFIRMED" && !f.hasConfirmedResults)
    a.push("Status is CONFIRMED but RESULTS.md has no entry for it — confirm the result is actually recorded.");

  return a;
}

/** Derive the current pipeline stage + the next skill to run. */
export function deriveStage(f: StageFacts): StageReport {
  const { active } = f;
  const anomalies = detectAnomalies(f);

  let stage: Stage;
  let nextAction: string;

  if (active.status === "CONFIRMED" || active.status === "FALSIFIED") {
    stage = "verification-before-publication";
    nextAction = `${active.id} is ${active.status}. Run /skill:verification-before-publication before anything reaches a headline file.`;
  } else if (active.status === "KILLED") {
    stage = "kill-or-ship";
    nextAction = `${active.id} is KILLED. Record the lesson, then pick the next OPEN hypothesis (or pre-register a new one).`;
  } else if (!f.hasPrereg) {
    // OPEN or RUNNING with no contract → must (re)preregister.
    stage = "preregistration";
    nextAction = active.status === "RUNNING"
      ? `${active.id} is marked RUNNING but has no valid preregistration. Run /skill:preregistration to repair it, OR kill it and start clean. Do not treat existing smokes/ as results.`
      : `${active.id} has no preregistration. Run /skill:preregistration to lock claim, falsifier, judge, baseline, and cost cap before any experiment work.`;
  } else if (!f.hasJudgeLock) {
    stage = "preregistration";
    nextAction = `${active.id} has prereg.md but no judge.lock — preregistration is incomplete. Finish /skill:preregistration to pin the judge.`;
  } else if (!f.hasBaseline) {
    stage = "baseline-reproduction";
    nextAction = `Preregistration is locked. Reproduce the baseline "${active.baselineRef}" under the pinned judge before comparing — run /skill:baseline-reproduction.`;
  } else if (!f.hasConfirmedResults) {
    stage = "experiment-execution";
    nextAction = `Baseline is reproduced. Run /skill:experiment-execution to run the ${active.n} trials on ${active.computeTarget}, then /skill:statistical-rigor and /skill:falsification-review.`;
  } else {
    stage = "kill-or-ship";
    nextAction = `Results are in. Run /skill:falsification-review then /skill:kill-or-ship to decide ship vs. kill against the preregistered falsifier.`;
  }

  return { stage, nextSkill: stage, nextAction, anomalies };
}

/** Render the report as the markdown block injected into the system prompt. */
export function renderStageBlock(r: StageReport): string {
  const lines = [`## Epistemic — current position`, `Pipeline stage: ${r.stage}`, ``];
  if (r.anomalies.length) {
    lines.push(`⚠️ STATE INCONSISTENCY (resolve before proceeding):`);
    for (const a of r.anomalies) lines.push(`  - ${a}`);
    lines.push(``);
  }
  lines.push(`→ NEXT ACTION: ${r.nextAction}`);
  return lines.join("\n");
}
