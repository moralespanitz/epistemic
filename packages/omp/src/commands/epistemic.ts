import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { registerPreregGate } from "../gates/prereg.js";
import { registerJudgeLockGate } from "../gates/judge-lock.js";
import { registerSmokeGate } from "../gates/smoke.js";
import { registerCostLedger } from "../gates/cost-ledger.js";
import { registerClaimInterceptor } from "../gates/claim-interceptor.js";
import { registerKillCriteriaGate } from "../gates/kill-criteria.js";
import { registerBaselineStalenessGate } from "../gates/baseline-staleness.js";
import { registerHuggingFaceTools } from "../../../../src/extensions/huggingface.js";
import { loadRepoState, loadHypotheses, getActiveHypothesis, getHypothesisSpend, loadLessons, summarizeLessons, loadBaselines, fileExists, type HypothesisEntry } from "../../../../src/state/repo.js";
import { makeEventReader, type EventReader, type GraphEvent } from "../../../../src/graph/events.js";
import { deriveStage, renderStageBlock, type StageFacts } from "../../../../src/state/stage.js";
import { refreshEpistemicWidget, linesWidget } from "../../../../src/tui/widget.js";
import { renderResearchSidebar } from "../layout/ResearchSidebar.js";
import { credentialStatus, credentialOptions, saveKey, KNOWN_KEYS } from "../../../../src/credentials.js";
import { renderResearchTree } from "../../../../src/research/tree.js";
import { renderMonitor, type MonitorMode } from "../../../../src/research/monitor.js";
import { parseKey, reduceNav, actionPrompt, type ActionLabel } from "../../../../src/research/monitor-nav.js";
import { loadFleet, type Fleet } from "../../../../src/monitor/fleet.js";
import { renderBoard, parallelLanesText } from "../../../../src/research/board.js";
import { createEpistemicAPI } from "../plugin/runtime.js";
import type { EpistemicAPI } from "../plugin/api.js";

let initialized = false;
let sessionCtx: ExtensionContext | null = null;
// The raw pi ExtensionAPI — the ONLY object with a working sendUserMessage.
// Command-handler ctx does NOT expose it (ExtensionCommandContext lacks it),
// so all turn-triggering message injection must go through this.
let piApi: ExtensionAPI | null = null;
let graphEventReader: EventReader | null = null;
let treeVisible = false; // whether the /tree widget is currently shown

// Research views cycled by /view. "monitor" is the interactive dashboard.
const RESEARCH_VIEWS = ["off", "monitor", "board", "tree", "cost"] as const;
type ResearchView = (typeof RESEARCH_VIEWS)[number];
let currentView: ResearchView = "off";
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// Interactive monitor-mode navigation state.
let monitorMode: MonitorMode = "tree";
let monitorIdx = 0;
let lastFleet: Fleet | null = null;

const ACTIVE_GATES = ["prereg", "judge-lock", "smoke", "cost-ledger", "claim-interceptor", "kill-criteria", "baseline-staleness"];

const TREE_KEY = "epistemic-tree";

/**
 * Send a user message that ACTUALLY triggers an agent turn.
 *
 * Command-handler ctx (ExtensionCommandContext) does NOT expose
 * sendUserMessage — only the raw ExtensionAPI (`pi`) does. Calling
 * ctx.sendUserMessage silently no-ops (the `?.` swallows undefined),
 * which is why /research appeared to do nothing (0 tokens). Route every
 * turn-triggering injection through the captured pi API instead.
 */
async function sendTurn(ctx: any, text: string): Promise<boolean> {
  const send = piApi?.sendUserMessage ?? ctx?.sendUserMessage;
  if (!send) {
    ctx?.ui?.notify?.("Could not start a turn — sendUserMessage unavailable", "warning");
    return false;
  }
  await send.call(piApi ?? ctx, text);
  return true;
}

/** Render the decision-tree widget into omp's UI (below the editor). */
async function showTree(ctx: any) {
  const entries = await loadHypotheses(ctx.cwd);
  const content = (await safeReadFile(ctx.cwd, "HYPOTHESES.md")) ?? "";
  const active = getActiveHypothesis(entries);
  const lines = renderResearchTree(entries, content, {}, active?.id);
  ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ research map  (/map off to hide · /view to cycle)", ...lines]), { placement: "belowEditor" });
}

