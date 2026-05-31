import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type HypothesisStatus = "OPEN" | "RUNNING" | "FALSIFIED" | "CONFIRMED" | "KILLED";

export interface HypothesisEntry {
  id: string;
  claim: string;
  falsifier: string;
  n: number;
  judgeRef: string;
  baselineRef: string;
  costCap: number;
  status: HypothesisStatus;
  timestamp: number;
  killReason?: string;
  treeNodeId?: string;
}

export interface BaselineEntry {
  name: string;
  url: string;
  score: number;
  judge: string;
  version: string;
  retrieved: string;
}

export interface CostRecord {
  timestamp: string;
  hypothesisId: string;
  toolName: string;
  estimatedCost: number;
  isError: boolean;
}

export interface AdversaryVerdict {
  provider: string;
  model: string;
  name: string;
  experiment: string;
  costEstimate: number;
  verdict: "defensible" | "caveat-required" | "falsified-or-unreproducible" | "cannot-audit";
  reasoning: string;
}

export interface ExperimentNode {
  id: string;
  hypothesisRef: string;
  description: string;
  status: "pending" | "running" | "passed" | "failed" | "blocked";
  dependsOn: string[];
  costEstimate: number;
  estimatedDuration: string;
  isProvisional: boolean;
  decisionRules: Array<{ condition: string; ifTrue: string; ifFalse: string }>;
}

const LEDGER_PATH = ".epistemic/cost-ledger.jsonl";

async function safeRead(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8").then(s => s.trim() || null); }
  catch { return null; }
}

export async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch { return false; }
}

export async function loadRepoState(cwd: string) {
  return {
    hypotheses: await safeRead(join(cwd, "HYPOTHESES.md")),
    baselines: await safeRead(join(cwd, "BASELINES.md")),
    results: await safeRead(join(cwd, "RESULTS.md")),
    cwd,
  };
}

export async function loadHypotheses(cwd: string): Promise<HypothesisEntry[]> {
  const content = await safeRead(join(cwd, "HYPOTHESES.md"));
  return content ? parseHypotheses(content) : [];
}

export function parseHypotheses(content: string): HypothesisEntry[] {
  const entries: HypothesisEntry[] = [];
  let current: Partial<HypothesisEntry> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^## Hypothesis: (.+)/);
    if (m) {
      if (current.id) entries.push(current as HypothesisEntry);
      current = { id: m[1], status: "OPEN", timestamp: Date.now() };
      continue;
    }
    const kv = line.match(/^- \*\*(\w+):\*\* (.+)/);
    if (kv && current) {
      const key = kv[1].toLowerCase();
      const jfKey = key === "judge" ? "judgeRef" : key === "baseline" ? "baselineRef" : key;
      if (jfKey === "n") (current as any)[jfKey] = parseInt(kv[2]) || 30;
      else if (jfKey === "cost cap") (current as any).costCap = parseFloat(kv[2]) || 50;
      else if (jfKey === "timestamp") (current as any).timestamp = parseInt(kv[2]) || Date.now();
      else if (jfKey === "status") (current as any).status = kv[2] as HypothesisStatus;
      else if (jfKey === "kill reason") (current as any).killReason = kv[2];
      else (current as any)[jfKey] = kv[2];
    }
  }
  if (current.id) entries.push(current as HypothesisEntry);
  return entries;
}

export function getActiveHypothesis(entries: HypothesisEntry[]): HypothesisEntry | undefined {
  return entries.find(e => e.status === "OPEN" || e.status === "RUNNING");
}

export function hypothesisToMarkdown(h: HypothesisEntry): string {
  return [
    `## Hypothesis: ${h.id}`,
    `- **Status:** ${h.status}`,
    `- **Claim:** ${h.claim}`,
    `- **Falsifier:** ${h.falsifier}`,
    `- **N:** ${h.n}`,
    `- **Judge:** ${h.judgeRef}`,
    `- **Baseline:** ${h.baselineRef}`,
    `- **Cost cap:** ${h.costCap}`,
    `- **Timestamp:** ${h.timestamp}`,
    h.killReason ? `- **Kill reason:** ${h.killReason}` : "",
  ].filter(Boolean).join("\n");
}

