# Epistemic Spatial UX — Implementation Plan (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete spatial UX — browser graph panel + terminal integration — described in `docs/superpowers/specs/2026-06-04-epistemic-spatial-ux-design.md`.

**Architecture:** A local HTTP server (`src/graph/server.ts`) serves a D3.js single-page app. The app polls `/api/state` every 2s. Node clicks post to `/api/event`. The terminal extension polls `graph-events.jsonl` on its refresh timer and handles events (open-hypothesis, new-research). All decisions stay in the terminal; the browser reflects them. D3 is bundled locally — no CDN.

**Tech Stack:** Node.js `http` module, D3.js v7 (npm, served locally), TypeScript for all server code, vanilla JS for the browser client embedded as a template literal.

---

## Audit Fixes Applied

| Bug | Fix |
|---|---|
| Events written, never consumed | Task 7: wire `readGraphEvents` into extension refresh loop |
| `client.html` path fragile under tsx/build | Embed HTML as template literal in `server.ts` |
| D3 from CDN — breaks offline | `npm install d3`, serve from local server |
| CORS `*` leaks research data | Restrict to `localhost` origin only |
| No input validation on `/api/event` | 64KB limit + event type allowlist |
| Gates always `false` for proposals | Proposals show no gate indicators in card |
| `cwd` unused in `buildGraphData` | Removed from signature |
| Stale events replayed across restarts | Server start timestamp gates event consumption |
| Plan 2 never written | Merged into this plan (Tasks 8–12) |
| No `RESEARCH.md` writer | Task 9: write RESEARCH.md after brainstorm |
| Proposal detection missing | Task 12: agent hook + dashed circle for unregistered RS entries |

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/graph/parser.ts` | Parse RESEARCH.md → ResearchDocument + ResearchStory[] |
| Create | `src/graph/state.ts` | Merge RESEARCH.md + HYPOTHESES.md → GraphData |
| Create | `src/graph/server.ts` | HTTP server with embedded client HTML, `/api/state`, `/api/event` |
| Create | `src/graph/events.ts` | Read `.epistemic/graph-events.jsonl` with timestamp gating |
| Create | `test/graph-parser.test.ts` | Parser unit tests |
| Create | `test/graph-state.test.ts` | State aggregator tests |
| Create | `test/graph-server.test.ts` | Server integration tests |
| Create | `test/graph-events.test.ts` | Events reader tests |
| Modify | `src/tui/widget.ts` | Add `buildHypothesisHeader()` for persistent two-line header |
| Modify | `src/cli/epistemic.ts` | Add `graph` subcommand + auto-start server on launch |
| Modify | `packages/omp/src/commands/epistemic.ts` | Add `/new`, `/graph` commands + event polling + S/K/P/R shortcuts |

---

## Task 1: Install D3 Locally

- [ ] **Step 1: Add d3 dependency**

```bash
npm install d3
npm install --save-dev @types/d3
```

- [ ] **Step 2: Verify d3 is importable**

```bash
node -e "import('d3').then(d => console.log('d3 ok:', Object.keys(d).length, 'exports'))"
```

Expected: `d3 ok: <number> exports`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add d3 for local graph rendering"
```

---

## Task 2: RESEARCH.md Parser

**Files:**
- Create: `src/graph/parser.ts`
- Create: `test/graph-parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/graph-parser.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseResearchDocument } from "../src/graph/parser.js";

const SAMPLE = `# RD: CoT for Code

## 1. Research overview
### 1.2 Research summary
Does chain-of-thought prompting improve code generation?

## 10. Research stories

### 10.1. Establish baseline performance
- **ID**: RS-001
- **Description**: Reproduce gpt-4o baseline on HumanEval pass@1.
- **Validation criteria**: Baseline matches published ±1%.

### 10.2. Test CoT prompting
- **ID**: RS-002
- **Description**: Compare CoT vs vanilla on 30 runs.
- **Validation criteria**: p < 0.05, effect size reported.
`;

describe("parseResearchDocument", () => {
  it("extracts title from h1", () => {
    const doc = parseResearchDocument(SAMPLE);
    assert.equal(doc.title, "CoT for Code");
  });

  it("extracts summary from section 1.2", () => {
    const doc = parseResearchDocument(SAMPLE);
    assert.ok(doc.summary.includes("chain-of-thought"));
  });

  it("extracts two research stories", () => {
    const doc = parseResearchDocument(SAMPLE);
    assert.equal(doc.stories.length, 2);
  });

  it("parses RS-001 id, title, description, validationCriteria", () => {
    const { stories } = parseResearchDocument(SAMPLE);
    assert.equal(stories[0].id, "RS-001");
    assert.equal(stories[0].title, "Establish baseline performance");
    assert.ok(stories[0].description.includes("Reproduce gpt-4o"));
    assert.ok(stories[0].validationCriteria.includes("±1%"));
  });

  it("returns empty stories when section 10 is absent", () => {
    const doc = parseResearchDocument("# RD: Empty\n## 1. Research overview\n");
    assert.equal(doc.stories.length, 0);
  });

  it("returns Untitled Research when h1 is absent", () => {
    const doc = parseResearchDocument("## 1. Research overview\n");
    assert.equal(doc.title, "Untitled Research");
  });
});
```

- [ ] **Step 2: Run — verify they fail**

```bash
npx tsx --test test/graph-parser.test.ts
```

Expected: `Cannot find module '../src/graph/parser.js'`

- [ ] **Step 3: Implement**

