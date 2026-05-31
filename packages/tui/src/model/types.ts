import type { ComputeTarget, HypothesisStatus, LessonEntry } from "../epistemic-state.js";

export type { ComputeTarget };

/** Which view fills the main pane. "chat" is the default, conversational view. */
export type LensName = "chat" | "tree" | "missions" | "focus";

/** One line of the conversation. */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

export type RunStatus = "pending" | "running" | "done" | "failed" | "killed";

export interface TelemetryPoint {
  trial: number;
  total: number;
  cost: number;
  acc?: number;
  t: number;
}

export interface ExperimentRun {
  id: string; // hypothesis id
  status: RunStatus;
  trialsDone: number;
  trialsTotal: number;
  costSeries: number[];
  accSeries: number[];
  spent: number;
  costCap: number;
}

/** A conditional plan: "if <condition> → <ifTrue>, else → <ifFalse>". */
export interface ConditionalPlan {
  condition: string;
  ifTrue: string;
  ifFalse: string;
}

export interface HypothesisNode {
  id: string;
  claim: string;
  status: HypothesisStatus;
  computeTarget: ComputeTarget;
  costCap: number;
  spent: number;
  parentId?: string;
  childIds: string[];
  alternativeIds: string[];
  conditionalPlan?: ConditionalPlan;
  killReason?: string;
}

export interface ResearchWorld {
  nodes: HypothesisNode[];
  runs: ExperimentRun[];
  lessons: LessonEntry[];
  totalSpent: number;
  totalCap: number;
}

/** Raw filesystem inputs assembled by StateStore, consumed by buildWorld. */
export interface WorldInputs {
  hypothesesContent: string; // raw HYPOTHESES.md (for edge parsing)
  spends: Record<string, number>;
  lessons: LessonEntry[];
  /** per-hypothesis-id: parsed telemetry points (may be empty) */
  telemetry: Record<string, TelemetryPoint[]>;
  /** per-hypothesis-id: run-status.json contents (may be absent) */
  runStatus: Record<string, { status: RunStatus; exit?: number }>;
  /** per-hypothesis-id: list of archived alternative names */
  alternatives: Record<string, string[]>;
}
