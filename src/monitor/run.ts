/**
 * Live loop for the epistemic monitor. Runs in the alternate screen buffer,
 * redraws the dashboard on an interval, and exits cleanly on q / Ctrl+C.
 */
import { loadFleet } from "./fleet.js";
import { renderDashboard } from "./render.js";

const ESC = "\x1b[";
const ALT_ON = `${ESC}?1049h`;
const ALT_OFF = `${ESC}?1049l`;
const HIDE = `${ESC}?25l`;
const SHOW = `${ESC}?25h`;
const HOME = `${ESC}H${ESC}2J`;

export async function runMonitor(cwd: string, intervalMs = 1000): Promise<void> {
  const out = process.stdout;
  let stop = false;

  const cleanup = () => {
    out.write(SHOW + ALT_OFF);
    if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
    process.stdin.pause();
  };

  // Quit on q / Ctrl+C.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (key: string) => {
      if (key === "q" || key === "\x03" || key === "\x04") { stop = true; }
    });
  }
  process.on("SIGINT", () => { stop = true; });

  out.write(ALT_ON + HIDE);
  try {
    while (!stop) {
      const fleet = await loadFleet(cwd);
      const frame = renderDashboard(fleet, out.columns ?? 100);
      out.write(HOME + frame);
      await sleep(intervalMs);
    }
  } finally {
    cleanup();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
