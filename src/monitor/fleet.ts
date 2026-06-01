/**
 * Read-only fleet state for the epistemic monitor — assembled from the same
 * files the agent writes. No mutation: the monitor is a companion to the real
 * omp chat, never a replacement.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadHypotheses, getHypothesisSpend, type HypothesisEntry } from "../state/repo.js";

export interface ExperimentStat {
  id: string;
  claim: string;
  status: HypothesisEntry["status"];
  computeTarget: HypothesisEntry["computeTarget"];
  trialsDone: number;
  trialsTotal: number;
  costSeries: number[];
  accSeries: number[];
  spent: number;
  costCap: number;
}

export interface Fleet {
  entries: HypothesisEntry[];
  hypothesesContent: string;
  stats: ExperimentStat[];
  totalSpent: number;
  totalCap: number;
  running: number;
  shipped: number;
  killed: number;
}

async function safeRead(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch { return null; }
}

/** Read live fleet state from the research repo at `cwd`. */
export async function loadFleet(cwd: string): Promise<Fleet> {
  const entries = await loadHypotheses(cwd);
  const hypothesesContent = (await safeRead(join(cwd, "HYPOTHESES.md"))) ?? "";

  const stats: ExperimentStat[] = [];
  for (const e of entries) {
    const spent = await getHypothesisSpend(cwd, e.id);
    const tel = await safeRead(join(cwd, "experiments", e.id, "smokes", "telemetry.jsonl"));
    const points = tel
      ? tel.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[]
      : [];
    const last = points[points.length - 1];
    stats.push({
      id: e.id,
      claim: e.claim,
      status: e.status,
      computeTarget: e.computeTarget,
      trialsDone: last?.trial ?? 0,
      trialsTotal: last?.total ?? e.n ?? 0,
      costSeries: points.map((p) => p.cost).filter((c) => typeof c === "number"),
      accSeries: points.map((p) => p.acc).filter((a) => typeof a === "number"),
      spent,
      costCap: e.costCap,
    });
  }

  return {
    entries,
    hypothesesContent,
    stats,
    totalSpent: stats.reduce((s, x) => s + x.spent, 0),
    totalCap: stats.reduce((s, x) => s + x.costCap, 0),
    running: entries.filter((e) => e.status === "RUNNING").length,
    shipped: entries.filter((e) => e.status === "CONFIRMED").length,
    killed: entries.filter((e) => e.status === "KILLED").length,
  };
}