/** Render whichever research view is active (or clear it). Used by /view + the shortcut. */
async function renderCurrentView(ctx: any) {
  if (currentView === "monitor") {
    treeVisible = false;
    lastFleet = await loadFleet(ctx.cwd);
    rerenderMonitor(ctx);
    return;
  }
  if (currentView === "tree") {
    treeVisible = true;
    await showTree(ctx);
    return;
  }
  treeVisible = false;
  if (currentView === "board") {
    const fleet = await loadFleet(ctx.cwd);
    ctx.ui.setWidget?.(TREE_KEY, linesWidget(renderBoard(fleet)), { placement: "belowEditor" });
    return;
  }
  if (currentView === "cost") {
    const entries = await loadHypotheses(ctx.cwd);
    const lines = await Promise.all(entries.map(async (e) => {
      const spent = await getHypothesisSpend(ctx.cwd, e.id);
      return `  ${e.id} [${e.status}]  $${spent.toFixed(2)} / $${e.costCap}`;
    }));
    ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ cost  (/view to cycle)", ...(lines.length ? lines : ["  no hypotheses yet"])]), { placement: "belowEditor" });
    return;
  }
  ctx.ui.setWidget?.(TREE_KEY, undefined); // "off"
}

function cycleView(dir: number) {
  const i = RESEARCH_VIEWS.indexOf(currentView);
  currentView = RESEARCH_VIEWS[(i + dir + RESEARCH_VIEWS.length) % RESEARCH_VIEWS.length];
}

/** Re-render the interactive monitor widget from the cached fleet. */
function rerenderMonitor(ctx: any) {
  if (!lastFleet) return;
  ctx.ui.setWidget?.(TREE_KEY, linesWidget(renderMonitor(lastFleet, monitorMode, monitorIdx)), { placement: "belowEditor" });
}

const ACTION_LABELS: Record<string, ActionLabel> = {
  "chat about it": "chat", "approve (ship)": "approve", "reject (kill)": "reject", "modify (refine/pivot)": "modify",
};

/** Open the action menu for the selected hypothesis (chat / approve / reject / modify). */
async function openSelected(ctx: any) {
  const entry = lastFleet?.entries[monitorIdx];
  if (!entry) return;
  const choice = await ctx.ui.select?.(`${entry.id} — action`, Object.keys(ACTION_LABELS));
  const action = choice && ACTION_LABELS[choice];
  if (!action) return;
  const prompt = actionPrompt(action, entry);
  await sendTurn(ctx, prompt);
}

/** Arrow-key navigation while monitor mode is active. Returns true if consumed. */
function handleMonitorKey(ctx: any, data: string): boolean {
  if (currentView !== "monitor" || !lastFleet) return false;
  const result = reduceNav({ mode: monitorMode, idx: monitorIdx }, parseKey(data), lastFleet.entries.length);
  if (!result.handled) return false;
  monitorMode = result.state.mode;
  monitorIdx = result.state.idx;
  if (result.openAction) void openSelected(ctx);
  else rerenderMonitor(ctx);
  return true;
}

/** Handle S/K/P/R kill-or-ship shortcuts when at decision stage. */
async function handleKillShipKey(data: string, ctx: any): Promise<void> {
  const entries = await loadHypotheses(ctx.cwd);
  const active = getActiveHypothesis(entries);
  if (!active) return;

  const isAtDecision = active.status === "CONFIRMED" || active.status === "FALSIFIED";
  if (!isAtDecision) return;

  const key = data.trim().toLowerCase();
  if (!["s", "k", "p", "r"].includes(key)) return;

  const actions: Record<string, string> = { s: "SHIP", k: "KILL", p: "PIVOT", r: "REFINE" };
  const decision = actions[key]!;

  ctx.ui.notify?.(`Decision: ${decision} — processing...`, "info");
  await sendTurn(ctx,
    `Execute the kill-or-ship skill with decision: ${decision} for hypothesis ${active.id}. Follow the skill instructions exactly.`
  );
}