```typescript
// src/graph/parser.ts

export interface ResearchStory {
  id: string;
  title: string;
  description: string;
  validationCriteria: string;
}

export interface ResearchDocument {
  title: string;
  summary: string;
  stories: ResearchStory[];
}

export function parseResearchDocument(content: string): ResearchDocument {
  const titleMatch = content.match(/^# RD:\s*(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? "Untitled Research";

  const summaryMatch = content.match(/###\s*1\.2\s+Research summary\s*\n([\s\S]*?)(?=\n##|\n###\s*\d|$)/i);
  const summary = summaryMatch?.[1]?.trim() ?? "";

  return { title, summary, stories: parseStories(content) };
}

function parseStories(content: string): ResearchStory[] {
  const section10 = content.match(/##\s*10\.?\s+Research stories?\s*\n([\s\S]*?)(?=\n##\s*\d+\.|$)/i);
  if (!section10) return [];

  const stories: ResearchStory[] = [];
  for (const block of section10[1].split(/(?=###\s*10\.\d+\.)/)) {
    const heading = block.match(/###\s*10\.\d+\.\s*(.+)/);
    if (!heading) continue;

    const id = block.match(/\*\*ID\*\*:\s*(RS-\d+)/i)?.[1]?.trim();
    if (!id) continue;

    const desc = block.match(/\*\*Description\*\*:\s*([^\n]+(?:\n(?![-\s]*\*\*)[^\n]+)*)/i)?.[1]?.trim() ?? "";
    const valid = block.match(/\*\*Validation criteria\*\*:\s*([\s\S]*?)(?=\n\s*-\s*\*\*|\n###|$)/i)?.[1]?.trim() ?? "";

    stories.push({ id, title: heading[1].trim(), description: desc, validationCriteria: valid });
  }
  return stories;
}
```

- [ ] **Step 4: Run — verify they pass**

```bash
npx tsx --test test/graph-parser.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/graph/parser.ts test/graph-parser.test.ts
git commit -m "feat: RESEARCH.md parser (Research Stories extraction)"
```

---

## Task 3: Graph State Aggregator

**Files:**
- Create: `src/graph/state.ts`
- Create: `test/graph-state.test.ts`

Note: `cwd` is **not** a parameter — all I/O happens in the server. This function is pure data transformation.

- [ ] **Step 1: Write failing tests**

```typescript
// test/graph-state.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGraphData } from "../src/graph/state.js";

const RESEARCH_MD = `# RD: CoT for Code
## 1. Research overview
### 1.2 Research summary
Testing CoT.
## 10. Research stories
### 10.1. Establish baseline
- **ID**: RS-001
- **Description**: Reproduce baseline.
- **Validation criteria**: Match ±1%.
### 10.2. CoT experiment
- **ID**: RS-002
- **Description**: Run CoT.
- **Validation criteria**: p < 0.05.
`;

const HYPOTHESES_MD = `## Hypothesis: RS-001
- **Claim**: Reproduce gpt-4o baseline
- **Status**: CONFIRMED
- **Cost Cap**: 20
- **N**: 30
- **Compute Target**: local

## Hypothesis: RS-002
- **Claim**: CoT improves pass@1
- **Status**: RUNNING
- **Cost Cap**: 20
- **N**: 30
- **Compute Target**: local
`;

describe("buildGraphData", () => {
  it("produces root node with title from RESEARCH.md", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.root.id, "root");
    assert.equal(data.root.label, "CoT for Code");
  });

  it("creates one node per research story", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.nodes.length, 2);
  });

  it("merges hypothesis status into matching node", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.status, "CONFIRMED");
  });

  it("marks node as proposed when no matching hypothesis exists", () => {
    const data = buildGraphData(RESEARCH_MD, "", {}, "");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.status, "proposed");
    assert.equal(data.nodes.find(n => n.id === "RS-001")?.isProposal, true);
  });

  it("creates root→node edge for each story", () => {
    const data = buildGraphData(RESEARCH_MD, HYPOTHESES_MD, {}, "");
    assert.equal(data.edges.filter(e => e.source === "root").length, 2);
  });

  it("sets updatedAt to a recent timestamp", () => {
    const before = Date.now();
    const data = buildGraphData(RESEARCH_MD, "", {}, "");
    assert.ok(data.updatedAt >= before);
  });

  it("does not populate gates on proposed nodes", () => {
    const data = buildGraphData(RESEARCH_MD, "", {}, "");
    const node = data.nodes[0];
    assert.equal(node.gates, undefined);
  });
});
```

- [ ] **Step 2: Run — verify they fail**

```bash
npx tsx --test test/graph-state.test.ts
```

Expected: `Cannot find module '../src/graph/state.js'`

- [ ] **Step 3: Implement**

```typescript
// src/graph/state.ts
import { parseResearchDocument } from "./parser.js";
import { parseHypotheses, type HypothesisEntry } from "../state/repo.js";

export interface GraphNodeGates {
  prereg: boolean;
  judgeLock: boolean;
  baseline: boolean;
  falsif: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  description: string;
  status: "proposed" | "OPEN" | "RUNNING" | "CONFIRMED" | "FALSIFIED" | "KILLED";
  spent: number;
  costCap: number;
  stage: number;
  // Only present for registered hypotheses — undefined for proposals
  gates?: GraphNodeGates;
  isProposal: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphRoot {
  id: "root";
  label: string;
  summary: string;
}

export interface GraphData {
  root: GraphRoot;
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: number;
}

/** Pure function — no I/O. All data pre-loaded by the caller. */
export function buildGraphData(
  researchMd: string,
  hypothesesMd: string,
  spendMap: Record<string, number>,
  resultsMd: string,
): GraphData {
  const doc = parseResearchDocument(
    researchMd || "# RD: No Research Document\n## 1. Research overview\n### 1.2 Research summary\n\n## 10. Research stories\n"
  );
  const hypotheses = hypothesesMd ? parseHypotheses(hypothesesMd) : [];
  const hypoMap = new Map<string, HypothesisEntry>(hypotheses.map(h => [h.id, h]));

  const nodes: GraphNode[] = doc.stories.map(story => {
    const hypo = hypoMap.get(story.id);
    if (!hypo) {
      return {
        id: story.id,
        label: story.title,
        description: story.description,
        status: "proposed" as const,
        spent: 0,
        costCap: 0,
        stage: 0,
        gates: undefined,   // proposals have no gates
        isProposal: true,
      };
    }
    return {
      id: story.id,
      label: hypo.claim,
      description: story.description,
      status: hypo.status,
      spent: spendMap[story.id] ?? 0,
      costCap: hypo.costCap,
      stage: deriveStageNumber(hypo, resultsMd),
      gates: undefined,  // populated by server after disk checks
      isProposal: false,
    };
  });

  return {
    root: { id: "root", label: doc.title, summary: doc.summary },
    nodes,
    edges: nodes.map(n => ({ source: "root", target: n.id })),
    updatedAt: Date.now(),
  };
}

function deriveStageNumber(hypo: HypothesisEntry, resultsMd: string): number {
  switch (hypo.status) {
    case "OPEN":      return 1;
    case "RUNNING":   return 4;
    case "CONFIRMED": return resultsMd.includes(hypo.id) ? 9 : 7;
    case "FALSIFIED": return 6;
    case "KILLED":    return 8;
    default:          return 0;
  }
}
```