export async function saveHypotheses(cwd: string, entries: HypothesisEntry[]): Promise<void> {
  const path = join(cwd, "HYPOTHESES.md");
  await writeFile(path, [
    "# Hypotheses\n\nEvery hypothesis registered via epistemic. Each entry includes claim, falsifier, n, judge, baseline, and cost cap.\n",
    ...entries.map(hypothesisToMarkdown),
  ].join("\n"), "utf8");
}

export async function updateHypothesisStatus(cwd: string, id: string, status: HypothesisStatus): Promise<void> {
  const entries = await loadHypotheses(cwd);
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.status = status;
    await saveHypotheses(cwd, entries);
  }
}

export async function loadBaselines(cwd: string): Promise<BaselineEntry[]> {
  const content = await safeRead(join(cwd, "BASELINES.md"));
  if (!content) return [];
  const entries: BaselineEntry[] = [];
  let current: Partial<BaselineEntry> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^## Baseline: (.+)/);
    if (m) {
      if (current.name) entries.push(current as BaselineEntry);
      current = { name: m[1] };
      continue;
    }
    const kv = line.match(/^- \*\*(\w+):\*\* (.+)/);
    if (kv && current) {
      const key = kv[1].toLowerCase();
      if (key === "score") current.score = parseFloat(kv[2]);
      else if (key === "retrieved") current.retrieved = kv[2];
      else (current as any)[key] = kv[2];
    }
  }
  if (current.name) entries.push(current as BaselineEntry);
  return entries;
}

export function getBaselineAgeDays(b: BaselineEntry): number {
  return (Date.now() - new Date(b.retrieved).getTime()) / (1000 * 60 * 60 * 24);
}

export async function getHypothesisSpend(cwd: string, hypothesisId: string): Promise<number> {
  try {
    const data = await readFile(join(cwd, LEDGER_PATH), "utf8");
    let total = 0;
    for (const line of data.split("\n").filter(Boolean)) {
      try {
        const r = JSON.parse(line) as CostRecord;
        if (r.hypothesisId === hypothesisId) total += r.estimatedCost;
      } catch {}
    }
    return total;
  } catch { return 0; }
}

export async function getAllHypothesisSpends(cwd: string): Promise<Record<string, number>> {
  const spends: Record<string, number> = {};
  try {
    const data = await readFile(join(cwd, LEDGER_PATH), "utf8");
    for (const line of data.split("\n").filter(Boolean)) {
      try {
        const r = JSON.parse(line) as CostRecord;
        spends[r.hypothesisId] = (spends[r.hypothesisId] ?? 0) + r.estimatedCost;
      } catch {}
    }
  } catch {}
  return spends;
}

export async function appendCostRecord(cwd: string, record: CostRecord): Promise<void> {
  const dir = join(cwd, ".epistemic");
  await mkdir(dir, { recursive: true });
  await writeFile(join(cwd, LEDGER_PATH), JSON.stringify(record) + "\n", { flag: "a" });
}

export function computeJudgeHash(judgeRef: string, hypothesisId: string): string {
  return createHash("sha256").update(`${judgeRef}:${hypothesisId}`).digest("hex");
}

export async function getJudgeLock(cwd: string, hypothesisId: string): Promise<string | null> {
  const path = join(cwd, "experiments", hypothesisId, "judge.lock");
  if (!(await fileExists(path))) return null;
  return (await readFile(path, "utf8")).trim();
}

export async function writeJudgeLock(cwd: string, hypothesisId: string, judgeRef: string): Promise<string> {
  const hash = computeJudgeHash(judgeRef, hypothesisId);
  const dir = join(cwd, "experiments", hypothesisId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "judge.lock"), hash, "utf8");
  return hash;
}
