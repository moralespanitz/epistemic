# Epistemic Cockpit Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a spatial research cockpit (Ink TUI) that renders epistemic's research program as navigable lenses, launches/kills parallel experiments, and summons a context-aware agent — without modifying the existing extension.

**Architecture:** A self-contained `packages/tui/` package. The filesystem is the single source of truth: keystrokes trigger commands that write to disk (experiment jobs via `child_process`, agent via `omp -p`), a chokidar watcher rebuilds a pure `ResearchWorld` model, and Ink re-renders. State parsers are reused from the root `src/state/repo.ts` via a single relative-import shim (`repo.ts` uses only node builtins, so no shared third-party deps).

**Tech Stack:** TypeScript (ESM), Ink v5 + React 18, chokidar v4, vitest + ink-testing-library, tsx as the zero-build runner. No native modules.

---

## File Structure

```
packages/tui/
  package.json                 # own deps, bin: epistemic-tui
  tsconfig.json                # jsx react-jsx, bundler resolution
  vitest.config.ts
  bin/epistemic-tui.mjs        # node shim → tsx src/main.tsx
  src/
    epistemic-state.ts         # SHIM: re-exports parsers/types from root src/state/repo.ts
    model/
      types.ts                 # ResearchWorld, HypothesisNode, ExperimentRun, RunStatus, TelemetryPoint
      build-world.ts           # pure: inputs → ResearchWorld
      parse-edges.ts           # pure: HYPOTHESES.md → parent edges
    primitives/
      sparkline.ts             # pure: number[] → unicode
      cost-bar.ts              # pure: (spent,cap) → string
      tree-lines.ts            # pure: nodes → string[] (ASCII tree)
    state-store.ts             # chokidar watch → buildWorld → emit
    experiment-runner.ts       # spawn/kill by computeTarget, telemetry → smokes/
    agent-bridge.ts            # omp -p --continue, context-aware
    commands.ts                # command registry (verbs)
    ui/
      StatusFooter.tsx
      Inspector.tsx
      LensMissions.tsx
      LensTree.tsx
      LensFocus.tsx
      CommandBar.tsx
      App.tsx                  # keyboard routing, lens switching, wiring
    main.tsx                   # entry: boot store+runner+bridge, render <App>
  test/
    fixtures.ts                # writes temp epistemic repos
    *.test.ts(x)
```

**Telemetry protocol (the runner↔store contract):** an experiment job prints lines to stdout:
- `TRIAL <done>/<total>`
- `COST <usd>`
- `ACC <value>`