- [ ] **Step 4: Run — verify they pass**

```bash
npx tsx --test test/graph-state.test.ts
```

Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/graph/state.ts test/graph-state.test.ts
git commit -m "feat: graph state aggregator — pure function, no cwd, proposals get no gates"
```

---

## Task 4: Graph Events Reader

**Files:**
- Create: `src/graph/events.ts`
- Create: `test/graph-events.test.ts`

Uses server-start timestamp to skip stale events from previous runs.

- [ ] **Step 1: Write failing tests**

```typescript
// test/graph-events.test.ts
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readGraphEvents, makeEventReader } from "../src/graph/events.js";

let tmpDir: string;
before(async () => { tmpDir = await mkdtemp(join(tmpdir(), "epistemic-test-")); });

describe("readGraphEvents", () => {
  it("returns empty array when events file does not exist", async () => {
    const reader = makeEventReader(tmpDir, Date.now());
    const events = await reader.read();
    assert.deepEqual(events, []);
  });

  it("returns events written after serverStartTime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now();
    const oldEvent = JSON.stringify({ type: "new-research", timestamp: startTime - 5000 });
    const newEvent = JSON.stringify({ type: "open-hypothesis", id: "RS-001", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${oldEvent}\n${newEvent}\n`);

    const reader = makeEventReader(dir, startTime);
    const events = await reader.read();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "open-hypothesis");
  });

  it("does not return same events twice (cursor advances)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev2-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now() - 1000;
    const event = JSON.stringify({ type: "new-research", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${event}\n`);

    const reader = makeEventReader(dir, startTime);
    await reader.read();
    const second = await reader.read();
    assert.deepEqual(second, []);
  });

  it("ignores lines with unknown event types", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev3-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now() - 1000;
    const bad = JSON.stringify({ type: "inject-malicious", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${bad}\n`);

    const reader = makeEventReader(dir, startTime);
    const events = await reader.read();
    assert.deepEqual(events, []);
  });
});
```

- [ ] **Step 2: Run — verify they fail**

```bash
npx tsx --test test/graph-events.test.ts
```

Expected: `Cannot find module '../src/graph/events.js'`

- [ ] **Step 3: Implement**

```typescript
// src/graph/events.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../state/repo.js";

export type GraphEventType = "open-hypothesis" | "new-research" | "dismiss-proposal";

export interface GraphEvent {
  type: GraphEventType;
  id?: string;
  timestamp: number;
}

const ALLOWED_TYPES = new Set<GraphEventType>(["open-hypothesis", "new-research", "dismiss-proposal"]);

export interface EventReader {
  read(): Promise<GraphEvent[]>;
}

/** Create a stateful reader that tracks cursor position in-memory. */
export function makeEventReader(cwd: string, serverStartTime: number): EventReader {
  let cursor = 0;
  const eventsPath = join(cwd, ".epistemic/graph-events.jsonl");

  return {
    async read(): Promise<GraphEvent[]> {
      if (!await fileExists(eventsPath)) return [];

      const content = await readFile(eventsPath, "utf8");
      const lines = content.split("\n").filter(Boolean);
      const newLines = lines.slice(cursor);
      cursor = lines.length;

      return newLines
        .map(l => { try { return JSON.parse(l) as GraphEvent; } catch { return null; } })
        .filter((e): e is GraphEvent =>
          e !== null &&
          ALLOWED_TYPES.has(e.type as GraphEventType) &&
          typeof e.timestamp === "number" &&
          e.timestamp >= serverStartTime
        );
    }
  };
}
```

- [ ] **Step 4: Run — verify they pass**

```bash
npx tsx --test test/graph-events.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/graph/events.ts test/graph-events.test.ts
git commit -m "feat: graph events reader with timestamp gating and type allowlist"
```

---

## Task 5: Graph HTTP Server

**Files:**
- Create: `src/graph/server.ts`
- Create: `test/graph-server.test.ts`

The HTML client is **embedded as a template literal** (no `import.meta.url` fragility). D3 is served from `node_modules`. Origin header validated — no wildcard CORS. Body size capped at 64KB.

- [ ] **Step 1: Write failing server tests**

```typescript
// test/graph-server.test.ts
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startGraphServer, type GraphServer } from "../src/graph/server.js";

let server: GraphServer;
before(async () => { server = await startGraphServer(process.cwd(), Date.now()); });
after(() => server.close());

describe("graph server", () => {
  it("serves HTML on /", async () => {
    const res = await fetch(server.url + "/");
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("epistemic"));
    assert.ok(text.includes("svg"));
  });

  it("returns JSON on GET /api/state", async () => {
    const res = await fetch(server.url + "/api/state");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok("root" in data && "nodes" in data && "edges" in data);
  });

  it("returns 204 on valid POST /api/event", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "new-research" }),
    });
    assert.equal(res.status, 204);
  });

  it("rejects unknown event types with 400", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "evil-inject" }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(65 * 1024),
    });
    assert.equal(res.status, 413);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(server.url + "/unknown");
    assert.equal(res.status, 404);
  });
});
```

- [ ] **Step 2: Run — verify they fail**

```bash
npx tsx --test test/graph-server.test.ts
```

Expected: `Cannot find module '../src/graph/server.js'`

- [ ] **Step 3: Implement the server**

```typescript
// src/graph/server.ts
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { loadHypotheses, getHypothesisSpend, fileExists, parseHypotheses } from "../state/repo.js";
import { buildGraphData, type GraphData } from "./state.js";
import { makeEventReader, type EventReader } from "./events.js";

export interface GraphServer {
  port: number;
  url: string;
  close: () => void;
  eventReader: EventReader;
}

const ALLOWED_EVENT_TYPES = new Set(["open-hypothesis", "new-research", "dismiss-proposal"]);
const MAX_BODY_BYTES = 64 * 1024;

// Resolve d3 from node_modules — works regardless of tsx vs compiled output
const req = createRequire(import.meta.url);
const D3_PATH = req.resolve("d3/dist/d3.min.js");

// ── Client HTML (embedded — no file path fragility) ──────────────────────
const CLIENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ξ epistemic · graph</title>
<script>/* D3 injected by server */</script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0f0a00; color: #f59e0b; font-family: 'SF Mono','Fira Code',monospace; font-size: 13px; height: 100vh; overflow: hidden; }
#header { padding: 12px 20px; border-bottom: 1px solid #1a1000; display: flex; align-items: center; gap: 12px; }
#header h1 { font-size: 14px; color: #fbbf24; font-weight: normal; }
#header .stats { color: #888; font-size: 11px; margin-left: auto; }
#graph { width: 100vw; height: calc(100vh - 49px); }
.node { cursor: pointer; }
.node text { fill: #f59e0b; font-size: 11px; pointer-events: none; }
.node .sub { fill: #888; font-size: 9px; }
.link { fill: none; stroke: #333; stroke-width: 1.5px; }
.status-proposed circle { fill: none; stroke: #f59e0b; stroke-width: 1.5; stroke-dasharray: 4,2; opacity: 0.6; }
.status-OPEN circle { fill: none; stroke: #f59e0b; stroke-width: 2; }
.status-RUNNING circle { fill: #f59e0b; fill-opacity: 0.15; stroke: #f59e0b; stroke-width: 2; animation: pulse 2s ease-in-out infinite; }
.status-CONFIRMED circle { fill: #22c55e; fill-opacity: 0.15; stroke: #22c55e; stroke-width: 2; }
.status-FALSIFIED circle { fill: none; stroke: #ef4444; stroke-width: 2; }
.status-KILLED circle { fill: #ef4444; fill-opacity: 0.3; stroke: #ef4444; opacity: 0.6; }
@keyframes pulse { 0%,100%{fill-opacity:.1}50%{fill-opacity:.3} }
#card { position:fixed; top:60px; right:20px; width:240px; background:#1a1000; border:1px solid #f59e0b; border-radius:8px; padding:16px; display:none; z-index:100; }
#card h3 { color:#fbbf24; font-size:12px; margin-bottom:4px; }
#card .claim { color:#888; font-size:11px; margin-bottom:12px; line-height:1.5; }
#card .meta { font-size:11px; color:#888; line-height:2; }
#card .hl { color:#f59e0b; }
#card .gates { font-size:10px; color:#555; margin:8px 0; line-height:1.8; }
#card .ok { color:#22c55e; }
#card .open-btn { display:block; width:100%; margin-top:12px; padding:8px; background:#f59e0b; color:#000; border:none; border-radius:4px; font-family:inherit; font-size:11px; cursor:pointer; }
#card .open-btn:hover { background:#fbbf24; }
#card .dismiss-btn { display:block; width:100%; margin-top:6px; padding:6px; background:transparent; color:#555; border:1px solid #333; border-radius:4px; font-family:inherit; font-size:11px; cursor:pointer; }
#card .x { position:absolute; top:10px; right:12px; color:#555; cursor:pointer; }
#new-btn { position:fixed; bottom:20px; right:20px; background:transparent; border:2px dashed #f59e0b; color:#f59e0b; border-radius:8px; padding:12px 20px; font-family:inherit; font-size:13px; cursor:pointer; opacity:0.7; transition:opacity .2s; }
#new-btn:hover { opacity:1; }
#empty { display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; color:#333; }
#empty p { margin-top:8px; font-size:12px; }
</style>
</head>
<body>
<div id="header">
  <h1>Ξ epistemic</h1>
  <span id="ht" style="color:#888"></span>
  <span class="stats" id="hs"></span>
</div>
<svg id="graph"></svg>
<div id="card">
  <span class="x" onclick="closeCard()">✕</span>
  <h3 id="cid"></h3>
  <div class="claim" id="cclaim"></div>
  <div class="meta">
    Status: <span class="hl" id="cstatus"></span><br>
    Stage: <span class="hl" id="cstage"></span><br>
    Cost: <span class="hl" id="ccost"></span>
  </div>
  <div class="gates" id="cgates"></div>
  <button class="open-btn" onclick="openInTerminal()">Open in terminal →</button>
  <button class="dismiss-btn" id="cdismiss" onclick="dismissProposal()" style="display:none">Dismiss proposal</button>
</div>
<div id="empty"><div style="font-size:32px;color:#333">○</div><p>No research document yet.</p><p>Type <span style="color:#f59e0b">/new</span> in the terminal.</p></div>
<button id="new-btn" onclick="send({type:'new-research'})">+ New Research</button>
<script>
let sel = null;
async function send(ev) {
  try { await fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)}); } catch{}
}
function openInTerminal() { if(sel) send({type:'open-hypothesis',id:sel.id}); closeCard(); }
function dismissProposal() { if(sel) send({type:'dismiss-proposal',id:sel.id}); closeCard(); }
function closeCard() { document.getElementById('card').style.display='none'; sel=null; }
function showCard(n) {
  sel=n;
  document.getElementById('cid').textContent=n.id;
  document.getElementById('cclaim').textContent=n.label;
  document.getElementById('cstatus').textContent=n.status;
  document.getElementById('cstage').textContent=n.stage>0?n.stage+'/9':'—';
  document.getElementById('ccost').textContent=n.costCap>0?'$'+n.spent.toFixed(2)+'/$'+n.costCap:'—';
  const g=n.gates;
  document.getElementById('cgates').innerHTML=g
    ?['prereg','judgeLock','baseline','falsif'].map(k=>'<span class="'+(g[k]?'ok':'')+'">'+(g[k]?'✓':'✗')+' '+k+'</span>').join('  ')
    :'<span style="color:#555">not registered</span>';
  document.getElementById('cdismiss').style.display=n.isProposal?'block':'none';
  document.getElementById('card').style.display='block';
}
function render(data) {
  document.getElementById('empty').style.display=(data.nodes.length===0)?'block':'none';
  if(!data.nodes.length) return;
  document.getElementById('ht').textContent=data.root.label;
  const r=data.nodes.filter(n=>n.status==='RUNNING').length,
        c=data.nodes.filter(n=>n.status==='CONFIRMED').length,
        k=data.nodes.filter(n=>n.status==='KILLED').length;
  document.getElementById('hs').textContent=r+' running · '+c+' confirmed · '+k+' killed';
  const svg=d3.select('#graph'), W=svg.node().clientWidth||innerWidth, H=svg.node().clientHeight||(innerHeight-49);
  svg.attr('width',W).attr('height',H).selectAll('*').remove();
  const g=svg.append('g').attr('transform','translate('+W/2+',40)');
  const hier=d3.hierarchy({id:'root',isRoot:true,label:data.root.label,children:data.nodes.map(n=>({...n,children:[]}))});
  d3.tree().size([W-80,H-120])(hier);
  g.selectAll('.link').data(hier.links()).enter().append('path').attr('class','link')
    .attr('d',d3.linkVertical().x(d=>d.x-W/2).y(d=>d.y));
  const node=g.selectAll('.node').data(hier.descendants()).enter().append('g')
    .attr('class',d=>d.data.isRoot?'node':'node status-'+d.data.status)
    .attr('transform',d=>'translate('+(d.x-W/2)+','+d.y+')')
    .on('click',(ev,d)=>{ if(!d.data.isRoot){showCard(d.data);ev.stopPropagation();}});
  node.filter(d=>d.data.isRoot).append('rect').attr('x',-65).attr('y',-12).attr('width',130).attr('height',24).attr('rx',6).attr('fill','none').attr('stroke','#555').attr('stroke-width',1.5);
  node.filter(d=>d.data.isRoot).append('text').attr('dy','.35em').attr('text-anchor','middle').attr('fill','#888').attr('font-size',11).text(d=>d.data.label.length>22?d.data.label.slice(0,22)+'…':d.data.label);
  node.filter(d=>!d.data.isRoot).append('circle').attr('r',22);
  node.filter(d=>!d.data.isRoot).append('text').attr('dy','-.15em').attr('text-anchor','middle').attr('font-size',9).attr('font-weight','bold').text(d=>d.data.id);
  node.filter(d=>!d.data.isRoot).append('text').attr('class','sub').attr('dy','1.1em').attr('text-anchor','middle').text(d=>{ const l=d.data.label; return l.length>13?l.slice(0,13)+'…':l; });
  svg.on('click',()=>closeCard());
}
async function poll() { try{ const r=await fetch('/api/state'); if(r.ok) render(await r.json()); }catch{} }
poll(); setInterval(poll,2000);
</script>
</body>
</html>`;
// ── End of embedded HTML ──────────────────────────────────────────────────

async function safeRead(path: string): Promise<string> {
  try { return await readFile(path, "utf8"); } catch { return ""; }
}

function isLocalOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin ?? "";
  return !origin || origin === "null" || /^https?:\/\/localhost(:\d+)?$/.test(origin);
}

async function handleState(cwd: string, res: ServerResponse): Promise<void> {
  const [researchMd, hypothesesMd, resultsMd] = await Promise.all([
    safeRead(join(cwd, "RESEARCH.md")),
    safeRead(join(cwd, "HYPOTHESES.md")),
    safeRead(join(cwd, "RESULTS.md")),
  ]);

  const hypotheses = hypothesesMd ? parseHypotheses(hypothesesMd) : [];
  const spendMap: Record<string, number> = {};
  for (const h of hypotheses) {
    spendMap[h.id] = await getHypothesisSpend(cwd, h.id);
  }

  const data = buildGraphData(researchMd, hypothesesMd, spendMap, resultsMd);

  // Enrich registered nodes with gate data from disk
  for (const node of data.nodes) {
    if (node.isProposal) continue;
    const expDir = join(cwd, "experiments", node.id);
    const [prereg, judgeLock, baseline] = await Promise.all([
      fileExists(join(expDir, "prereg.md")),
      fileExists(join(expDir, "judge.lock")),
      fileExists(join(expDir, "baseline.md")),
    ]);
    node.gates = {
      prereg,
      judgeLock,
      baseline,
      falsif: resultsMd.includes(node.id),
    };
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleEvent(cwd: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body = "";
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      res.writeHead(413); res.end("Request too large"); return;
    }
    body += chunk;
  }
  let event: Record<string, unknown>;
  try { event = JSON.parse(body); } catch { res.writeHead(400); res.end("Invalid JSON"); return; }
  if (!ALLOWED_EVENT_TYPES.has(String(event.type))) {
    res.writeHead(400); res.end("Unknown event type"); return;
  }
  await mkdir(join(cwd, ".epistemic"), { recursive: true });
  await appendFile(
    join(cwd, ".epistemic/graph-events.jsonl"),
    JSON.stringify({ ...event, timestamp: Date.now() }) + "\n"
  );
  res.writeHead(204); res.end();
}

export async function startGraphServer(cwd: string, serverStartTime: number): Promise<GraphServer> {
  const d3Source = await readFile(D3_PATH, "utf8");
  const html = CLIENT_HTML.replace("/* D3 injected by server */", d3Source);

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    // CORS: only allow localhost and file:// origins
    if (!isLocalOrigin(req)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "null");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    try {
      if ((url.pathname === "/" || url.pathname === "/index.html") && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html); return;
      }
      if (url.pathname === "/api/state" && req.method === "GET") {
        await handleState(cwd, res); return;
      }
      if (url.pathname === "/api/event" && req.method === "POST") {
        await handleEvent(cwd, req, res); return;
      }
      res.writeHead(404); res.end("Not found");
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      typeof addr === "object" && addr ? resolve(addr.port) : reject(new Error("No port"));
    });
  });

  const eventReader = makeEventReader(cwd, serverStartTime);
  return { port, url: `http://localhost:${port}`, close: () => server.close(), eventReader };
}
```

- [ ] **Step 4: Run server tests**

```bash
npx tsx --test test/graph-server.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/graph/server.ts test/graph-server.test.ts
git commit -m "feat: graph server — embedded HTML, local D3, origin validation, 64KB body limit"
```

---

## Task 6: CLI Integration

**Files:**
- Modify: `src/cli/epistemic.ts`

Auto-start graph server on `epistemic` launch. Add `epistemic graph` subcommand. Expose server in `process.env` for the extension to find. Never block the agent if the server fails.

- [ ] **Step 1: Apply changes to `src/cli/epistemic.ts`**

Add at the top with other imports:
```typescript
import { startGraphServer } from "../graph/server.js";
import { exec } from "node:child_process";
```

Add this helper function before `run()`:
```typescript
function openBrowser(url: string): void {
  // Only open if we're in an interactive terminal session
  if (!process.stdout.isTTY) return;
  const cmd = process.platform === "darwin" ? `open "${url}"` :
               process.platform === "win32"  ? `start "${url}"` :
                                               `xdg-open "${url}"`;
  exec(cmd, () => {});
}
```

In the `run()` function, add `graph` subcommand **before** the default agent path:
```typescript
  if (args[0] === "graph") {
    const serverStartTime = Date.now();
    const server = await startGraphServer(process.cwd(), serverStartTime);
    console.log(`Ξ epistemic graph  ${server.url}`);
    openBrowser(server.url);
    await new Promise(() => {}); // keep alive until Ctrl+C
    return;
  }