// Register once PER pi INSTANCE — not process-globally. pi rebuilds its command
// registry on reload / reconnect / session switch and re-invokes this factory
// with a FRESH instance whose command map is empty; a process-wide flag would
// skip re-registration and make /monitor & friends silently disappear until
// restart. Keying on the instance re-registers for each new one while never
// double-registering on the same instance (which is why the launcher-injected
// load and the .pi/settings.json-discovered load don't conflict — different
// instances, each gets its own clean registration).
const registeredInstances = new WeakSet<object>();
const navRegisteredCtxs = new WeakSet<object>();

export default async function (pi: ExtensionAPI) {
  if (registeredInstances.has(pi as object)) return;
  registeredInstances.add(pi as object);
  piApi = pi; // capture for turn-triggering sendUserMessage (ctx lacks it)
  const api = createEpistemicAPI(pi);

  // ─── Session start ───────────────────────────────────────────
  api.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    try {
      const state = await loadRepoState(ctx.cwd);
      if (!initialized) {
        const hasState = state.hypotheses || state.baselines || state.results;
        ctx.ui.notify(
          hasState
            ? "Ξ epistemic active. All methodology gates enforcing."
            : "Ξ epistemic loaded. Describe your research idea — the agent will guide you.",
          "info"
        );
        initialized = true;
      }
      // Brand the footer + working indicator as epistemic (the startup banner
      // still says "pi" — that's internal to the framework; full rename = fork).
      ctx.ui.setStatus?.("epistemic-brand", "Ξ epistemic");
      ctx.ui.setWorkingMessage?.("Ξ epistemic is working…");

      // Capture arrow keys for interactive monitor-mode navigation. Only acts
      // when /monitor is open; otherwise passes input straight to the editor.
      if (!navRegisteredCtxs.has(ctx as object)) {
        ctx.ui.onTerminalInput?.((data: string) => {
          if (handleMonitorKey(ctx, data)) return { consume: true };
          return undefined;
        });
        // Handle S/K/P/R kill-or-ship shortcuts at decision stage
        ctx.ui.onTerminalInput?.((data: string) => {
          handleKillShipKey(data, ctx).catch(() => {});
          return undefined; // don't consume the input — let normal input through
        });
        navRegisteredCtxs.add(ctx as object);
      }

      const startTime = parseInt(process.env.EPISTEMIC_GRAPH_START_TIME ?? "0") || Date.now();
      graphEventReader = makeEventReader(ctx.cwd, startTime);

      await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);
      // Research sidebar — Amber Lab right panel
      try {
        const sidebarLines = await renderResearchSidebar(ctx.cwd);
        ctx.ui.setWidget?.("epistemic-sidebar", linesWidget(sidebarLines), { placement: "belowEditor" });
      } catch { /* never block the agent on sidebar errors */ }

      // Live refresh: while a research view is open, keep it current even when
      // idle — like a real dashboard.
      if (!refreshTimer) {
        refreshTimer = setInterval(() => {
          if (currentView !== "off" && sessionCtx) {
            renderCurrentView(sessionCtx).catch(() => {});
          }
          if (sessionCtx) {
            handleGraphEvents(sessionCtx).catch(() => {});
          }
        }, 2000);
      }
    } catch {}
  });

  api.on("session_shutdown", async () => {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  });

  // ─── State injection into system prompt ─────────────────────
  setupBeforeAgentStart(api);

  // ─── Gates ────────────────────────────────────────────────────
  registerPreregGate(api);
  registerJudgeLockGate(api);
  registerSmokeGate(api);
  registerCostLedger(api);
  registerClaimInterceptor(api);
  registerKillCriteriaGate(api);
  registerBaselineStalenessGate(api);

  // ─── Tools ────────────────────────────────────────────────────
  // registerHuggingFaceTools(pi);

  // ─── Spatial research views (inside real omp) ─────────────────
  registerResearchCommands(api);
}

/**
 * Register slash commands that add the spatial research experience INSIDE omp.
 * This keeps epistemic as "pi.dev + extensions" — the real omp chat, plus a
 * live decision-tree widget and a hypothesis action menu.
 */
