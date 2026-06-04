/**
 * `epistemic fleet` — real parallel experiment execution.
 *
 * Spawns detached `claude -p` agents in git worktree sandboxes, one per
 * OPEN/RUNNING hypothesis. Polls state files every 2s. Kill controls: arrow
 * keys to select, `k` to kill, `q` to quit (agents keep running).
 */
import { FleetController } from "./controller.js";
import type { LaneState } from "./controller.js";
import { renderForest, type PaneTree } from "../research/panes.js";

const ESC    = "\x1b[";
const ALT_ON = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE   = `${ESC}?25l`,   SHOW    = `${ESC}?25h`;
const HOME   = `${ESC}H${ESC}2J`;
const RESET  = "\x1b[0m";

// Amber Lab palette
const c = {
  amber:  (s: string) => `\x1b[38;5;214m${s}${RESET}`,
  gold:   (s: string) => `\x1b[38;5;220m${s}${RESET}`,
  green:  (s: string) => `\x1b[38;5;114m${s}${RESET}`,
  red:    (s: string) => `\x1b[38;5;196m${s}${RESET}`,
  yellow: (s: string) => `\x1b[38;5;226m${s}${RESET}`,
  dim:    (s: string) => `\x1b[2m${s}${RESET}`,
  bold:   (s: string) => `\x1b[1m${s}${RESET}`,
  gray:   (s: string) => `\x1b[38;5;240m${s}${RESET}`,
};

const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const PIPELINE = [
  "research-question",
  "preregistration",
  "baseline-reproduction",
  "experiment-execution",
  "statistical-rigor",
  "falsification-review",
  "surprise-triage",
  "kill-or-ship",
  "verification-before-publication",
];

function stageIdx(stage: string): number {
  const i = PIPELINE.indexOf(stage);
  return i >= 0 ? i : 3; // default to experiment-execution
}

function pipelineBar(stage: string): string {
  const idx = stageIdx(stage);
  return PIPELINE.map((_, i) =>
    i < idx  ? c.dim("─") :
    i === idx ? c.amber("▶") :
                c.dim("·")
  ).join("") + c.dim(` ${idx + 1}/9`);
}

function costBar(spent: number, cap: number, width = 12): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const colored = pct >= 80 ? c.red(bar) : pct >= 50 ? c.yellow(bar) : c.green(bar);
  return `${colored} ${pct}%`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function laneToPane(lane: LaneState, selected: boolean, tick: number): PaneTree {
  const spin = lane.agentAlive
    ? c.green(SPINNER[tick % SPINNER.length])
    : lane.status === "KILLED" ? c.red("✗") : c.dim("·");

  const selMark = selected ? c.amber("▶") : " ";
  const stateLabel = lane.agentAlive ? c.green("RUNNING")
    : lane.status === "KILLED" ? c.red("KILLED")
    : c.dim("WAITING");

  const title = `${selMark} ${lane.id}  ${spin}  ${stateLabel}`;

  const claim = lane.claim.length > 42
    ? lane.claim.slice(0, 42) + "…"
    : lane.claim;

  const gates = [
    lane.hasPrereg   ? c.green("prereg ✓")  : c.red("prereg ✗"),
    lane.hasBaseline ? c.green("base ✓")    : c.dim("base ·"),
    lane.hasSmokes   ? c.green("smokes ✓")  : c.dim("smokes ·"),
  ].join("  ");

  const pidLine = lane.pid
    ? c.dim(`pid ${lane.pid}  `) + c.dim(`$${lane.spent.toFixed(2)}/$${lane.costCap}`)
    : c.dim("agent not started");

  const logSep = c.dim("─── agent log " + "─".repeat(20));

  const rawLog = lane.logLines.length
    ? lane.logLines.map(l => c.gray(stripAnsi(l).slice(0, 68)))
    : [c.dim("waiting for output…")];

  return {
    title,
    lines: [
      c.bold(claim),
      pipelineBar(lane.stage),
      costBar(lane.spent, lane.costCap),
      gates,
      pidLine,
      logSep,
      ...rawLog,
    ],
  };
}

export async function runFleetApp(cwd: string): Promise<void> {
  const out = process.stdout;
  const ctrl = new FleetController();

  try { await ctrl.start(cwd); } catch (e) {
    process.stderr.write(`[fleet] start: ${e}\n`);
  }

  let state  = await ctrl.poll(cwd);
  let selIdx = 0;
  let tick   = 0;
  let stop   = false;

  const cleanup = () => {
    out.write(SHOW + ALT_OFF);
    if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
    process.stdin.pause();
  };

  const draw = () => {
    const w = out.columns ?? 120;
    const h = out.rows ?? 40;
    const { lanes } = state;
    const running = lanes.filter(l => l.agentAlive).length;
    const killed  = lanes.filter(l => l.status === "KILLED").length;

    const headerLeft =
      c.bold(c.amber("Ξ epistemic")) + c.dim(" · ") + c.bold("fleet") +
      "   " + c.green(`${running}↻`) + c.dim(" running · ") +
      (killed ? c.red(`${killed}✗`) + c.dim(" killed · ") : "") +
      c.dim(`${lanes.length} total`);
    const headerRight = c.dim("↑↓ select · k kill · q quit (agents keep running)");
    const gap = Math.max(1, w - stripAnsi(headerLeft).length - stripAnsi(headerRight).length);
    const header = headerLeft + " ".repeat(gap) + headerRight;

    if (lanes.length === 0) {
      out.write(
        HOME + header + "\n\n" +
        c.dim("  No OPEN/RUNNING hypotheses.") + "\n" +
        c.dim("  Use the epistemic skill → /idea to start one.")
      );
      return;
    }

    selIdx = Math.min(selIdx, Math.max(0, lanes.length - 1));
    const panes = lanes.map((l, i) => laneToPane(l, i === selIdx, tick));
    const grid  = renderForest(panes, w, h - 1);
    out.write(HOME + header + "\n" + grid.join("\n"));
  };

  if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (data: string) => {
    if (data === "q" || data === "\x03") { stop = true; cleanup(); process.exit(0); }
    if (data === "\x1b[A") { selIdx = Math.max(0, selIdx - 1); draw(); }
    if (data === "\x1b[B") { selIdx = Math.min(state.lanes.length - 1, selIdx + 1); draw(); }
    if (data === "k") {
      const lane = state.lanes[selIdx];
      if (lane && lane.status !== "KILLED") {
        try { await ctrl.kill(cwd, lane.id); } catch {}
        state = await ctrl.poll(cwd);
        selIdx = Math.min(selIdx, Math.max(0, state.lanes.length - 1));
        draw();
      }
    }
  });

  out.write(ALT_ON + HIDE);
  draw();
  out.on("resize", () => { if (!stop) draw(); });

  // Fast tick for spinner animation (400ms), slow poll for state (2s)
  let pollCtr = 0;
  const timer = setInterval(async () => {
    if (stop) { clearInterval(timer); return; }
    tick++;
    pollCtr++;
    if (pollCtr >= 5) { // poll every 5 ticks = 2s
      pollCtr = 0;
      try { state = await ctrl.poll(cwd); } catch {}
    }
    draw();
  }, 400);

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (stop) { clearInterval(check); clearInterval(timer); resolve(); }
    }, 100);
  });
}