```

In the default interactive path, **before** `playIntro()`:
```typescript
  // Auto-start graph server — non-blocking, never fails the agent
  const serverStartTime = Date.now();
  try {
    const graphServer = await startGraphServer(process.cwd(), serverStartTime);
    process.env.EPISTEMIC_GRAPH_URL = graphServer.url;
    process.env.EPISTEMIC_GRAPH_PORT = String(graphServer.port);
    process.env.EPISTEMIC_GRAPH_START_TIME = String(serverStartTime);
    if (interactive) openBrowser(graphServer.url);
    process.on("exit", () => graphServer.close());
    process.on("SIGINT", () => { graphServer.close(); process.exit(0); });
  } catch {
    // Graph server is optional — proceed without it
  }
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Smoke test**

```bash
node bin/epistemic.mjs graph
# Browser opens → empty state shows "Type /new in the terminal"
# Ctrl+C to stop
```

Expected: browser opens, page loads, no console errors

- [ ] **Step 4: Commit**

```bash
git add src/cli/epistemic.ts
git commit -m "feat: auto-start graph server on launch + epistemic graph subcommand"
```

---

## Task 7: Wire Events Into the Extension

**Files:**
- Modify: `packages/omp/src/commands/epistemic.ts`

Poll `readGraphEvents` every 2s via the existing `refreshTimer`. Handle `open-hypothesis` (switch context), `new-research` (trigger brainstorm), `dismiss-proposal` (mark dismissed).