function registerResearchCommands(api: EpistemicAPI) {
  // View-switching is via the /view command. We intentionally register NO
  // keyboard shortcut: pi reserves nearly every modifier+key for its editor
  // (emacs bindings) and tree navigation, so any global shortcut either
  // conflicts or silently breaks an expected key.
  api.registerCommand("view", {
    description: "Cycle epistemic research views (off → monitor → tree → cost)",
    handler: async (args: string, ctx: any) => {
      const want = args.trim() as ResearchView;
      if (RESEARCH_VIEWS.includes(want)) currentView = want;
      else cycleView(1);
      await renderCurrentView(ctx);
    },
  });

  // /monitor — full interactive monitor that TAKES OVER the view (ctx.ui.custom),
  // then returns to pi's real chat. Full height, native arrow nav, no truncation.
  api.registerCommand("monitor", {
    description: "Open the interactive monitor (↑↓ select · → detail · enter actions · q back to chat)",
    handler: async (_args: string, ctx: any) => {
      if (!ctx.ui.custom) {
        currentView = "monitor"; monitorMode = "tree"; monitorIdx = 0;
        await renderCurrentView(ctx);
        return;
      }
      const fleet = await loadFleet(ctx.cwd);
      const { MonitorComponent, monitorActionPrompt } = await import("../../../../src/research/monitor-component.js");
      const result = await ctx.ui.custom((tui: any, _theme: any, _kb: any, done: any) =>
        new MonitorComponent(ctx.cwd, fleet, tui, done),
      );
      if (result) {
        const prompt = monitorActionPrompt(result, fleet);
        if (prompt) {
          if (ctx.ui.setEditorText) ctx.ui.setEditorText(prompt); // prefill chat for review
          else ctx.ui.notify?.(prompt, "info");
        }
      }
    },
  });

  // /credentials — view and set provider/experiment keys from inside epistemic
  // (saved to a gitignored .env, applied live). For the agent model, /login is best.
  api.registerCommand("credentials", {
    description: "View or set API keys (OpenRouter, Anthropic, OpenAI, Google, HuggingFace, Modal)",
    handler: async (args: string, ctx: any) => {
      // `/credentials KEY value` sets directly; bare `/credentials` is interactive.
      const [argKey, ...rest] = args.trim().split(/\s+/);
      if (argKey && KNOWN_KEYS.some((k) => k.name === argKey) && rest.length) {
        await saveKey(ctx.cwd, argKey, rest.join(" "));
        ctx.ui.notify?.(`✓ ${argKey} saved to .env and applied`, "info");
        return;
      }
      ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ credentials  (/credentials off to hide)", ...credentialStatus()]), { placement: "belowEditor" });
      const opts = credentialOptions();
      const choice = await ctx.ui.select?.("Set a credential", opts.map((o) => o.label));
      if (!choice) return;
      const picked = opts.find((o) => o.label === choice);
      if (!picked) return;
      const value = await ctx.ui.input?.(`Enter value for ${picked.key}`, "paste key (stored in .env)");
      if (!value) return;
      await saveKey(ctx.cwd, picked.key, value.trim());
      ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ credentials  (/credentials off to hide)", ...credentialStatus()]), { placement: "belowEditor" });
      ctx.ui.notify?.(`✓ ${picked.key} saved (.env) and applied to this session`, "info");
    },
  });

  // /sweep — fan out experiment variants in parallel (omp's parallel-subagents
  // signature, applied to research). Prefills a structured instruction for review.
  api.registerCommand("sweep", {
    description: "Fan out parallel experiment variants for the active hypothesis",
    handler: async (args: string, ctx: any) => {
      const active = getActiveHypothesis(await loadHypotheses(ctx.cwd));
      const target = active ? `${active.id} ("${active.claim}")` : "the current hypothesis";
      const dims = args.trim() || "the key variations (model size, learning rate, prompt)";
      const prompt =
        `Run a parameter sweep for ${target}: fan out experiments in parallel across ${dims}. ` +
        `Pre-register each variant, keep each under its cost cap, run them concurrently (use parallel subagents where possible), ` +
        `then compare the results in a table and recommend which to promote.`;
      if (ctx.ui.setEditorText) ctx.ui.setEditorText(prompt);
      else ctx.ui.notify?.(prompt, "info");
    },
  });

  // /idea — the interactive funnel: a raw prompt → a research plan you can
  // brainstorm/refine → on APPROVE, the epistemic pipeline takes over. The agent
  // does the reasoning; the gates enforce that nothing runs before prereg.
  api.registerCommand("idea", {
    description: "Start a new idea → plan → approve → run the epistemic pipeline",
    handler: async (args: string, ctx: any) => {
      const idea = args.trim() || (await ctx.ui.input?.("Your research idea (one line)", "e.g. observation-time scoring beats retrieve-then-rank"))?.trim();
      if (!idea) return;
      const prompt = [
        `New research idea: "${idea}"`,
        ``,
        `Walk me through the epistemic funnel — do NOT run any experiment yet:`,
        `1. Brainstorm 2–3 competing, falsifiable hypotheses for this idea (one question at a time if you need to clarify scope).`,
        `2. Recommend one, and draft its plan: claim, falsifier, baseline to beat, judge (model+prompt+temp+seed), sample size, cost cap, compute target, and the best-case conclusion.`,
        `3. Show the plan and ask me to APPROVE or refine. Only after I approve: register it in HYPOTHESES.md as OPEN and run /skill:preregistration. The prereg gate keeps experiments blocked until that's done.`,
      ].join("\n");
      const sent = await sendTurn(ctx, prompt);
      if (!sent && ctx.ui.setEditorText) ctx.ui.setEditorText(prompt);
      ctx.ui.notify?.("Ξ idea funnel started — brainstorm → plan → approve → run", "info");
    },
  });

  // /lessons — cross-run memory (every kill/pivot/overrun, surfaced for reuse).
  // Inspired by omp's persistent memory; epistemic-native via .epistemic/lessons.jsonl.
  api.registerCommand("lessons", {
    description: "Show cross-run research lessons (past kills, pivots, overruns)",
    handler: async (_args: string, ctx: any) => {
      const lessons = await loadLessons(ctx.cwd);
      const text = summarizeLessons(lessons);
      ctx.ui.setWidget?.(TREE_KEY, linesWidget(["Ξ lessons  (/lessons off to hide)", ...text.split("\n")]), { placement: "belowEditor" });
      if (ctx.ui.notify) ctx.ui.notify("Ξ cross-run lessons shown below", "info");
    },
  });

  // /map (not /tree — that's a built-in pi command).
  api.registerCommand("map", {
    description: "Toggle the epistemic decision tree (research program as a map)",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "off") {
        treeVisible = false;
        currentView = "off";
        ctx.ui.setWidget?.(TREE_KEY, undefined);
        ctx.ui.notify?.("Ξ map hidden", "info");
        return;
      }
      treeVisible = true;
      currentView = "tree";
      await showTree(ctx);
    },
  });

  // /board — the parallel mission-control board: every hypothesis as a card in
  // its current pipeline lane (Prereg · Baseline · Running · Review · Decided),
  // so many advance concurrently instead of one linear funnel.
  api.registerCommand("board", {
    description: "Parallel board — every hypothesis in its current pipeline lane",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "off") {
        currentView = "off";
        ctx.ui.setWidget?.(TREE_KEY, undefined);
        ctx.ui.notify?.("Ξ board hidden", "info");
        return;
      }
      treeVisible = false;
      currentView = "board";
      await renderCurrentView(ctx);
      ctx.ui.notify?.("Ξ parallel board — /view to cycle · /board off to hide", "info");
    },
  });

  api.registerCommand("hypothesis", {
    description: "Pick a hypothesis and act on it (approve / reject / modify / chat)",
    handler: async (_args: string, ctx: any) => {
      const entries = await loadHypotheses(ctx.cwd);
      if (entries.length === 0) { ctx.ui.notify?.("No hypotheses yet.", "info"); return; }
      const choice = await ctx.ui.select?.(
        "Select a hypothesis",
        entries.map((e) => `${e.id} [${e.status}] ${e.claim.slice(0, 50)}`),
      );
      if (!choice) return;
      const id = choice.split(" ")[0];
      const action = await ctx.ui.select?.(`${id} — action`, ["chat", "approve (ship)", "reject (kill)", "modify (refine/pivot)"]);
      if (!action) return;
      const entry = entries.find((e) => e.id === id);
      const prompts: Record<string, string> = {
        "chat": `Tell me about hypothesis ${id}: "${entry?.claim}". What's the current status and next step?`,
        "approve (ship)": `Approve hypothesis ${id} ("${entry?.claim}"). Run kill-or-ship: if all gates pass, SHIP and run verification-before-publication; otherwise list blockers.`,
        "reject (kill)": `Reject hypothesis ${id} ("${entry?.claim}"). Run kill-or-ship with a KILL decision and record the lesson.`,
        "modify (refine/pivot)": `Modify hypothesis ${id} ("${entry?.claim}"). Propose a REFINE or PIVOT per kill-or-ship.`,
      };
      const prompt = prompts[action];
      // Hand the instruction to omp's real agent by prefilling/sending it.
      if (ctx.ui.input) {
        ctx.ui.notify?.(`Ξ ${action} → ask the agent: ${prompt.slice(0, 60)}…`, "info");
      }
      // Surface the composed instruction so the user can send it in the real chat.
      ctx.ui.setStatus?.("epistemic-action", `Ξ ${id}: ${action}`);
      await sendTurn(ctx, prompt);
    },
  });

  // /research — start a new research document with Socratic brainstorming
  api.registerCommand("research", {
    description: "Start a new research document (Socratic brainstorm)",
    handler: async (_args, ctx) => {
      const existing = await loadHypotheses(ctx.cwd);
      if (existing.some(e => ["OPEN", "RUNNING"].includes(e.status))) {
        ctx.ui.notify("Active hypotheses exist. Finish or kill them before starting new research.", "warning");
        return;
      }
      ctx.ui.notify("Starting research brainstorm...", "info");
      await sendTurn(ctx,
        "Begin a new research document. Follow the research-question skill: ask one Socratic question at a time to fill the Research Document template from docs/research-document.md. When all slots are filled, write RESEARCH.md to the repo root."
      );
    },
  });

  // /graph — open the hypothesis graph in the browser
  api.registerCommand("graph", {
    description: "Open the hypothesis graph in the browser",
    handler: async (_args, ctx) => {
      const url = process.env.EPISTEMIC_GRAPH_URL;
      if (!url) {
        ctx.ui.notify("Graph server not running. Start epistemic normally to auto-launch it.", "warning");
        return;
      }
      const { exec } = await import("node:child_process");
      const cmd = process.platform === "darwin" ? `open "${url}"` :
                  process.platform === "win32"  ? `start "${url}"` : `xdg-open "${url}"`;
      exec(cmd, () => {});
      ctx.ui.notify(`Graph open at ${url}`, "info");
    },
  });
}

