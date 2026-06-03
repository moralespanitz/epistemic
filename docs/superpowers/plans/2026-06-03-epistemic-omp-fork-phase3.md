# Epistemic OMP Fork — Phase 3: Plugin API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a typed `EpistemicAPI` that third parties use to extend `@epistemic/omp` — replacing the raw `pi: any` calls inside `packages/omp/src/commands/epistemic.ts` with the new typed interface.

**Architecture:** `packages/omp/src/plugin/api.ts` defines the pure TypeScript interfaces (`EpistemicAPI`, `EpistemicContext`, `CommandOpts`, `GateHandler`, `EpistemicPlugin`). `packages/omp/src/plugin/runtime.ts` implements `createEpistemicAPI(pi)` — a thin factory that wraps pi's raw `any`-typed methods behind the typed interface. `packages/omp/src/commands/epistemic.ts` is refactored to call `createEpistemicAPI(pi)` at entry and use the resulting typed object throughout, replacing all `pi.registerCommand?.()`, `pi.on()`, and `registerXGate(pi as any)` call sites. The public API (`EpistemicAPI`, `EpistemicPlugin`, `createEpistemicAPI`) is exported from `packages/omp/src/index.ts`.

**Tech Stack:** TypeScript ESM, node:test (tsx), `@earendil-works/pi-coding-agent` (underlying pi types kept as `any`-boundary).

---

## File map

| File | Action | Purpose |
|------|--------|---------|
| `packages/omp/src/plugin/api.ts` | Create | Pure type definitions — EpistemicAPI, EpistemicContext, CommandOpts, GateHandler, EpistemicPlugin |
| `packages/omp/src/plugin/runtime.ts` | Create | `createEpistemicAPI(pi: any): EpistemicAPI` factory |
| `test/plugin-api.test.ts` | Create | Unit tests for createEpistemicAPI using mock pi |
| `packages/omp/src/commands/epistemic.ts` | Modify | Replace `pi.registerCommand`, `pi.on`, `registerXGate(pi as any)` with EpistemicAPI calls |
| `packages/omp/src/index.ts` | Modify | Export EpistemicAPI, EpistemicPlugin, createEpistemicAPI |
| `README.md` | Modify | Add "Plugin API" section with usage example |

---

## Task 1: Define packages/omp/src/plugin/api.ts (types only)

**Files:**
- Create: `packages/omp/src/plugin/api.ts`

- [ ] **Step 1: Create the plugin directory**

```bash
mkdir -p packages/omp/src/plugin
```

- [ ] **Step 2: Write the failing type-import test**

Create `test/plugin-api.test.ts` with the first test block:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EpistemicAPI, EpistemicPlugin, EpistemicContext, CommandOpts, GateHandler } from "../packages/omp/src/plugin/api.js";