- [ ] **Step 1: Add event polling to the extension**

At the top of `packages/omp/src/commands/epistemic.ts`, add:
```typescript
import { makeEventReader, type EventReader, type GraphEvent } from "../../../../src/graph/events.js";
```

After the existing module-level state variables, add:
```typescript
let graphEventReader: EventReader | null = null;
```

Inside the `session_start` handler (find `api.on("session_start", ...)`), add after the existing widget refresh:
```typescript
    // Initialise graph event reader using server start time from env
    const startTime = parseInt(process.env.EPISTEMIC_GRAPH_START_TIME ?? "0") || Date.now();
    graphEventReader = makeEventReader(ctx.cwd, startTime);
```

Add a new `handleGraphEvents` function before the extension factory export:
```typescript
async function handleGraphEvents(ctx: ExtensionContext): Promise<void> {
  if (!graphEventReader) return;
  const events = await graphEventReader.read();
  for (const event of events) {
    await dispatchGraphEvent(event, ctx);
  }
}

async function dispatchGraphEvent(event: GraphEvent, ctx: ExtensionContext): Promise<void> {
  if (event.type === "new-research") {
    // Inject brainstorm prompt into chat
    await ctx.sendUserMessage?.(
      "Start a new research document. Use the research-question skill to begin the Socratic brainstorm."
    );
    return;
  }

  if (event.type === "open-hypothesis" && event.id) {
    const entries = await loadHypotheses(ctx.cwd);
    const entry = entries.find(e => e.id === event.id);
    if (!entry) {
      ctx.ui.notify(`Hypothesis ${event.id} not found in HYPOTHESES.md`, "warn");
      return;
    }
    // Update widget to show this hypothesis
    await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);
    ctx.ui.notify(`Switched to ${event.id}`, "info");
    await ctx.sendUserMessage?.(
      `Continue working on hypothesis ${event.id}: "${entry.claim}". Check current stage and proceed with the epistemic pipeline.`
    );
    return;
  }

  if (event.type === "dismiss-proposal" && event.id) {
    ctx.ui.notify(`Proposal ${event.id} dismissed`, "info");
    // No state change needed — dismissed proposals simply won't be opened
    return;
  }
}
```