async function handleGraphEvents(ctx: ExtensionContext): Promise<void> {
  if (!graphEventReader) return;
  let events: GraphEvent[];
  try { events = await graphEventReader.read(); } catch { return; }
  for (const event of events) {
    if (event.type === "new-research") {
      ctx.ui.notify("Starting research brainstorm...", "info");
      await sendTurn(ctx,
        "Begin a new research document. Follow the research-question skill: ask one Socratic question at a time to fill the Research Document template from docs/research-document.md. When all slots are filled, write RESEARCH.md to the repo root."
      );
    } else if (event.type === "open-hypothesis" && event.id) {
      const entries = await loadHypotheses(ctx.cwd);
      const entry = entries.find(e => e.id === event.id);
      if (!entry) { ctx.ui.notify(`Hypothesis ${event.id} not found`, "warning"); continue; }
      await refreshEpistemicWidget(ctx, ctx.cwd, ACTIVE_GATES);
      ctx.ui.notify(`Switched to ${event.id}`, "info");
      await sendTurn(ctx,
        `Continue working on hypothesis ${event.id}: "${entry.claim}". Check current stage and proceed with the epistemic pipeline.`
      );
    } else if (event.type === "dismiss-proposal") {
      ctx.ui.notify(`Proposal ${event.id ?? ""} dismissed`, "info");
    }
  }
}