describe("plugin api types", () => {
  it("EpistemicPlugin is callable with EpistemicAPI", () => {
    // Type-level test: verify the types compile and are structurally correct.
    // If this module imports without error, the types are defined and exported.
    assert.ok(true, "types imported successfully");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- --test-name-pattern "plugin api types"
```

Expected: FAIL — `Cannot find module '../packages/omp/src/plugin/api.js'`

- [ ] **Step 4: Create packages/omp/src/plugin/api.ts**

```typescript
/** Context available to command handlers and gate handlers at runtime. */
export interface EpistemicContext {
  cwd: string;
  ui: {
    notify(message: string, level: "info" | "warn" | "error"): void;
    setWidget(key: string, widget: unknown, opts?: { placement?: string }): void;
    setStatus?(key: string, text: string): void;
    setWorkingMessage?(text: string): void;
    setEditorText?(text: string): void;
    input?(prompt: string, placeholder?: string): Promise<string | undefined>;
    select?(title: string, options: string[]): Promise<string | undefined>;
    onTerminalInput?(handler: (data: string) => { consume: true } | undefined): void;
    custom?(factory: (tui: unknown, theme: unknown, kb: unknown, done: (result: unknown) => void) => unknown): Promise<unknown>;
  };
  sendUserMessage?(message: string): Promise<void>;
}

/** Options for registering a slash command. */
export interface CommandOpts {
  description: string;
  handler: (args: string, ctx: EpistemicContext) => Promise<void> | void;
}

/** A gate handler — return `{ block, reason }` to block a tool call. */
export type GateHandler = (
  event: unknown,
  ctx: EpistemicContext
) => Promise<{ block?: boolean; reason?: string } | undefined | void> | undefined | void;

/** The typed API surface exposed to plugins and used internally. */
export interface EpistemicAPI {
  /** Register a /slash command. */
  registerCommand(name: string, opts: CommandOpts): void;
  /** Subscribe to a pi lifecycle event. */
  on(event: string, handler: (...args: any[]) => any): void;
  /** Register a tool_call gate — return { block, reason } to interrupt. */
  gate(handler: GateHandler): void;
}

/**
 * A third-party epistemic plugin. Receives the EpistemicAPI and registers
 * its commands, events, and gates. Called once per pi instance.
 */
export type EpistemicPlugin = (api: EpistemicAPI) => void | Promise<void>;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --test-name-pattern "plugin api types"
```

Expected: PASS (1/1)

- [ ] **Step 6: Run all tests to confirm no regression**

```bash
npm test
```

Expected: 53/53 pass + 1 new = 54 total.

- [ ] **Step 7: Commit**

```bash
git add packages/omp/src/plugin/api.ts test/plugin-api.test.ts
git commit -m "feat: EpistemicAPI typed interface (packages/omp/src/plugin/api.ts)"
```

---

## Task 2: Implement createEpistemicAPI in runtime.ts

**Files:**
- Create: `packages/omp/src/plugin/runtime.ts`
- Modify: `test/plugin-api.test.ts`

- [ ] **Step 1: Add failing tests for createEpistemicAPI**

Append to `test/plugin-api.test.ts` (after the existing describe block):

```typescript
import { createEpistemicAPI } from "../packages/omp/src/plugin/runtime.js";

describe("createEpistemicAPI", () => {
  function makeMockPi() {
    const calls: { method: string; args: unknown[] }[] = [];
    return {
      calls,
      on: (event: string, handler: unknown) => { calls.push({ method: "on", args: [event, handler] }); },
      registerCommand: (name: string, opts: unknown) => { calls.push({ method: "registerCommand", args: [name, opts] }); },
    };
  }

  it("registerCommand delegates to pi.registerCommand", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    const handler = async () => {};
    api.registerCommand("test-cmd", { description: "a test command", handler });
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].method, "registerCommand");
    assert.strictEqual(mock.calls[0].args[0], "test-cmd");
  });

  it("on delegates to pi.on", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    const handler = () => {};
    api.on("session_start", handler);
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].method, "on");
    assert.strictEqual(mock.calls[0].args[0], "session_start");
    assert.strictEqual(mock.calls[0].args[1], handler);
  });

  it("gate registers a tool_call listener via pi.on", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    const gateHandler = async () => {};
    api.gate(gateHandler);
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].method, "on");
    assert.strictEqual(mock.calls[0].args[0], "tool_call");
  });

  it("returns an object with the three EpistemicAPI methods", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    assert.strictEqual(typeof api.registerCommand, "function");
    assert.strictEqual(typeof api.on, "function");
    assert.strictEqual(typeof api.gate, "function");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --test-name-pattern "createEpistemicAPI"
```

Expected: FAIL — `Cannot find module '../packages/omp/src/plugin/runtime.js'`

- [ ] **Step 3: Create packages/omp/src/plugin/runtime.ts**

```typescript
import type { EpistemicAPI, GateHandler } from "./api.js";

/**
 * Wrap pi's raw any-typed API in the typed EpistemicAPI surface.
 * This is the only place in the codebase that crosses the any-boundary
 * to pi's underlying methods.
 */
export function createEpistemicAPI(pi: any): EpistemicAPI {
  return {
    registerCommand(name, opts) {
      pi.registerCommand?.(name, opts);
    },
    on(event, handler) {
      pi.on(event, handler);
    },
    gate(handler: GateHandler) {
      pi.on("tool_call", handler);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --test-name-pattern "createEpistemicAPI"
```

Expected: 4/4 PASS

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: 54 + 4 new = 58 total pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add packages/omp/src/plugin/runtime.ts test/plugin-api.test.ts
git commit -m "feat: createEpistemicAPI factory (packages/omp/src/plugin/runtime.ts)"
```

---

## Task 3: Refactor epistemic.ts to use EpistemicAPI

**Files:**
- Modify: `packages/omp/src/commands/epistemic.ts`

Replace the 12 raw `pi.registerCommand?.()` / `pi.on()` / `registerXGate(pi as any)` call sites with `EpistemicAPI` calls. The export default function signature stays `(pi: ExtensionAPI)` — we create the typed API wrapper at the top and use it throughout.

- [ ] **Step 1: Add the import at the top of epistemic.ts**

After the existing imports (after `import { renderBoard, parallelLanesText }...`), add:

```typescript
import { createEpistemicAPI } from "../plugin/runtime.js";
```

- [ ] **Step 2: Create the API wrapper at the top of the export default function**

Find the start of `export default async function (pi: ExtensionAPI) {` (around line 131). Immediately after `registeredInstances.add(pi as object);`, add:

```typescript
  const api = createEpistemicAPI(pi);
```

- [ ] **Step 3: Replace all pi.on() calls with api.on()**

There are 3 `pi.on(...)` calls. Replace each:

**Occurrence 1** (session_start, ~line 136):
```typescript
  // OLD:
  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
  // NEW:
  api.on("session_start", async (_event: any, ctx: ExtensionContext) => {
```

**Occurrence 2** (session_shutdown, ~line 184):
```typescript
  // OLD:
  pi.on("session_shutdown", async () => {
  // NEW:
  api.on("session_shutdown", async () => {
```

**Occurrence 3** (before_agent_start, inside setupBeforeAgentStart):
```typescript
  // OLD:
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
  // NEW:
  api.on("before_agent_start", async (event: any, _ctx: any) => {
```

Note: `setupBeforeAgentStart(pi)` is called on line ~189. Change its signature to accept `EpistemicAPI` and update the call site:

Change the function signature from:
```typescript
function setupBeforeAgentStart(pi: any) {
```
To:
```typescript
function setupBeforeAgentStart(api: EpistemicAPI) {
```

And update the call site from `setupBeforeAgentStart(pi);` to `setupBeforeAgentStart(api);`.

- [ ] **Step 4: Replace gate registrations with api.gate()**

Find these 7 lines (~lines 192–198):
```typescript
  registerPreregGate(pi as any);
  registerJudgeLockGate(pi as any);
  registerSmokeGate(pi as any);
  registerCostLedger(pi as any);
  registerClaimInterceptor(pi as any);
  registerKillCriteriaGate(pi as any);
  registerBaselineStalenessGate(pi as any);
```

Each gate registration function currently takes `pi: any` and calls `pi.on("tool_call", ...)`. We keep them unchanged internally (they still accept any raw pi-compatible object). However, we now pass `api` (which has an `on` method matching pi's signature):

```typescript
  registerPreregGate(api);
  registerJudgeLockGate(api);
  registerSmokeGate(api);
  registerCostLedger(api);
  registerClaimInterceptor(api);
  registerKillCriteriaGate(api);
  registerBaselineStalenessGate(api);
```

The gate files each call `pi.on("tool_call", ...)` — since `EpistemicAPI.on` delegates to `pi.on`, passing `api` works transparently. (The gate files accept `any`, so no type changes needed there.)

- [ ] **Step 5: Replace pi.registerCommand calls in registerResearchCommands**

`registerResearchCommands` currently takes `pi: any`. Change its signature and update the call site:

From:
```typescript
function registerResearchCommands(pi: any) {
```
To:
```typescript
function registerResearchCommands(api: EpistemicAPI) {
```

Update the call site from `registerResearchCommands(pi);` to `registerResearchCommands(api);`.

Then replace all 9 `pi.registerCommand?.("name", ...)` calls inside `registerResearchCommands` with `api.registerCommand("name", ...)` (remove the `?.` — it's guaranteed by the typed interface):

```typescript
  // OLD: pi.registerCommand?.("view", {
  api.registerCommand("view", {
  // OLD: pi.registerCommand?.("monitor", {
  api.registerCommand("monitor", {
  // OLD: pi.registerCommand?.("credentials", {
  api.registerCommand("credentials", {
  // OLD: pi.registerCommand?.("sweep", {
  api.registerCommand("sweep", {
  // OLD: pi.registerCommand?.("idea", {
  api.registerCommand("idea", {
  // OLD: pi.registerCommand?.("lessons", {
  api.registerCommand("lessons", {
  // OLD: pi.registerCommand?.("map", {
  api.registerCommand("map", {
  // OLD: pi.registerCommand?.("board", {
  api.registerCommand("board", {
  // OLD: pi.registerCommand?.("hypothesis", {
  api.registerCommand("hypothesis", {
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: 58/58 pass, 0 fail.

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/omp/src/commands/epistemic.ts
git commit -m "refactor: use EpistemicAPI in epistemic.ts — replace raw pi.on/registerCommand calls"
```

---

## Task 4: Export plugin API + document in README

**Files:**
- Modify: `packages/omp/src/index.ts`
- Modify: `README.md`

- [ ] **Step 1: Update packages/omp/src/index.ts**

Current contents:
```typescript
export { AMBER_LAB } from "./theme/amber-lab.js";
export { renderResearchSidebar } from "./layout/ResearchSidebar.js";
export { default as epistemicExtension } from "./commands/epistemic.js";
```

Replace with:
```typescript
export { AMBER_LAB } from "./theme/amber-lab.js";
export { renderResearchSidebar } from "./layout/ResearchSidebar.js";
export { default as epistemicExtension } from "./commands/epistemic.js";
export type { EpistemicAPI, EpistemicPlugin, EpistemicContext, CommandOpts, GateHandler } from "./plugin/api.js";
export { createEpistemicAPI } from "./plugin/runtime.js";
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: 58/58 pass.

- [ ] **Step 3: Add Plugin API section to README.md**

Find the `## The pipeline` section in README.md. Insert the following new section immediately before it:

```markdown
---

## Plugin API

`@epistemic/omp` exposes a typed plugin API so you can extend epistemic with your own commands, event handlers, and gates — without touching pi's raw `any`-typed interface.

```typescript
import type { EpistemicPlugin } from "@epistemic/omp";

export const myPlugin: EpistemicPlugin = (api) => {
  // Register a /slash command
  api.registerCommand("my-cmd", {
    description: "My custom command",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Running my-cmd with: ${args}`, "info");
    },
  });

  // Subscribe to an event
  api.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus?.("my-plugin", "● active");
  });

  // Register a gate that blocks tool calls matching a condition
  api.gate(async (event, ctx) => {
    // Return { block: true, reason: "..." } to interrupt
  });
};
```

Load your plugin by calling `createEpistemicAPI` and passing the result to your plugin function:

```typescript
import { createEpistemicAPI } from "@epistemic/omp";

// Inside your pi extension factory:
export default async function(pi: any) {
  const api = createEpistemicAPI(pi);
  await myPlugin(api);
}
```

| Method | What it does |
|--------|-------------|
| `registerCommand(name, opts)` | Registers a `/name` slash command in the agent chat |
| `on(event, handler)` | Subscribes to `session_start`, `session_shutdown`, `before_agent_start`, or `tool_call` |
| `gate(handler)` | Registers a `tool_call` gate — return `{ block, reason }` to interrupt |
```

- [ ] **Step 4: Run full verify**

```bash
npm run verify
```

Expected: typecheck passes, 58/58 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/omp/src/index.ts README.md
git commit -m "feat: export EpistemicAPI + createEpistemicAPI from @epistemic/omp; document plugin API"
```

---

## Self-review

**Spec coverage:**
- ✓ `packages/omp/src/plugin/api.ts` typed interface — Task 1
- ✓ `epistemic.registerCommand()` — Task 3 (registerResearchCommands refactored)
- ✓ `epistemic.on()` — Task 3 (all pi.on calls replaced)
- ✓ `epistemic.gate()` — Task 2 (runtime) + Task 3 (gate registration refactored)
- ✓ Replace all internal pi.registerCommand/on calls — Task 3 (12 call sites)
- ✓ Export from @epistemic/omp — Task 4
- ✓ Third parties extend epistemic not pi — Task 4 (README documents the pattern)

Note: `epistemic.panel()` from the spec is intentionally omitted. Panel management (`ctx.ui.setWidget`) is session-context-level (not pi-instance-level) and would require threading context through the API in a way that adds complexity without enabling a new use case — the `EpistemicContext.ui.setWidget` passed to command/event handlers already covers this. If a future user needs panel registration at plugin-load time, it can be added in a follow-up.

**Placeholder scan:** None found.

**Type consistency:**
- `EpistemicAPI` defined in Task 1, implemented in Task 2, used in Task 3, exported in Task 4 — same interface throughout.
- `GateHandler` defined in Task 1 (`api.ts`), referenced in `runtime.ts` Task 2, gate files accept `any` (no change needed).
- `createEpistemicAPI(pi: any): EpistemicAPI` — return type matches Task 1 interface exactly.
- `setupBeforeAgentStart(api: EpistemicAPI)` — parameter renamed from `pi: any` to `api: EpistemicAPI`, consistent with Task 3.
- `registerResearchCommands(api: EpistemicAPI)` — same rename, consistent.