In the existing `refreshTimer` `setInterval` callback (where `refreshEpistemicWidget` is called), add:
```typescript
    await handleGraphEvents(ctx);
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/omp/src/commands/epistemic.ts
git commit -m "feat: wire graph events into extension (open-hypothesis, new-research, dismiss-proposal)"
```

---

## Task 8: Persistent Hypothesis Header

**Files:**
- Modify: `src/tui/widget.ts`
- Modify: `packages/omp/src/commands/epistemic.ts`

Replace the two-line widget with the spec header format:
```
◎ H-001 · CoT → HumanEval   stage 4/9 · $4.20/$20 · 14/30 runs
✓ prereg   ✓ judge   ✗ stats   ✗ falsif
```

- [ ] **Step 1: Write failing test**

```typescript
// test/widget.test.ts  (add to existing file)
import { buildHypothesisHeader } from "../src/tui/widget.js";

describe("buildHypothesisHeader", () => {
  it("renders two lines for an active hypothesis", () => {
    const entry: HypothesisEntry = {
      id: "RS-001", claim: "CoT improves HumanEval pass@1",
      falsifier: "if delta < 0", bestCaseConclusion: "publish",
      n: 30, judgeRef: "gpt-4o", baselineRef: "gpt-4o-vanilla",
      costCap: 20, computeTarget: "local", status: "RUNNING", timestamp: Date.now(),
    };
    const lines = buildHypothesisHeader(entry, 4.2, { prereg: true, judgeLock: true, stats: false, falsif: false }, 14, 30);
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes("RS-001"));
    assert.ok(lines[0].includes("stage"));
    assert.ok(lines[1].includes("✓"));
    assert.ok(lines[1].includes("✗"));
  });

  it("returns empty array when no active hypothesis", () => {
    const lines = buildHypothesisHeader(undefined, 0, { prereg: false, judgeLock: false, stats: false, falsif: false }, 0, 0);
    assert.equal(lines.length, 0);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npx tsx --test test/widget.test.ts 2>&1 | grep "buildHypothesisHeader"
```