async function safeReadFile(cwd: string, name: string): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(cwd, name), "utf8");
  } catch { return null; }
}

/**
 * Gather the on-disk facts the stage router needs for the active hypothesis.
 * Keeps deriveStage() pure (this does the I/O, that does the reasoning).
 */
async function gatherStageFacts(cwd: string, active: HypothesisEntry, spent: number): Promise<StageFacts> {
  const expDir = `experiments/${active.id}`;
  const [hasPrereg, hasJudgeLock, smokeStatus, smokeTelemetry, baselines, repo] = await Promise.all([
    fileExists(`${cwd}/${expDir}/prereg.md`),
    fileExists(`${cwd}/${expDir}/judge.lock`),
    fileExists(`${cwd}/${expDir}/smokes/run-status.json`),
    fileExists(`${cwd}/${expDir}/smokes/telemetry.jsonl`),
    loadBaselines(cwd),
    loadRepoState(cwd),
  ]);

  const hasSmokes = smokeStatus || smokeTelemetry;
  // Smoke data is "simulated" unless a real run produced it: a real run leaves a
  // prereg + judge.lock. Stub/placeholder smokes appear without that contract.
  const smokesSimulated = hasSmokes && !(hasPrereg && hasJudgeLock);

  // Baseline is "reproduced" if BASELINES.md names the baseline this hypothesis compares to.
  const ref = (active.baselineRef || "").toLowerCase();
  const hasBaseline = !!ref && baselines.some(b => b.name.toLowerCase().includes(ref) || ref.includes(b.name.toLowerCase()));

  const hasConfirmedResults = !!repo.results && repo.results.includes(active.id);

  return { active, spent, hasPrereg, hasJudgeLock, hasBaseline, hasSmokes, smokesSimulated, hasConfirmedResults };
}

