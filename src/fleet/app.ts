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

const ESC = "\x1b[";
const ALT_ON  = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE    = `${ESC}?25l`,   SHOW    = `${ESC}?25h`;
const HOME    = `${ESC}H${ESC}2J`;

const AMBER = (s: string) => `\x1b[38;5;214m${s}\x1b[0m`;
const DIM   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const GREEN = (s: string) => `\x1b[38;5;114m${s}\x1b[0m`;
const RED   = (s: string) => `\x1b[38;5;196m${s}\x1b[0m`;
const BOLD  = (s: string) => `\x1b[1m${s}\x1b[0m`;

function costBar(spent: number, cap: number, width = 8): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return pct >= 80 ? RED(bar) : pct >= 50 ? AMBER(bar) : GREEN(bar);
}

function laneToPane(lane: LaneState, selected: boolean): PaneTree {
  const statusIcon = lane.agentAlive ? GREEN("↻") : lane.status === "KILLED" ? RED("✗") : DIM("·");
  const title = `${selected ? BOLD("▶") : " "} ${lane.id}  ${statusIcon}  ${lane.stage.slice(0, 20)}`;
  const lines = [
    lane.claim.slice(0, 35) + (lane.claim.length > 35 ? "…" : ""),
    `${costBar(lane.spent, lane.costCap)}  $${lane.spent.toFixed(0)}/$${lane.costCap}`,
    [
      lane.hasPrereg  ? GREEN("prereg✓") : RED("prereg✗"),
      lane.hasBaseline ? GREEN("base✓")  : DIM("base·"),
      lane.hasSmokes   ? GREEN("smokes✓"): DIM("smokes·"),
    ].join("  "),
    lane.pid ? DIM(`pid ${lane.pid}`) : DIM("not started"),
  ];
  return { title, lines };
}

export async function runFleetApp(cwd: string): Promise<void> {
  const out = process.stdout;
  const ctrl = new FleetController();

  try { await ctrl.start(cwd); } catch (e) {
    // If claude isn't installed, log and continue — TUI still shows state
    process.stderr.write(`[fleet] start error: ${e}\n`);
  }

  let state = await ctrl.poll(cwd);
  let selectedIdx = 0;
  let stop = false;

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
    const header  =
      BOLD("Ξ epistemic · fleet") +
      `   ${GREEN(String(running))}↻ running · ${RED(String(killed))}✗ killed · ${lanes.length} total` +
      DIM("   [detached — q quits view, agents keep running]   ↑↓ select · k kill");
    if (lanes.length === 0) {
      out.write(HOME + header + "\n\n" + DIM("  No OPEN/RUNNING hypotheses — use /idea to start one."));
      return;
    }
    selectedIdx = Math.min(selectedIdx, Math.max(0, lanes.length - 1));
    const panes = lanes.map((l, i) => laneToPane(l, i === selectedIdx));
    const grid  = renderForest(panes, w, h - 1);
    out.write(HOME + header + "\n" + grid.join("\n"));
  };

  if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (data: string) => {
    if (data === "q" || data === "\x03") { stop = true; cleanup(); process.exit(0); }
    if (data === "\x1b[A") { selectedIdx = Math.max(0, selectedIdx - 1); draw(); }           // up arrow
    if (data === "\x1b[B") { selectedIdx = Math.min(state.lanes.length - 1, selectedIdx + 1); draw(); } // down arrow
    if (data === "k") {
      const lane = state.lanes[selectedIdx];
      if (lane && lane.status !== "KILLED") {
        try { await ctrl.kill(cwd, lane.id); } catch {}
        state = await ctrl.poll(cwd);
        selectedIdx = Math.min(selectedIdx, Math.max(0, state.lanes.length - 1));
        draw();
      }
    }
  });

  out.write(ALT_ON + HIDE);
  draw();
  out.on("resize", () => { if (!stop) draw(); });

  const timer = setInterval(async () => {
    if (stop) { clearInterval(timer); return; }
    try { state = await ctrl.poll(cwd); } catch {}
    draw();
  }, 2000);

  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (stop) { clearInterval(check); clearInterval(timer); resolve(); }
    }, 100);
  });
}
