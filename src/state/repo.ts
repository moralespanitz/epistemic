import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type HypothesisStatus = "OPEN" | "RUNNING" | "FALSIFIED" | "CONFIRMED" | "KILLED";

export type ComputeTarget = "local" | "docker" | "modal";

export interface HypothesisEntry {
  id: string;
  claim: string;
  falsifier: string;
  bestCaseConclusion: string;
  n: number;
  judgeRef: string;
  baselineRef: string;
  costCap: number;
  computeTarget: ComputeTarget;
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

export type CostCategory = "llm" | "compute";

export interface CostRecord {
  timestamp: string;
  hypothesisId: string;
  toolName: string;
  estimatedCost: number;
  category: CostCategory;
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

export interface LessonEntry {
  timestamp: string;
  hypothesisId: string;
  outcome: "KILLED" | "PIVOT" | "COST_OVERRUN" | "UNREPRODUCIBLE_BASELINE";
  summary: string;
  costSpent: number;
  rootCause: string;
}

// ─── Paths ──────────────────────────────────────────────────────────

const LEDGER_PATH = ".epistemic/cost-ledger.jsonl";
const LESSONS_PATH = ".epistemic/lessons.jsonl";

// ─── Utilities ──────────────────────────────────────────────────────

async function safeRead(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8").then(s => s.trim() || null); }
  catch { return null; }
}

export async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch { return false; }
}

// ─── Repo state ─────────────────────────────────────────────────────

export async function loadRepoState(cwd: string) {
  return {
    hypotheses: await safeRead(join(cwd, "HYPOTHESES.md")),
    baselines: await safeRead(join(cwd, "BASELINES.md")),
    results: await safeRead(join(cwd, "RESULTS.md")),
    cwd,
  };
}

// ─── Hypotheses ─────────────────────────────────────────────────────

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
      current = { id: m[1], status: "OPEN", timestamp: Date.now(), computeTarget: "local" };
      continue;
    }
    const kv = line.match(/^- \*\*([\w][\w\s]*?):\*\*\s+(.+)/);
    if (kv && current) {
      const key = kv[1].toLowerCase().trim();
      const val = kv[2].trim();
      if (key === "judge" || key === "judge ref") current.judgeRef = val;
      else if (key === "baseline" || key === "baseline ref") current.baselineRef = val;
      else if (key === "claim") current.claim = val;
      else if (key === "falsifier") current.falsifier = val;
      else if (key === "best case conclusion") current.bestCaseConclusion = val;
      else if (key === "n") current.n = parseInt(val) || 30;
      else if (key === "cost cap") current.costCap = parseFloat(val) || 50;
      else if (key === "compute target") current.computeTarget = (val || "local") as ComputeTarget;
      else if (key === "status") current.status = val as HypothesisStatus;
      else if (key === "timestamp") current.timestamp = parseInt(val) || Date.now();
      else if (key === "kill reason") current.killReason = val;
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
    `- **Best case conclusion:** ${h.bestCaseConclusion}`,
    `- **N:** ${h.n}`,
    `- **Judge:** ${h.judgeRef}`,
    `- **Baseline:** ${h.baselineRef}`,
    `- **Cost cap:** ${h.costCap}`,
    `- **Compute target:** ${h.computeTarget}`,
    `- **Timestamp:** ${h.timestamp}`,
    h.killReason ? `- **Kill reason:** ${h.killReason}` : "",
  ].filter(Boolean).join("\n");
}

export async function saveHypotheses(cwd: string, entries: HypothesisEntry[]): Promise<void> {
  const path = join(cwd, "HYPOTHESES.md");
  await writeFile(path, [
    "# Hypotheses\n\nEvery hypothesis registered via epistemic. Includes claim, falsifier, judge, baseline, cost cap, compute target, and best-case conclusion.\n",
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

// ─── Baselines ──────────────────────────────────────────────────────

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
    const kv = line.match(/^- \*\*(\w+):\*\*\s+(.+)/);
    if (kv && current) {
      const key = kv[1].toLowerCase();
      const val = kv[2].trim();
      if (key === "score") current.score = parseFloat(val);
      else if (key === "retrieved") current.retrieved = val;
      else (current as any)[key] = val;
    }
  }
  if (current.name) entries.push(current as BaselineEntry);
  return entries;
}

export function getBaselineAgeDays(b: BaselineEntry): number {
  return (Date.now() - new Date(b.retrieved).getTime()) / (1000 * 60 * 60 * 24);
}

// ─── Cost ledger ────────────────────────────────────────────────────

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

export async function getHypothesisSpendByCategory(
  cwd: string,
  hypothesisId: string
): Promise<{ llm: number; compute: number }> {
  const result = { llm: 0, compute: 0 };
  try {
    const data = await readFile(join(cwd, LEDGER_PATH), "utf8");
    for (const line of data.split("\n").filter(Boolean)) {
      try {
        const r = JSON.parse(line) as CostRecord;
        if (r.hypothesisId === hypothesisId) {
          result[r.category] += r.estimatedCost;
        }
      } catch {}
    }
  } catch {}
  return result;
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

// ─── Judge lock ─────────────────────────────────────────────────────

export function computeJudgeHash(judgeRef: string, hypothesisId: string): string {
  return createHash("sha256").update(`${judgeRef}:${hypothesisId}`).digest("hex");
}

export function computeEnvironmentHash(dockerfilePath: string, requirementsPath: string): string {
  return createHash("sha256")
    .update(`${dockerfilePath}:${requirementsPath}`)
    .digest("hex");
}

export async function getJudgeLock(cwd: string, hypothesisId: string): Promise<string | null> {
  const path = join(cwd, "experiments", hypothesisId, "judge.lock");
  if (!(await fileExists(path))) return null;
  return (await readFile(path, "utf8")).trim();
}

export async function getEnvironmentLock(cwd: string, hypothesisId: string): Promise<string | null> {
  const path = join(cwd, "experiments", hypothesisId, "environment.lock");
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

// ─── Cross-run lessons ──────────────────────────────────────────────

export async function loadLessons(cwd: string): Promise<LessonEntry[]> {
  const content = await safeRead(join(cwd, LESSONS_PATH));
  if (!content) return [];
  const lessons: LessonEntry[] = [];
  for (const line of content.split("\n")) {
    try {
      const entry = JSON.parse(line) as LessonEntry;
      lessons.push(entry);
    } catch {}
  }
  return lessons;
}

export async function appendLesson(cwd: string, lesson: LessonEntry): Promise<void> {
  const dir = join(cwd, ".epistemic");
  await mkdir(dir, { recursive: true });
  await writeFile(join(cwd, LESSONS_PATH), JSON.stringify(lesson) + "\n", { flag: "a" });
}

export function summarizeLessons(lessons: LessonEntry[]): string {
  if (!lessons.length) return "No cross-run lessons recorded yet.";
  const recent = lessons.slice(-10);
  const byOutcome: Record<string, number> = {};
  for (const l of recent) {
    byOutcome[l.outcome] = (byOutcome[l.outcome] ?? 0) + 1;
  }
  const lines = ["## Cross-run lessons (last 10)"];
  for (const l of recent.slice(-5)) {
    lines.push(`- [${l.outcome}] ${l.hypothesisId}: ${l.rootCause.slice(0, 120)}`);
  }
  if (Object.keys(byOutcome).length > 0) {
    lines.push("");
    lines.push("### Outcome distribution");
    for (const [outcome, count] of Object.entries(byOutcome)) {
      lines.push(`- ${outcome}: ${count}`);
    }
  }
  return lines.join("\n");
}