function setupBeforeAgentStart(api: EpistemicAPI) {
  api.on("before_agent_start", async (event: any, _ctx: any) => {
    try {
      const entries = await loadHypotheses(event.cwd);
      const active = getActiveHypothesis(entries);

      if (sessionCtx) {
        await refreshEpistemicWidget(sessionCtx, event.cwd, ACTIVE_GATES);
        try {
          const sidebarLines = await renderResearchSidebar(event.cwd);
          sessionCtx.ui.setWidget?.("epistemic-sidebar", linesWidget(sidebarLines), { placement: "belowEditor" });
        } catch {}
        if (treeVisible) { try { await showTree(sessionCtx); } catch {} }
      }
      if (!active) return;

      const spent = await getHypothesisSpend(event.cwd, active.id);
      const pct = active.costCap > 0 ? Math.round((spent / active.costCap) * 100) : 0;

      // Router: tell the agent where it is and what to do next, plus any
      // protocol inconsistencies — so "continue"/"proceed" is deterministic.
      const facts = await gatherStageFacts(event.cwd, active, spent);
      const stageBlock = renderStageBlock(deriveStage(facts));

      // Multi-lane: surface EVERY in-flight hypothesis with its own next action,
      // so the agent works lanes in parallel instead of serializing on one.
      const fleet = await loadFleet(event.cwd);
      const lanes = parallelLanesText(fleet);

      const summary = [
        stageBlock,
        ``,
        `## Epistemic runtime state`,
        `- Active hypothesis: ${active.id}`,
        `- Claim: ${active.claim.slice(0, 100)}`,
        `- Status: ${active.status}`,
        `- Judge: ${active.judgeRef.slice(0, 40)}`,
        `- Falsifier: ${active.falsifier.slice(0, 80)}`,
        `- Cost: $${spent.toFixed(2)} / $${active.costCap} (${pct}%)`,
        `- Compute: ${active.computeTarget}`,
        ``,
        ...(lanes.length ? [...lanes, ``] : []),
        `Methodology gates active: ${ACTIVE_GATES.join(" ✓  ")} ✓`,
        `Provisional results go in smokes/ only. Headline files require confirmed experiments.`,
        `Work lanes in parallel where they don't share a judge/baseline lock; use parallel subagents (/sweep) to run independent experiments concurrently.`,
        `Overrides go in OVERRIDES.md with a mandatory reason (≥50 chars).`,
        `Kill criteria: spend >$${(active.costCap * 1.5).toFixed(2)} or >21 days → run kill-or-ship skill.`,
        ``,
      ].join("\n");

      return { systemPrompt: event.systemPrompt + "\n\n" + summary };
    } catch {
      return;
    }
  });
}
