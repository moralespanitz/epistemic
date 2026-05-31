// Single chokepoint for importing the existing extension's state parsers.
// The relative path crosses into the root package's src/. repo.ts depends only
// on node builtins (node:fs, node:path, node:crypto), so no shared third-party
// deps are needed. Do NOT modify repo.ts; only import from it here.

// Only read-only dashboard queries are exported here. Write helpers (appendCostRecord,
// saveHypotheses, etc.) are intentionally omitted — the TUI never writes state directly.
export {
  loadHypotheses,
  getAllHypothesisSpends,
  loadLessons,
  loadBaselines,
} from "../../../src/state/repo.js";

export type {
  HypothesisEntry,
  HypothesisStatus,
  ComputeTarget,
  LessonEntry,
  BaselineEntry,
} from "../../../src/state/repo.js";