The runner parses these and appends `{trial,total,cost,acc,t}` objects to `experiments/{id}/smokes/telemetry.jsonl`, and writes `experiments/{id}/smokes/run-status.json` (`{"status":"running|done|failed|killed","exit":<code>}`). The store reads both back. This keeps `WorldModel` pure and filesystem-derived.

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/tui/package.json`
- Create: `packages/tui/tsconfig.json`
- Create: `packages/tui/vitest.config.ts`
- Create: `packages/tui/src/epistemic-state.ts`
- Test: `packages/tui/test/shim.test.ts`

- [ ] **Step 1: Create `packages/tui/package.json`**

```json
{
  "name": "@epistemic/tui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "epistemic-tui": "./bin/epistemic-tui.mjs" },
  "scripts": {
    "dev": "tsx src/main.tsx",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chokidar": "^4.0.3",
    "ink": "^5.1.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "ink-testing-library": "^4.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `packages/tui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "test/**/*", "bin/**/*"]
}
```

- [ ] **Step 3: Create `packages/tui/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: Create the state shim `packages/tui/src/epistemic-state.ts`**

```ts
// Single chokepoint for importing the existing extension's state parsers.
// The relative path crosses into the root package's src/. repo.ts depends only
// on node builtins (node:fs, node:path, node:crypto), so no shared third-party
// deps are needed. Do NOT modify repo.ts; only import from it here.
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
```

- [ ] **Step 5: Write the shim smoke test `packages/tui/test/shim.test.ts`**

```ts
import { expect, test } from "vitest";
import { loadHypotheses } from "../src/epistemic-state.ts";

test("shim re-exports loadHypotheses as a function", () => {
  expect(typeof loadHypotheses).toBe("function");
});

test("loadHypotheses on an empty dir returns []", async () => {
  const result = await loadHypotheses("/nonexistent-dir-xyz");
  expect(result).toEqual([]);
});
```

- [ ] **Step 6: Install deps and run the test**

Run:
```bash
cd packages/tui && npm install && npm test
```
Expected: both tests PASS. (If `npm install` warns about peer deps, that's fine.)

- [ ] **Step 7: Commit**

```bash
git add packages/tui/package.json packages/tui/tsconfig.json packages/tui/vitest.config.ts packages/tui/src/epistemic-state.ts packages/tui/test/shim.test.ts
git commit -m "feat(tui): scaffold cockpit package with state shim"
```

---

## Task 2: WorldModel types and pure derivation

**Files:**
- Create: `packages/tui/src/model/types.ts`
- Create: `packages/tui/src/model/parse-edges.ts`
- Create: `packages/tui/src/model/build-world.ts`
- Test: `packages/tui/test/build-world.test.ts`

- [ ] **Step 1: Create `packages/tui/src/model/types.ts`**

```ts
import type { ComputeTarget, HypothesisStatus, LessonEntry } from "../epistemic-state.ts";

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
```

- [ ] **Step 2: Write the failing test `packages/tui/test/build-world.test.ts`**

```ts
import { expect, test } from "vitest";
import { parseParentEdges } from "../src/model/parse-edges.ts";
import { buildWorld } from "../src/model/build-world.ts";
import type { HypothesisEntry } from "../src/epistemic-state.ts";

const HMD = `# Hypotheses

## Hypothesis: H-001
- **Status:** CONFIRMED
- **Claim:** LoRA improves accuracy
- **Cost cap:** 50

## Hypothesis: H-004
- **Status:** RUNNING
- **Claim:** scale to 7B
- **Parent:** H-001
- **Cost cap:** 80
`;

function entry(p: Partial<HypothesisEntry>): HypothesisEntry {
  return {
    id: "X", claim: "c", falsifier: "f", bestCaseConclusion: "b", n: 30,
    judgeRef: "j", baselineRef: "base", costCap: 50, computeTarget: "local",
    status: "OPEN", timestamp: 0, ...p,
  };
}

test("parseParentEdges extracts child→parent map", () => {
  const edges = parseParentEdges(HMD);
  expect(edges.get("H-004")).toBe("H-001");
  expect(edges.has("H-001")).toBe(false);
});

test("buildWorld links parent/child and derives run status", () => {
  const entries = [
    entry({ id: "H-001", status: "CONFIRMED", costCap: 50 }),
    entry({ id: "H-004", status: "RUNNING", costCap: 80 }),
  ];
  const world = buildWorld(entries, {
    hypothesesContent: HMD,
    spends: { "H-001": 20, "H-004": 12 },
    lessons: [],
    telemetry: { "H-004": [{ trial: 18, total: 30, cost: 12, acc: 0.81, t: 1 }] },
    runStatus: { "H-004": { status: "running" } },
    alternatives: { "H-001": ["qlora"] },
  });

  const h1 = world.nodes.find((n) => n.id === "H-001")!;
  const h4 = world.nodes.find((n) => n.id === "H-004")!;
  expect(h1.childIds).toContain("H-004");
  expect(h4.parentId).toBe("H-001");
  expect(h1.alternativeIds).toEqual(["qlora"]);

  const run = world.runs.find((r) => r.id === "H-004")!;
  expect(run.status).toBe("running");
  expect(run.trialsDone).toBe(18);
  expect(run.accSeries).toEqual([0.81]);
  expect(world.totalSpent).toBe(32);
  expect(world.totalCap).toBe(130);
});

test("buildWorld defaults run status to pending when no run-status file", () => {
  const entries = [entry({ id: "H-009", status: "OPEN" })];
  const world = buildWorld(entries, {
    hypothesesContent: "", spends: {}, lessons: [],
    telemetry: {}, runStatus: {}, alternatives: {},
  });
  expect(world.runs.find((r) => r.id === "H-009")!.status).toBe("pending");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/build-world.test.ts`
Expected: FAIL — cannot find `../src/model/parse-edges.ts`.

- [ ] **Step 4: Create `packages/tui/src/model/parse-edges.ts`**

```ts
/** Parse "- **Parent:** <id>" fields under each "## Hypothesis: <id>" heading. */
export function parseParentEdges(content: string): Map<string, string> {
  const edges = new Map<string, string>();
  let current: string | null = null;
  for (const line of content.split("\n")) {
    const h = line.match(/^## Hypothesis: (.+)/);
    if (h) {
      current = h[1].trim();
      continue;
    }
    const p = line.match(/^- \*\*Parent:\*\*\s+(.+)/i);
    if (p && current) edges.set(current, p[1].trim());
  }
  return edges;
}
```

- [ ] **Step 5: Create `packages/tui/src/model/build-world.ts`**

```ts
import type { HypothesisEntry } from "../epistemic-state.ts";
import type {
  ExperimentRun, HypothesisNode, ResearchWorld, RunStatus, WorldInputs,
} from "./types.ts";
import { parseParentEdges } from "./parse-edges.ts";

function deriveRunStatus(
  id: string,
  inputs: WorldInputs,
  points: { trial: number; total: number }[],
): RunStatus {
  const explicit = inputs.runStatus[id]?.status;
  if (explicit) return explicit;
  const last = points[points.length - 1];
  if (last && last.total > 0 && last.trial >= last.total) return "done";
  return "pending";
}

export function buildWorld(entries: HypothesisEntry[], inputs: WorldInputs): ResearchWorld {
  const edges = parseParentEdges(inputs.hypothesesContent);

  const nodes: HypothesisNode[] = entries.map((e) => ({
    id: e.id,
    claim: e.claim,
    status: e.status,
    computeTarget: e.computeTarget,
    costCap: e.costCap,
    spent: inputs.spends[e.id] ?? 0,
    parentId: edges.get(e.id),
    childIds: [],
    alternativeIds: inputs.alternatives[e.id] ?? [],
    killReason: e.killReason,
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.childIds.push(n.id);
  }

  const runs: ExperimentRun[] = entries.map((e) => {
    const points = inputs.telemetry[e.id] ?? [];
    const last = points[points.length - 1];
    return {
      id: e.id,
      status: deriveRunStatus(e.id, inputs, points),
      trialsDone: last?.trial ?? 0,
      trialsTotal: last?.total ?? e.n,
      costSeries: points.map((p) => p.cost),
      accSeries: points.filter((p) => p.acc !== undefined).map((p) => p.acc as number),
      spent: inputs.spends[e.id] ?? 0,
      costCap: e.costCap,
    };
  });

  return {
    nodes,
    runs,
    lessons: inputs.lessons,
    totalSpent: nodes.reduce((s, n) => s + n.spent, 0),
    totalCap: nodes.reduce((s, n) => s + n.costCap, 0),
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/build-world.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/tui/src/model packages/tui/test/build-world.test.ts
git commit -m "feat(tui): pure WorldModel types and buildWorld derivation"
```

---

## Task 3: Pure UI primitives

**Files:**
- Create: `packages/tui/src/primitives/sparkline.ts`
- Create: `packages/tui/src/primitives/cost-bar.ts`
- Create: `packages/tui/src/primitives/tree-lines.ts`
- Test: `packages/tui/test/primitives.test.ts`

- [ ] **Step 1: Write the failing test `packages/tui/test/primitives.test.ts`**

```ts
import { expect, test } from "vitest";
import { sparkline } from "../src/primitives/sparkline.ts";
import { costBar } from "../src/primitives/cost-bar.ts";
import { treeLines } from "../src/primitives/tree-lines.ts";
import type { HypothesisNode } from "../src/model/types.ts";

test("sparkline maps a flat series to a single repeated block", () => {
  expect(sparkline([5, 5, 5])).toBe("▁▁▁");
});

test("sparkline scales min→max across the block ramp", () => {
  expect(sparkline([0, 7])).toBe("▁█");
});

test("sparkline returns empty string for empty input", () => {
  expect(sparkline([])).toBe("");
});

test("costBar shows filled proportion and percent", () => {
  expect(costBar(16, 50, 8)).toBe("[████░░░░ 32%]");
});

test("costBar clamps over-cap to 100%", () => {
  expect(costBar(80, 50, 4)).toBe("[████ 100%]");
});

function node(p: Partial<HypothesisNode>): HypothesisNode {
  return {
    id: "X", claim: "c", status: "OPEN", computeTarget: "local",
    costCap: 50, spent: 0, childIds: [], alternativeIds: [], ...p,
  };
}

test("treeLines renders roots and indented children", () => {
  const nodes = [
    node({ id: "H-001", status: "CONFIRMED", childIds: ["H-004"] }),
    node({ id: "H-004", status: "RUNNING", parentId: "H-001" }),
  ];
  const lines = treeLines(nodes, "H-004");
  expect(lines[0]).toContain("H-001");
  expect(lines[1]).toContain("H-004");
  expect(lines[1]).toMatch(/^\s+/); // child is indented
  // selected marker
  expect(lines[1]).toContain("▸");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/primitives.test.ts`
Expected: FAIL — cannot find `../src/primitives/sparkline.ts`.

- [ ] **Step 3: Create `packages/tui/src/primitives/sparkline.ts`**

```ts
const BLOCKS = "▁▂▃▄▅▆▇█";

export function sparkline(series: number[]): string {
  if (series.length === 0) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min;
  return series
    .map((v) => {
      const idx = span === 0 ? 0 : Math.round(((v - min) / span) * (BLOCKS.length - 1));
      return BLOCKS[idx];
    })
    .join("");
}
```

- [ ] **Step 4: Create `packages/tui/src/primitives/cost-bar.ts`**

```ts
export function costBar(spent: number, cap: number, width: number): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}
```

- [ ] **Step 5: Create `packages/tui/src/primitives/tree-lines.ts`**

```ts
import type { HypothesisNode } from "../model/types.ts";

const STATUS_ICON: Record<string, string> = {
  OPEN: "○", RUNNING: "▶", FALSIFIED: "✗", CONFIRMED: "✓", KILLED: "☓",
};

/** Render the hypothesis forest as indented ASCII lines. */
export function treeLines(nodes: HypothesisNode[], selectedId?: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
  const lines: string[] = [];

  const walk = (node: HypothesisNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const marker = node.id === selectedId ? "▸" : " ";
    const icon = STATUS_ICON[node.status] ?? "?";
    lines.push(`${indent}${marker} ${icon} ${node.id}  ${node.claim.slice(0, 40)}`);
    for (const childId of node.childIds) {
      const child = byId.get(childId);
      if (child) walk(child, depth + 1);
    }
  };

  for (const root of roots) walk(root, 0);
  return lines;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/primitives.test.ts`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/tui/src/primitives packages/tui/test/primitives.test.ts
git commit -m "feat(tui): pure sparkline, cost bar, and tree-line primitives"
```

---

## Task 4: StateStore (filesystem watcher)

**Files:**
- Create: `packages/tui/test/fixtures.ts`
- Create: `packages/tui/src/state-store.ts`
- Test: `packages/tui/test/state-store.test.ts`

- [ ] **Step 1: Create the fixture helper `packages/tui/test/fixtures.ts`**

```ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeRepo(): Promise<string> {
  return mkdtemp(join(tmpdir(), "epistemic-tui-"));
}

export async function writeHypotheses(cwd: string, body: string): Promise<void> {
  await writeFile(join(cwd, "HYPOTHESES.md"), body, "utf8");
}

export async function writeTelemetry(
  cwd: string, id: string, lines: object[],
): Promise<void> {
  const dir = join(cwd, "experiments", id, "smokes");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "telemetry.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    "utf8",
  );
}

export async function writeRunStatus(
  cwd: string, id: string, status: object,
): Promise<void> {
  const dir = join(cwd, "experiments", id, "smokes");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "run-status.json"), JSON.stringify(status), "utf8");
}

export function sampleHypotheses(): string {
  return `# Hypotheses

## Hypothesis: H-001
- **Status:** RUNNING
- **Claim:** LoRA improves accuracy
- **Cost cap:** 50
- **Compute target:** local
- **N:** 30
`;
}
```

- [ ] **Step 2: Write the failing test `packages/tui/test/state-store.test.ts`**

```ts
import { expect, test } from "vitest";
import { StateStore } from "../src/state-store.ts";
import {
  makeRepo, writeHypotheses, writeTelemetry, writeRunStatus, sampleHypotheses,
} from "./fixtures.ts";

test("StateStore.read assembles a world from filesystem state", async () => {
  const cwd = await makeRepo();
  await writeHypotheses(cwd, sampleHypotheses());
  await writeTelemetry(cwd, "H-001", [
    { trial: 5, total: 30, cost: 2, acc: 0.7, t: 1 },
    { trial: 10, total: 30, cost: 4, acc: 0.74, t: 2 },
  ]);
  await writeRunStatus(cwd, "H-001", { status: "running" });

  const store = new StateStore(cwd);
  const world = await store.read();

  expect(world.nodes).toHaveLength(1);
  const run = world.runs[0];
  expect(run.id).toBe("H-001");
  expect(run.status).toBe("running");
  expect(run.trialsDone).toBe(10);
  expect(run.accSeries).toEqual([0.7, 0.74]);
});

test("StateStore.watch fires on change", async () => {
  const cwd = await makeRepo();
  await writeHypotheses(cwd, sampleHypotheses());

  const store = new StateStore(cwd);
  const seen: number[] = [];
  await store.watch((world) => seen.push(world.nodes.length));

  // initial emit
  await new Promise((r) => setTimeout(r, 50));
  await writeHypotheses(cwd, sampleHypotheses() + `
## Hypothesis: H-002
- **Status:** OPEN
- **Claim:** second
- **Cost cap:** 30
`);
  await new Promise((r) => setTimeout(r, 400));
  await store.close();

  expect(seen[0]).toBe(1);
  expect(seen[seen.length - 1]).toBe(2);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/state-store.test.ts`
Expected: FAIL — cannot find `../src/state-store.ts`.

- [ ] **Step 4: Create `packages/tui/src/state-store.ts`**

```ts
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import {
  loadHypotheses, getAllHypothesisSpends, loadLessons,
} from "./epistemic-state.ts";
import { buildWorld } from "./model/build-world.ts";
import type { ResearchWorld, RunStatus, TelemetryPoint, WorldInputs } from "./model/types.ts";

async function safeRead(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch { return null; }
}

async function listDir(path: string): Promise<string[]> {
  try { return await readdir(path); } catch { return []; }
}

export class StateStore {
  private watcher: FSWatcher | null = null;
  private lastGood: ResearchWorld | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private cwd: string) {}

  async read(): Promise<ResearchWorld> {
    try {
      const entries = await loadHypotheses(this.cwd);
      const spends = await getAllHypothesisSpends(this.cwd);
      const lessons = await loadLessons(this.cwd);
      const hypothesesContent = (await safeRead(join(this.cwd, "HYPOTHESES.md"))) ?? "";

      const telemetry: Record<string, TelemetryPoint[]> = {};
      const runStatus: Record<string, { status: RunStatus; exit?: number }> = {};
      const alternatives: Record<string, string[]> = {};

      for (const e of entries) {
        const smokes = join(this.cwd, "experiments", e.id, "smokes");
        const tel = await safeRead(join(smokes, "telemetry.jsonl"));
        if (tel) {
          telemetry[e.id] = tel
            .split("\n")
            .filter(Boolean)
            .map((l) => { try { return JSON.parse(l) as TelemetryPoint; } catch { return null; } })
            .filter((p): p is TelemetryPoint => p !== null);
        }
        const rs = await safeRead(join(smokes, "run-status.json"));
        if (rs) { try { runStatus[e.id] = JSON.parse(rs); } catch { /* ignore */ } }
        alternatives[e.id] = await listDir(join(this.cwd, "experiments", e.id, "alternatives"));
      }

      const inputs: WorldInputs = {
        hypothesesContent, spends, lessons, telemetry, runStatus, alternatives,
      };
      this.lastGood = buildWorld(entries, inputs);
      return this.lastGood;
    } catch {
      if (this.lastGood) return this.lastGood;
      return { nodes: [], runs: [], lessons: [], totalSpent: 0, totalCap: 0 };
    }
  }

  async watch(onChange: (world: ResearchWorld) => void): Promise<void> {
    onChange(await this.read());
    this.watcher = chokidar.watch(
      [
        join(this.cwd, "HYPOTHESES.md"),
        join(this.cwd, "RESULTS.md"),
        join(this.cwd, "BASELINES.md"),
        join(this.cwd, ".epistemic"),
        join(this.cwd, "experiments"),
      ],
      { ignoreInitial: true },
    );
    const debounced = () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(async () => onChange(await this.read()), 150);
    };
    this.watcher.on("all", debounced);
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.watcher?.close();
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/state-store.test.ts`
Expected: both tests PASS. (The watch test allows 400ms for chokidar + debounce.)

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/state-store.ts packages/tui/test/fixtures.ts packages/tui/test/state-store.test.ts
git commit -m "feat(tui): StateStore watches filesystem and builds ResearchWorld"
```

---

## Task 5: ExperimentRunner (spawn/kill + telemetry)

**Files:**
- Create: `packages/tui/src/experiment-runner.ts`
- Test: `packages/tui/test/experiment-runner.test.ts`

- [ ] **Step 1: Write the failing test `packages/tui/test/experiment-runner.test.ts`**

```ts
import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ExperimentRunner } from "../src/experiment-runner.ts";
import { makeRepo } from "./fixtures.ts";

// A fake job: prints two telemetry lines then exits 0.
const FAKE_JOB = [
  "node", "-e",
  "console.log('TRIAL 1/2');console.log('COST 1.5');console.log('ACC 0.6');" +
  "console.log('TRIAL 2/2');console.log('COST 3.0');console.log('ACC 0.8')",
];

test("runner writes telemetry.jsonl and run-status done on success", async () => {
  const cwd = await makeRepo();
  const runner = new ExperimentRunner(cwd);
  await runner.spawnWith("H-001", FAKE_JOB);
  await runner.waitFor("H-001");

  const smokes = join(cwd, "experiments", "H-001", "smokes");
  const tel = await readFile(join(smokes, "telemetry.jsonl"), "utf8");
  const points = tel.trim().split("\n").map((l) => JSON.parse(l));
  expect(points).toHaveLength(2);
  expect(points[1]).toMatchObject({ trial: 2, total: 2, cost: 3.0, acc: 0.8 });

  const rs = JSON.parse(await readFile(join(smokes, "run-status.json"), "utf8"));
  expect(rs.status).toBe("done");
});

test("runner marks failed when the job exits nonzero", async () => {
  const cwd = await makeRepo();
  const runner = new ExperimentRunner(cwd);
  await runner.spawnWith("H-002", ["node", "-e", "process.exit(3)"]);
  await runner.waitFor("H-002");

  const rs = JSON.parse(
    await readFile(join(cwd, "experiments", "H-002", "smokes", "run-status.json"), "utf8"),
  );
  expect(rs.status).toBe("failed");
  expect(rs.exit).toBe(3);
});

test("kill marks run-status killed", async () => {
  const cwd = await makeRepo();
  const runner = new ExperimentRunner(cwd);
  await runner.spawnWith("H-003", ["node", "-e", "setTimeout(()=>{}, 10000)"]);
  await new Promise((r) => setTimeout(r, 100));
  runner.kill("H-003");
  await runner.waitFor("H-003");

  const rs = JSON.parse(
    await readFile(join(cwd, "experiments", "H-003", "smokes", "run-status.json"), "utf8"),
  );
  expect(rs.status).toBe("killed");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/experiment-runner.test.ts`
Expected: FAIL — cannot find `../src/experiment-runner.ts`.

- [ ] **Step 3: Create `packages/tui/src/experiment-runner.ts`**

```ts
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { ComputeTarget, TelemetryPoint } from "./model/types.ts";

interface LiveRun {
  proc: ChildProcess;
  killed: boolean;
  done: Promise<void>;
}

/** Build the launch argv for a given compute target. */
export function commandFor(cwd: string, id: string, target: ComputeTarget): string[] {
  const expDir = join(cwd, "experiments", id);
  switch (target) {
    case "docker":
      return ["docker", "run", "--rm", "-v", `${expDir}:/work`, `epistemic-${id}`];
    case "modal":
      return ["modal", "run", join(expDir, "modal-app.py")];
    case "local":
    default:
      return ["bash", join(expDir, "run.sh")];
  }
}

export class ExperimentRunner {
  private runs = new Map<string, LiveRun>();

  constructor(private cwd: string) {}

  spawn(id: string, target: ComputeTarget): Promise<void> {
    return this.spawnWith(id, commandFor(this.cwd, id, target));
  }

  /** Lower-level: spawn an explicit argv (used by tests). */
  async spawnWith(id: string, argv: string[]): Promise<void> {
    const smokes = join(this.cwd, "experiments", id, "smokes");
    await mkdir(smokes, { recursive: true });
    await writeFile(join(smokes, "telemetry.jsonl"), "", "utf8");
    await writeFile(join(smokes, "run-status.json"), JSON.stringify({ status: "running" }), "utf8");

    const [cmd, ...args] = argv;
    const proc = spawn(cmd, args, { cwd: this.cwd });

    let buf = "";
    let trial = 0, total = 0, cost = 0;
    let acc: number | undefined;
    let t = 0;

    const flush = async () => {
      const point: TelemetryPoint = { trial, total, cost, acc, t: ++t };
      await appendFile(join(smokes, "telemetry.jsonl"), JSON.stringify(point) + "\n", "utf8");
    };

    proc.stdout?.on("data", async (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const mt = line.match(/^TRIAL (\d+)\/(\d+)/);
        const mc = line.match(/^COST ([\d.]+)/);
        const ma = line.match(/^ACC ([\d.]+)/);
        if (mt) { trial = +mt[1]; total = +mt[2]; }
        else if (mc) { cost = +mc[1]; }
        else if (ma) { acc = +ma[1]; await flush(); }
      }
    });

    const done = new Promise<void>((resolve) => {
      proc.on("close", async (code) => {
        const live = this.runs.get(id);
        const status = live?.killed ? "killed" : code === 0 ? "done" : "failed";
        await writeFile(
          join(smokes, "run-status.json"),
          JSON.stringify({ status, exit: code ?? undefined }),
          "utf8",
        );
        resolve();
      });
    });

    this.runs.set(id, { proc, killed: false, done });
  }

  kill(id: string): void {
    const live = this.runs.get(id);
    if (live && !live.killed) {
      live.killed = true;
      live.proc.kill("SIGTERM");
    }
  }

  waitFor(id: string): Promise<void> {
    return this.runs.get(id)?.done ?? Promise.resolve();
  }

  isRunning(id: string): boolean {
    const live = this.runs.get(id);
    return !!live && live.proc.exitCode === null && !live.killed;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/experiment-runner.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/experiment-runner.ts packages/tui/test/experiment-runner.test.ts
git commit -m "feat(tui): ExperimentRunner spawns/kills jobs and writes telemetry to smokes/"
```

---

## Task 6: AgentBridge (omp print mode, context-aware)

**Files:**
- Create: `packages/tui/src/agent-bridge.ts`
- Test: `packages/tui/test/agent-bridge.test.ts`

- [ ] **Step 1: Write the failing test `packages/tui/test/agent-bridge.test.ts`**

```ts
import { expect, test } from "vitest";
import { AgentBridge, buildPrompt } from "../src/agent-bridge.ts";

test("buildPrompt prepends selected-node context when present", () => {
  const p = buildPrompt("why did this diverge?", {
    id: "H-004", claim: "scale to 7B", status: "RUNNING",
  });
  expect(p).toContain("H-004");
  expect(p).toContain("scale to 7B");
  expect(p).toContain("why did this diverge?");
});

test("buildPrompt without context is just the question", () => {
  expect(buildPrompt("hello", undefined)).toBe("hello");
});

test("ask streams stdout chunks and resolves with full text", async () => {
  // Fake agent binary: a node one-liner that prints two chunks.
  const bridge = new AgentBridge("/tmp", {
    bin: "node",
    baseArgs: ["-e", "process.stdout.write('think');process.stdout.write('ing')"],
  });
  const chunks: string[] = [];
  const full = await bridge.ask("q", undefined, (c) => chunks.push(c));
  expect(full).toBe("thinking");
  expect(chunks.join("")).toBe("thinking");
});

test("ask reports unavailable when the bin is missing", async () => {
  const bridge = new AgentBridge("/tmp", { bin: "definitely-not-a-real-bin-xyz", baseArgs: [] });
  const full = await bridge.ask("q", undefined, () => {});
  expect(full).toContain("agent unavailable");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/agent-bridge.test.ts`
Expected: FAIL — cannot find `../src/agent-bridge.ts`.

- [ ] **Step 3: Create `packages/tui/src/agent-bridge.ts`**

```ts
import { spawn } from "node:child_process";

export interface NodeContext {
  id: string;
  claim: string;
  status: string;
}

export interface AgentBridgeOptions {
  bin?: string;       // default "omp"
  baseArgs?: string[]; // default ["-p", "--continue"]
}

/** Prepend the selected hypothesis context so the agent answers in context. */
export function buildPrompt(question: string, ctx: NodeContext | undefined): string {
  if (!ctx) return question;
  return [
    `[Context: hypothesis ${ctx.id} — "${ctx.claim}" — status ${ctx.status}]`,
    question,
  ].join("\n");
}

export class AgentBridge {
  private bin: string;
  private baseArgs: string[];

  constructor(private cwd: string, opts: AgentBridgeOptions = {}) {
    this.bin = opts.bin ?? "omp";
    this.baseArgs = opts.baseArgs ?? ["-p", "--continue"];
  }

  /** Run one non-interactive agent turn. Streams stdout via onChunk; resolves with full text. */
  ask(
    question: string,
    ctx: NodeContext | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const prompt = buildPrompt(question, ctx);
    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(this.bin, [...this.baseArgs, prompt], { cwd: this.cwd });
      } catch {
        resolve("agent unavailable (failed to spawn)");
        return;
      }
      let out = "";
      proc.on("error", () => resolve("agent unavailable (binary not found)"));
      proc.stdout?.on("data", (c: Buffer) => { const s = c.toString(); out += s; onChunk(s); });
      proc.on("close", () => resolve(out || "agent unavailable (no output)"));
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/agent-bridge.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/agent-bridge.ts packages/tui/test/agent-bridge.test.ts
git commit -m "feat(tui): AgentBridge runs context-aware omp print-mode turns"
```

---

## Task 7: Commands registry

**Files:**
- Create: `packages/tui/src/commands.ts`
- Test: `packages/tui/test/commands.test.ts`

- [ ] **Step 1: Write the failing test `packages/tui/test/commands.test.ts`**

```ts
import { expect, test, vi } from "vitest";
import { buildCommands } from "../src/commands.ts";

function deps() {
  return {
    runner: { spawn: vi.fn().mockResolvedValue(undefined), kill: vi.fn() },
    selectedNode: () => ({ id: "H-004", computeTarget: "local" as const, claim: "c", status: "RUNNING" as const }),
    setLens: vi.fn(),
    openCommandBar: vi.fn(),
  };
}

test("registry exposes spawn/kill/switch-lens/summon-agent verbs", () => {
  const cmds = buildCommands(deps() as never);
  const ids = cmds.map((c) => c.id);
  expect(ids).toEqual(
    expect.arrayContaining(["spawn", "kill", "lens-tree", "lens-missions", "lens-focus", "summon-agent"]),
  );
});

test("spawn invokes runner.spawn with the selected node's id and target", async () => {
  const d = deps();
  const cmds = buildCommands(d as never);
  await cmds.find((c) => c.id === "spawn")!.run();
  expect(d.runner.spawn).toHaveBeenCalledWith("H-004", "local");
});

test("kill invokes runner.kill with the selected node id", async () => {
  const d = deps();
  const cmds = buildCommands(d as never);
  await cmds.find((c) => c.id === "kill")!.run();
  expect(d.runner.kill).toHaveBeenCalledWith("H-004");
});

test("lens-missions sets the missions lens", async () => {
  const d = deps();
  const cmds = buildCommands(d as never);
  await cmds.find((c) => c.id === "lens-missions")!.run();
  expect(d.setLens).toHaveBeenCalledWith("missions");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/commands.test.ts`
Expected: FAIL — cannot find `../src/commands.ts`.

- [ ] **Step 3: Create `packages/tui/src/commands.ts`**

```ts
import type { ComputeTarget, HypothesisNode } from "./model/types.ts";

export type LensName = "tree" | "missions" | "focus";

export interface CommandDeps {
  runner: { spawn: (id: string, target: ComputeTarget) => Promise<void>; kill: (id: string) => void };
  selectedNode: () => HypothesisNode | undefined;
  setLens: (lens: LensName) => void;
  openCommandBar: () => void;
}

export interface Command {
  id: string;
  label: string;
  run: () => void | Promise<void>;
}

export function buildCommands(deps: CommandDeps): Command[] {
  return [
    {
      id: "spawn",
      label: "Spawn experiment for selected hypothesis",
      run: async () => {
        const n = deps.selectedNode();
        if (n) await deps.runner.spawn(n.id, n.computeTarget);
      },
    },
    {
      id: "kill",
      label: "Kill selected experiment",
      run: () => {
        const n = deps.selectedNode();
        if (n) deps.runner.kill(n.id);
      },
    },
    { id: "lens-tree", label: "Switch to Tree lens", run: () => deps.setLens("tree") },
    { id: "lens-missions", label: "Switch to Missions lens", run: () => deps.setLens("missions") },
    { id: "lens-focus", label: "Switch to Focus lens", run: () => deps.setLens("focus") },
    { id: "summon-agent", label: "Ask the agent (Ctrl+K)", run: () => deps.openCommandBar() },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/commands.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/commands.ts packages/tui/test/commands.test.ts
git commit -m "feat(tui): command registry for cockpit verbs"
```

---

## Task 8: StatusFooter and Inspector components

**Files:**
- Create: `packages/tui/src/ui/StatusFooter.tsx`
- Create: `packages/tui/src/ui/Inspector.tsx`
- Test: `packages/tui/test/footer-inspector.test.tsx`

- [ ] **Step 1: Write the failing test `packages/tui/test/footer-inspector.test.tsx`**

```tsx
import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { StatusFooter } from "../src/ui/StatusFooter.tsx";
import { Inspector } from "../src/ui/Inspector.tsx";
import type { HypothesisNode, ResearchWorld } from "../src/model/types.ts";

const world: ResearchWorld = {
  nodes: [], runs: [
    { id: "H-001", status: "running", trialsDone: 5, trialsTotal: 30, costSeries: [], accSeries: [], spent: 10, costCap: 50 },
    { id: "H-002", status: "done", trialsDone: 30, trialsTotal: 30, costSeries: [], accSeries: [], spent: 5, costCap: 30 },
  ],
  lessons: [], totalSpent: 15, totalCap: 80,
};

test("StatusFooter shows fleet burn and running count", () => {
  const { lastFrame } = render(<StatusFooter world={world} lens="missions" />);
  expect(lastFrame()).toContain("$15");
  expect(lastFrame()).toContain("80");
  expect(lastFrame()).toContain("1 running");
});

test("Inspector renders the selected node detail", () => {
  const node: HypothesisNode = {
    id: "H-004", claim: "scale to 7B", status: "RUNNING", computeTarget: "local",
    costCap: 80, spent: 12, childIds: [], alternativeIds: ["qlora"],
  };
  const { lastFrame } = render(<Inspector node={node} />);
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("scale to 7B");
  expect(lastFrame()).toContain("qlora");
});

test("Inspector shows placeholder when nothing selected", () => {
  const { lastFrame } = render(<Inspector node={undefined} />);
  expect(lastFrame()).toContain("nothing selected");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/footer-inspector.test.tsx`
Expected: FAIL — cannot find `../src/ui/StatusFooter.tsx`.

- [ ] **Step 3: Create `packages/tui/src/ui/StatusFooter.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.ts";
import { costBar } from "../primitives/cost-bar.ts";

export function StatusFooter({ world, lens }: { world: ResearchWorld; lens: string }) {
  const running = world.runs.filter((r) => r.status === "running").length;
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Text>
        burn ${world.totalSpent.toFixed(2)} / ${world.totalCap}{" "}
        <Text color="yellow">{costBar(world.totalSpent, world.totalCap, 10)}</Text>
      </Text>
      <Text>
        <Text color="cyan">{running} running</Text>
        {"  "}lens:{lens}{"  "}
        <Text dimColor>[1]tree [2]missions [3]focus  ^K ask  q quit</Text>
      </Text>
    </Box>
  );
}
```

- [ ] **Step 4: Create `packages/tui/src/ui/Inspector.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { HypothesisNode } from "../model/types.ts";
import { costBar } from "../primitives/cost-bar.ts";

export function Inspector({ node }: { node: HypothesisNode | undefined }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} width={32}>
      <Text color="magenta" bold>INSPECTOR</Text>
      {!node ? (
        <Text dimColor>nothing selected</Text>
      ) : (
        <>
          <Text color="cyan">{node.id}</Text>
          <Text>{node.claim.slice(0, 60)}</Text>
          <Text dimColor>status {node.status}</Text>
          <Text dimColor>target {node.computeTarget}</Text>
          <Text color="green">{costBar(node.spent, node.costCap, 8)}</Text>
          {node.alternativeIds.length > 0 && (
            <Text dimColor>alts: {node.alternativeIds.join(", ")}</Text>
          )}
          {node.killReason && <Text color="red">killed: {node.killReason}</Text>}
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/footer-inspector.test.tsx`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/ui/StatusFooter.tsx packages/tui/src/ui/Inspector.tsx packages/tui/test/footer-inspector.test.tsx
git commit -m "feat(tui): StatusFooter and Inspector components"
```

---

## Task 9: The three lenses

**Files:**
- Create: `packages/tui/src/ui/LensMissions.tsx`
- Create: `packages/tui/src/ui/LensTree.tsx`
- Create: `packages/tui/src/ui/LensFocus.tsx`
- Test: `packages/tui/test/lenses.test.tsx`

- [ ] **Step 1: Write the failing test `packages/tui/test/lenses.test.tsx`**

```tsx
import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { LensMissions } from "../src/ui/LensMissions.tsx";
import { LensTree } from "../src/ui/LensTree.tsx";
import { LensFocus } from "../src/ui/LensFocus.tsx";
import type { HypothesisNode, ResearchWorld } from "../src/model/types.ts";

const node = (p: Partial<HypothesisNode>): HypothesisNode => ({
  id: "X", claim: "c", status: "OPEN", computeTarget: "local",
  costCap: 50, spent: 0, childIds: [], alternativeIds: [], ...p,
});

const world: ResearchWorld = {
  nodes: [
    node({ id: "H-001", status: "CONFIRMED", childIds: ["H-004"] }),
    node({ id: "H-004", status: "RUNNING", parentId: "H-001" }),
  ],
  runs: [
    { id: "H-001", status: "done", trialsDone: 30, trialsTotal: 30, costSeries: [1, 2], accSeries: [0.7, 0.75], spent: 20, costCap: 50 },
    { id: "H-004", status: "running", trialsDone: 18, trialsTotal: 30, costSeries: [1, 4, 8], accSeries: [0.6, 0.7, 0.81], spent: 12, costCap: 80 },
  ],
  lessons: [], totalSpent: 32, totalCap: 130,
};

test("LensMissions renders a card per run with sparkline data", () => {
  const { lastFrame } = render(<LensMissions world={world} selectedId="H-004" />);
  expect(lastFrame()).toContain("H-001");
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("18/30");
});

test("LensTree renders the indented hypothesis tree with selection", () => {
  const { lastFrame } = render(<LensTree world={world} selectedId="H-004" />);
  expect(lastFrame()).toContain("H-001");
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("▸");
});

test("LensFocus shows the selected experiment's trial and cost detail", () => {
  const { lastFrame } = render(<LensFocus world={world} selectedId="H-004" />);
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("18/30");
  expect(lastFrame()).toContain("0.81");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/lenses.test.tsx`
Expected: FAIL — cannot find `../src/ui/LensMissions.tsx`.

- [ ] **Step 3: Create `packages/tui/src/ui/LensMissions.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld, RunStatus } from "../model/types.ts";
import { sparkline } from "../primitives/sparkline.ts";
import { costBar } from "../primitives/cost-bar.ts";

const BORDER: Record<RunStatus, string> = {
  pending: "gray", running: "blue", done: "green", failed: "red", killed: "red",
};

export function LensMissions({ world, selectedId }: { world: ResearchWorld; selectedId?: string }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">▮ MISSION CONTROL — {world.runs.filter((r) => r.status === "running").length} live</Text>
      <Box flexWrap="wrap">
        {world.runs.map((r) => (
          <Box
            key={r.id}
            flexDirection="column"
            borderStyle="round"
            borderColor={r.id === selectedId ? "white" : BORDER[r.status]}
            paddingX={1}
            width={28}
            marginRight={1}
          >
            <Text color="cyan">{r.id} <Text dimColor>{r.status}</Text></Text>
            <Text dimColor>trial {r.trialsDone}/{r.trialsTotal}</Text>
            <Text color="green">cost {sparkline(r.costSeries)} ${r.spent.toFixed(1)}</Text>
            <Text color="yellow">acc  {sparkline(r.accSeries)}</Text>
            <Text>{costBar(r.spent, r.costCap, 8)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Create `packages/tui/src/ui/LensTree.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.ts";
import { treeLines } from "../primitives/tree-lines.ts";

export function LensTree({ world, selectedId }: { world: ResearchWorld; selectedId?: string }) {
  const lines = treeLines(world.nodes, selectedId);
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">◆ RESEARCH TREE — ↑↓ navigate</Text>
      {lines.map((line, i) => {
        const isSelected = line.includes("▸");
        const isKilled = line.includes("☓");
        return (
          <Text key={i} color={isKilled ? "red" : isSelected ? "cyan" : undefined}>
            {line}
          </Text>
        );
      })}
      {lines.length === 0 && <Text dimColor>no hypotheses yet — press ^K to ask the agent</Text>}
    </Box>
  );
}
```

- [ ] **Step 5: Create `packages/tui/src/ui/LensFocus.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.ts";
import { sparkline } from "../primitives/sparkline.ts";
import { costBar } from "../primitives/cost-bar.ts";

export function LensFocus({ world, selectedId }: { world: ResearchWorld; selectedId?: string }) {
  const run = world.runs.find((r) => r.id === selectedId);
  const node = world.nodes.find((n) => n.id === selectedId);
  if (!run || !node) {
    return (
      <Box flexGrow={1}>
        <Text dimColor>select a hypothesis to focus on it</Text>
      </Box>
    );
  }
  const lastAcc = run.accSeries[run.accSeries.length - 1];
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">⊙ FOCUS — {run.id}</Text>
      <Text>{node.claim}</Text>
      <Text dimColor>status {run.status} · target {node.computeTarget}</Text>
      <Text>trials {run.trialsDone}/{run.trialsTotal}</Text>
      <Text color="green">cost {sparkline(run.costSeries)} {costBar(run.spent, run.costCap, 10)}</Text>
      <Text color="yellow">acc  {sparkline(run.accSeries)} {lastAcc !== undefined ? lastAcc.toFixed(2) : "—"}</Text>
    </Box>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/lenses.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/tui/src/ui/LensMissions.tsx packages/tui/src/ui/LensTree.tsx packages/tui/src/ui/LensFocus.tsx packages/tui/test/lenses.test.tsx
git commit -m "feat(tui): Tree, Missions, and Focus lens components"
```

---

## Task 10: CommandBar overlay

**Files:**
- Create: `packages/tui/src/ui/CommandBar.tsx`
- Test: `packages/tui/test/command-bar.test.tsx`

- [ ] **Step 1: Write the failing test `packages/tui/test/command-bar.test.tsx`**

```tsx
import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { CommandBar } from "../src/ui/CommandBar.tsx";

test("CommandBar shows the prompt and streamed answer", () => {
  const { lastFrame } = render(
    <CommandBar
      visible={true}
      draft="why diverge?"
      answer="because the LR was too high"
      busy={false}
      onChange={() => {}}
      onSubmit={() => {}}
    />,
  );
  expect(lastFrame()).toContain("why diverge?");
  expect(lastFrame()).toContain("because the LR was too high");
});

test("CommandBar renders nothing when not visible", () => {
  const { lastFrame } = render(
    <CommandBar visible={false} draft="" answer="" busy={false} onChange={() => {}} onSubmit={() => {}} />,
  );
  expect(lastFrame()).toBe("");
});

test("CommandBar shows a thinking indicator when busy", () => {
  const { lastFrame } = render(
    <CommandBar visible={true} draft="q" answer="" busy={true} onChange={() => {}} onSubmit={() => {}} />,
  );
  expect(lastFrame()).toContain("thinking");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/command-bar.test.tsx`
Expected: FAIL — cannot find `../src/ui/CommandBar.tsx`.

- [ ] **Step 3: Create `packages/tui/src/ui/CommandBar.tsx`**

Note: uses Ink's `useInput` to capture typed characters only while visible. The parent owns the draft/answer state.

```tsx
import React from "react";
import { Box, Text, useInput } from "ink";

export interface CommandBarProps {
  visible: boolean;
  draft: string;
  answer: string;
  busy: boolean;
  onChange: (next: string) => void;
  onSubmit: () => void;
}

export function CommandBar({ visible, draft, answer, busy, onChange, onSubmit }: CommandBarProps) {
  useInput(
    (input, key) => {
      if (!visible) return;
      if (key.return) { onSubmit(); return; }
      if (key.backspace || key.delete) { onChange(draft.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) onChange(draft + input);
    },
    { isActive: visible },
  );

  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={1}>
      <Text color="cyan">⌨  ask the agent (enter to send, esc to close)</Text>
      <Text>› {draft}</Text>
      {busy && <Text color="yellow">thinking…</Text>}
      {answer.length > 0 && <Text dimColor>{answer}</Text>}
    </Box>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/command-bar.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/ui/CommandBar.tsx packages/tui/test/command-bar.test.tsx
git commit -m "feat(tui): CommandBar overlay for the context-aware agent"
```

---

## Task 11: App shell (wiring + keyboard routing)

**Files:**
- Create: `packages/tui/src/ui/App.tsx`
- Test: `packages/tui/test/app.test.tsx`

- [ ] **Step 1: Write the failing test `packages/tui/test/app.test.tsx`**

```tsx
import { expect, test, vi } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { App } from "../src/ui/App.tsx";
import type { ResearchWorld } from "../src/model/types.ts";

const world: ResearchWorld = {
  nodes: [
    { id: "H-001", claim: "first", status: "RUNNING", computeTarget: "local", costCap: 50, spent: 10, childIds: [], alternativeIds: [] },
  ],
  runs: [
    { id: "H-001", status: "running", trialsDone: 5, trialsTotal: 30, costSeries: [1, 2], accSeries: [0.6], spent: 10, costCap: 50 },
  ],
  lessons: [], totalSpent: 10, totalCap: 50,
};

const deps = () => ({
  initialWorld: world,
  subscribe: (_cb: (w: ResearchWorld) => void) => () => {},
  runner: { spawn: vi.fn().mockResolvedValue(undefined), kill: vi.fn() },
  ask: vi.fn().mockResolvedValue("answer"),
});

test("App starts on the missions lens and shows footer hints", () => {
  const { lastFrame } = render(<App {...deps()} />);
  expect(lastFrame()).toContain("MISSION CONTROL");
  expect(lastFrame()).toContain("[1]tree");
});

test("pressing 1 switches to the tree lens", async () => {
  const { lastFrame, stdin } = render(<App {...deps()} />);
  stdin.write("1");
  await new Promise((r) => setTimeout(r, 20));
  expect(lastFrame()).toContain("RESEARCH TREE");
});

test("pressing s spawns the selected experiment", async () => {
  const d = deps();
  const { stdin } = render(<App {...d} />);
  stdin.write("s");
  await new Promise((r) => setTimeout(r, 20));
  expect(d.runner.spawn).toHaveBeenCalledWith("H-001", "local");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/tui && npx vitest run test/app.test.tsx`
Expected: FAIL — cannot find `../src/ui/App.tsx`.

- [ ] **Step 3: Create `packages/tui/src/ui/App.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { HypothesisNode, ResearchWorld } from "../model/types.ts";
import type { NodeContext } from "../agent-bridge.ts";
import type { LensName } from "../commands.ts";
import { LensMissions } from "./LensMissions.tsx";
import { LensTree } from "./LensTree.tsx";
import { LensFocus } from "./LensFocus.tsx";
import { Inspector } from "./Inspector.tsx";
import { StatusFooter } from "./StatusFooter.tsx";
import { CommandBar } from "./CommandBar.tsx";

export interface AppProps {
  initialWorld: ResearchWorld;
  subscribe: (cb: (w: ResearchWorld) => void) => () => void;
  runner: { spawn: (id: string, target: HypothesisNode["computeTarget"]) => Promise<void>; kill: (id: string) => void };
  ask: (question: string, ctx: NodeContext | undefined, onChunk: (c: string) => void) => Promise<string>;
}

export function App({ initialWorld, subscribe, runner, ask }: AppProps) {
  const { exit } = useApp();
  const [world, setWorld] = useState(initialWorld);
  const [lens, setLens] = useState<LensName>("missions");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [barVisible, setBarVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribe(setWorld), [subscribe]);

  const nodes = world.nodes;
  const selected = nodes[Math.min(selectedIdx, Math.max(nodes.length - 1, 0))];

  useInput((input, key) => {
    if (barVisible) {
      if (key.escape) { setBarVisible(false); setAnswer(""); setDraft(""); }
      return; // CommandBar's own useInput handles typing
    }
    if (input === "q" || (key.ctrl && input === "c")) { exit(); return; }
    if (input === "1") setLens("tree");
    else if (input === "2") setLens("missions");
    else if (input === "3") setLens("focus");
    else if (key.upArrow) setSelectedIdx((i) => Math.max(0, i - 1));
    else if (key.downArrow) setSelectedIdx((i) => Math.min(nodes.length - 1, i + 1));
    else if (input === "s" && selected) void runner.spawn(selected.id, selected.computeTarget);
    else if (input === "k" && selected) runner.kill(selected.id);
    else if (key.ctrl && input === "k") { setBarVisible(true); setAnswer(""); }
  });

  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setAnswer("");
    const ctx: NodeContext | undefined = selected
      ? { id: selected.id, claim: selected.claim, status: selected.status }
      : undefined;
    await ask(draft, ctx, (chunk) => setAnswer((a) => a + chunk));
    setBusy(false);
  };

  return (
    <Box flexDirection="column">
      <Box>
        {lens === "tree" && <LensTree world={world} selectedId={selected?.id} />}
        {lens === "missions" && <LensMissions world={world} selectedId={selected?.id} />}
        {lens === "focus" && <LensFocus world={world} selectedId={selected?.id} />}
        <Inspector node={selected} />
      </Box>
      <CommandBar
        visible={barVisible}
        draft={draft}
        answer={answer}
        busy={busy}
        onChange={setDraft}
        onSubmit={submit}
      />
      <StatusFooter world={world} lens={lens} />
    </Box>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/tui && npx vitest run test/app.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `cd packages/tui && npm test`
Expected: every test file passes.

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/ui/App.tsx packages/tui/test/app.test.tsx
git commit -m "feat(tui): App shell with lens routing and keyboard verbs"
```

---

## Task 12: Entry point, bin, and README

**Files:**
- Create: `packages/tui/src/main.tsx`
- Create: `packages/tui/bin/epistemic-tui.mjs`
- Create: `packages/tui/README.md`

- [ ] **Step 1: Create `packages/tui/src/main.tsx`**

```tsx
import React from "react";
import { render } from "ink";
import { StateStore } from "./state-store.ts";
import { ExperimentRunner } from "./experiment-runner.ts";
import { AgentBridge } from "./agent-bridge.ts";
import { App } from "./ui/App.tsx";
import type { ResearchWorld } from "./model/types.ts";

async function main() {
  const cwd = process.cwd();
  const store = new StateStore(cwd);
  const runner = new ExperimentRunner(cwd);
  const bridge = new AgentBridge(cwd);

  const initialWorld = await store.read();

  const subscribers = new Set<(w: ResearchWorld) => void>();
  await store.watch((w) => subscribers.forEach((cb) => cb(w)));

  const { waitUntilExit } = render(
    <App
      initialWorld={initialWorld}
      subscribe={(cb) => { subscribers.add(cb); return () => subscribers.delete(cb); }}
      runner={runner}
      ask={(q, ctx, onChunk) => bridge.ask(q, ctx, onChunk)}
    />,
  );

  await waitUntilExit();
  await store.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create `packages/tui/bin/epistemic-tui.mjs`**

```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "main.tsx");
const result = spawnSync("npx", ["tsx", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
```

- [ ] **Step 3: Make the bin executable**

Run: `chmod +x packages/tui/bin/epistemic-tui.mjs`

- [ ] **Step 4: Create `packages/tui/README.md`**

```markdown
# Epistemic Cockpit (TUI)

A spatial research cockpit for epistemic. Renders your research program as
navigable lenses, launches and kills parallel experiments, and summons a
context-aware agent — all from the terminal.

## Run

From the root of a research repo (where `HYPOTHESES.md` / `experiments/` live):

```bash
npx tsx packages/tui/src/main.tsx
# or, once linked:
epistemic-tui
```

## Keys

| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Tree / Missions / Focus lens |
| `↑` / `↓` | Move selection |
| `s` | Spawn experiment for the selected hypothesis |
| `k` | Kill the selected experiment |
| `Ctrl+K` | Ask the context-aware agent |
| `q` | Quit |

## Design

This package does not modify the epistemic extension. The filesystem is the
single source of truth: actions write to disk, a watcher rebuilds the model,
and Ink re-renders. See `docs/superpowers/specs/2026-05-31-epistemic-cockpit-design.md`.
```

- [ ] **Step 5: Manual smoke test**

Run:
```bash
cd packages/tui && npx tsx src/main.tsx
```
Expected: the cockpit renders (Missions lens + Inspector + footer). Press `1`/`2`/`3` to switch lenses, `q` to quit. If you have no `HYPOTHESES.md` in cwd, the Tree lens shows "no hypotheses yet". (Run from a directory that has epistemic state to see real data.)

- [ ] **Step 6: Typecheck**

Run: `cd packages/tui && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/tui/src/main.tsx packages/tui/bin/epistemic-tui.mjs packages/tui/README.md
git commit -m "feat(tui): entry point, bin shim, and README"
```

---

## Self-Review Notes

**Spec coverage:**
- WorldModel (pure) → Task 2 ✓
- StateStore (chokidar, reuses repo.ts) → Task 4 ✓ (shim in Task 1)
- ExperimentRunner spawn/kill by computeTarget → Task 5 ✓ (`commandFor` covers local/docker/modal)
- AgentBridge context-aware (omp) → Task 6 ✓
- Commands registry → Task 7 ✓
- LensTree / LensMissions / LensFocus → Task 9 ✓
- Inspector / StatusFooter → Task 8 ✓
- CommandBar (Ctrl+K) → Task 10 ✓
- App shell wiring + keyboard → Task 11 ✓
- packages/tui workspace, bin/epistemic-tui → Tasks 1 & 12 ✓
- Does not modify existing extension → verified: only imports repo.ts read-only via shim; no root files touched ✓
- Filesystem-as-truth, WorldModel pure → run status derived from run-status.json/telemetry ✓
- Error handling: corrupt state (StateStore last-good fallback ✓), omp missing (AgentBridge degrade ✓), process crash (runner "failed" ✓)
- Tests via ink-testing-library + temp-dir fixtures → Tasks 4/8/9/10/11 ✓

**Type consistency:** `RunStatus`, `ExperimentRun`, `HypothesisNode`, `ResearchWorld`, `WorldInputs`, `TelemetryPoint`, `NodeContext`, `LensName`, `Command`, `CommandDeps`, `AppProps`, `CommandBarProps` all defined once and referenced consistently. `runner.spawn(id, target)` / `runner.kill(id)` signatures match across Commands (Task 7), App (Task 11), and main (Task 12).

**Deferred to later phases (per spec):** `fork-alternative`, conditional-plan edge labels/editing, alternative comparison view (Phase 2); falsifier verdict rendering, kill-or-ship actions from the cockpit (Phase 3). The Tree lens shows parent/child + killed coloring now; sideways alternative branches render in Phase 2.

**Known Phase-1 limitations (intentional):**
- The `local` runner expects `experiments/{id}/run.sh`; real experiment scripts must emit the `TRIAL/COST/ACC` telemetry protocol (or an adapter is added in Phase 2).
- The agent runs in non-interactive print mode (one turn at a time), not a live interactive session — deliberate, to avoid nested-TTY rendering. Interactive mode is a possible Phase 3 enhancement.