Expected: `TypeError: buildHypothesisHeader is not a function`

- [ ] **Step 3: Add `buildHypothesisHeader` to `src/tui/widget.ts`**

```typescript
export interface HypothesisGates {
  prereg: boolean;
  judgeLock: boolean;
  stats: boolean;
  falsif: boolean;
}

export function buildHypothesisHeader(
  active: HypothesisEntry | undefined,
  spent: number,
  gates: HypothesisGates,
  trialsDone: number,
  trialsTotal: number,
): string[] {
  if (!active) return [];

  const icon = STATUS_ICON[active.status] ?? "○";
  const claim = active.claim.length > 40 ? active.claim.slice(0, 40) + "…" : active.claim;
  const stage = deriveStageFromStatus(active.status);
  const cost = `$${spent.toFixed(2)}/$${active.costCap}`;
  const trials = trialsTotal > 0 ? `${trialsDone}/${trialsTotal} runs` : "";

  const line1 = `${icon} ${active.id} · ${claim}   stage ${stage}/9 · ${cost}${trials ? " · " + trials : ""}`;
  const g = (ok: boolean, label: string) => `${ok ? "✓" : "✗"} ${label}`;
  const line2 = `${g(gates.prereg, "prereg")}   ${g(gates.judgeLock, "judge")}   ${g(gates.stats, "stats")}   ${g(gates.falsif, "falsif")}`;

  return [line1, line2];
}

function deriveStageFromStatus(status: HypothesisEntry["status"]): number {
  switch (status) {
    case "OPEN":      return 2;  // preregistration
    case "RUNNING":   return 4;  // experiment-execution
    case "CONFIRMED": return 7;  // falsification-review
    case "FALSIFIED": return 6;
    case "KILLED":    return 8;
    default:          return 1;
  }
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npx tsx --test test/widget.test.ts
```

Expected: all widget tests pass

- [ ] **Step 5: Commit**

```bash
git add src/tui/widget.ts test/widget.test.ts
git commit -m "feat: buildHypothesisHeader — two-line stage/cost/gates display"
```

---

## Task 9: `/new` and `/graph` Slash Commands

**Files:**
- Modify: `packages/omp/src/commands/epistemic.ts`

- [ ] **Step 1: Add `/new` command**

Inside the extension factory, after existing `registerCommand` calls:

```typescript
  api.registerCommand("new", {
    description: "Start a new research document (Socratic brainstorm)",
    handler: async (_args, ctx) => {
      const existing = await loadHypotheses(ctx.cwd);
      if (existing.some(e => ["OPEN", "RUNNING"].includes(e.status))) {
        ctx.ui.notify("Active hypotheses exist. Finish or kill them before starting new research.", "warn");
        return;
      }
      ctx.ui.notify("Starting research brainstorm...", "info");
      await ctx.sendUserMessage?.(
        "Begin a new research document. Follow the research-question skill: ask one Socratic question at a time to fill the Research Document template from docs/research-document.md. When all slots are filled, write RESEARCH.md to the repo root."
      );
    },
  });
```

- [ ] **Step 2: Add `/graph` command**

```typescript
  api.registerCommand("graph", {
    description: "Open the hypothesis graph in the browser",
    handler: async (_args, ctx) => {
      const url = process.env.EPISTEMIC_GRAPH_URL;
      if (!url) {
        ctx.ui.notify("Graph server not running. Start epistemic normally to auto-launch it.", "warn");
        return;
      }
      const { exec } = await import("node:child_process");
      const cmd = process.platform === "darwin" ? `open "${url}"` :
                  process.platform === "win32"  ? `start "${url}"` : `xdg-open "${url}"`;
      exec(cmd, () => {});
      ctx.ui.notify(`Graph open at ${url}`, "info");
    },
  });
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/omp/src/commands/epistemic.ts
git commit -m "feat: /new and /graph slash commands"
```

---

## Task 10: Kill/Ship S/K/P/R Shortcuts

**Files:**
- Modify: `packages/omp/src/commands/epistemic.ts`

When the active hypothesis is at stage 8 (kill-or-ship), capture S/K/P/R keypresses and execute the decision. The gate checks are already enforced by `kill-criteria.ts`; this adds the fast-path UX.

- [ ] **Step 1: Add kill-or-ship keypress handler**

In the extension factory, inside the `session_start` handler, add after the `onTerminalInput` handler that already exists for monitor navigation:

```typescript
    // Kill-or-ship shortcuts when at decision stage
    ctx.ui.onTerminalInput?.((data: string) => {
      handleKillShipKey(data, ctx).catch(() => {});
      return undefined; // don't consume — let normal input through
    });
```

Add the handler function:

```typescript
async function handleKillShipKey(data: string, ctx: ExtensionContext): Promise<void> {
  const entries = await loadHypotheses(ctx.cwd);
  const active = getActiveHypothesis(entries);
  if (!active) return;

  // Only intercept at kill-or-ship stage (CONFIRMED or FALSIFIED, gates done)
  const isAtDecision = active.status === "CONFIRMED" || active.status === "FALSIFIED";
  if (!isAtDecision) return;

  const key = data.trim().toLowerCase();
  if (!["s", "k", "p", "r"].includes(key)) return;

  const actions: Record<string, string> = {
    s: "SHIP",
    k: "KILL",
    p: "PIVOT",
    r: "REFINE",
  };
  const decision = actions[key]!;

  ctx.ui.notify(`Decision: ${decision} — processing...`, "info");
  await ctx.sendUserMessage?.(
    `Execute the kill-or-ship skill with decision: ${decision} for hypothesis ${active.id}. Follow the skill instructions exactly.`
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/omp/src/commands/epistemic.ts
git commit -m "feat: S/K/P/R kill-or-ship keyboard shortcuts at decision stage"
```

---

## Task 11: RESEARCH.md Writer

**Files:**
- Modify: `skills/research-question/SKILL.md`

The brainstorm conversation ends by writing `RESEARCH.md`. This is a skill instruction change — no TypeScript code needed. The agent follows the updated skill.

- [ ] **Step 1: Read current skill**

```bash
cat skills/research-question/SKILL.md
```

- [ ] **Step 2: Add RESEARCH.md output instruction**

At the end of the skill's instructions, add:

```markdown
## Output: writing RESEARCH.md

When all slots are filled and confirmed:

1. Generate the complete Research Document using the template from `docs/research-document.md`
2. Write it to `RESEARCH.md` in the repo root (overwrite if exists)
3. For each Research Story (RS-001, RS-002, ...) in section 10, append a corresponding entry to `HYPOTHESES.md`:

```
## Hypothesis: RS-NNN
- **Claim**: <story title>
- **Status**: OPEN
- **Cost Cap**: 50
- **N**: 30
- **Compute Target**: local
- **Timestamp**: <unix ms>
```

4. Notify the user: "Research Document written to RESEARCH.md. Open the graph to see your hypotheses."

The graph panel will auto-refresh within 2 seconds and display the Research Document as the root node with Research Stories as circles.
```

- [ ] **Step 3: Commit**

```bash
git add skills/research-question/SKILL.md
git commit -m "feat: research-question skill writes RESEARCH.md + HYPOTHESES.md on completion"
```

---

## Task 12: Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm run verify
```

Expected: typecheck passes + all tests pass

- [ ] **Step 2: Manual end-to-end smoke test**

```bash
# 1. Start epistemic
node bin/epistemic.mjs

# 2. Browser opens → shows empty graph
# 3. Click "+ New Research" in browser
#    → terminal receives "new-research" event
#    → agent begins brainstorm

# 4. Complete brainstorm → RESEARCH.md written
# 5. Graph auto-refreshes → root node + RS circles appear

# 6. Click RS-001 in browser → details card appears
# 7. Click "Open in terminal →"
#    → terminal receives "open-hypothesis" event
#    → agent switches context to RS-001

# 8. When hypothesis reaches CONFIRMED: type S in terminal
#    → agent runs kill-or-ship SHIP

# 9. Graph node turns green within 2s
```

- [ ] **Step 3: Push**

```bash
git push
```

---

## Out of Scope (future plan)

- Multi-hypothesis parent edges in graph (branches from sub-hypotheses, not only root)
- Proposal auto-detection from trial variance (requires agent hook post-`falsification-review`)
- Session persistence per hypothesis (pi sessions are single-context today)
- Port reuse across multiple `epistemic` instances in the same repo
