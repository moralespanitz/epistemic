/**
 * Full-screen interactive monitor — the reliable, non-truncated, arrow-navigable
 * cockpit. Runs in the alternate screen buffer (so it restores cleanly), reads
 * raw keys natively (no fighting omp's editor), and refreshes live.
 *
 *   ↑/↓  select experiment      →  open detail      ←  back to tree
 *   enter open action menu      q  quit
 *
 * Actions (approve/reject/modify/chat) compose an agent instruction, copy it to
 * the clipboard, and queue it to .epistemic/monitor-outbox.jsonl so the chat can
 * pick it up. The monitor never mutates research state itself.
 */
import { spawn } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadFleet, type Fleet } from "./fleet.js";
import { renderMonitor } from "../research/monitor.js";
import { parseKey, reduceNav, actionPrompt, type ActionLabel } from "../research/monitor-nav.js";

const ESC = "\x1b[";
const ALT_ON = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE = `${ESC}?25l`, SHOW = `${ESC}?25h`;
const HOME = `${ESC}H${ESC}2J`;
const R = `${ESC}0m`;
const color = {
  magenta: (s: string) => `${ESC}1;38;5;213m${s}${R}`,
  cyan: (s: string) => `${ESC}38;5;51m${s}${R}`,
  green: (s: string) => `${ESC}38;5;42m${s}${R}`,
  red: (s: string) => `${ESC}38;5;203m${s}${R}`,
  dim: (s: string) => `${ESC}2m${s}${R}`,
};

const ACTIONS: { label: string; value: ActionLabel }[] = [
  { label: "chat about it", value: "chat" },
  { label: "approve (ship)", value: "approve" },
  { label: "reject (kill)", value: "reject" },
  { label: "modify (refine/pivot)", value: "modify" },
];

function colorize(line: string): string {
  if (line.includes("mission control")) return color.magenta(line);
  if (line.includes("▸")) return color.cyan(line);
  if (line.includes("☓")) return color.red(line);
  if (line.startsWith("Ξ") || line.includes("← back") || line.includes("↑↓")) return color.dim(line);
  return line;
}

export async function runMonitorApp(cwd: string): Promise<void> {
  const out = process.stdout;
  let fleet: Fleet = await loadFleet(cwd);
  let mode: "tree" | "detail" = "tree";
  let idx = 0;
  let inAction = false;
  let actionIdx = 0;
  let toast = "";
  let stop = false;

  const draw = () => {
    const base = renderMonitor(fleet, mode, idx).map(colorize);
    const lines = [...base];
    if (inAction) {
      const entry = fleet.entries[idx];
      lines.push("");
      lines.push(color.magenta(`  ▸ action on ${entry?.id ?? "?"} — ↑↓ choose · enter confirm · esc cancel`));
      ACTIONS.forEach((a, i) => {
        const sel = i === actionIdx;
        lines.push(sel ? color.cyan(`    ▸ ${a.label}`) : color.dim(`      ${a.label}`));
      });
    }
    lines.push("");
    lines.push(color.dim(toast || "  q quit · ↑↓ select · → detail · ← tree · enter actions"));
    out.write(HOME + lines.join("\n"));
  };

  const queueAction = async (value: ActionLabel) => {
    const entry = fleet.entries[idx];
    if (!entry) return;
    const prompt = actionPrompt(value, entry);
    try {
      await mkdir(join(cwd, ".epistemic"), { recursive: true });
      await appendFile(join(cwd, ".epistemic", "monitor-outbox.jsonl"),
        JSON.stringify({ id: entry.id, action: value, prompt }) + "\n", "utf8");
    } catch { /* best effort */ }
    copyToClipboard(prompt);
    toast = color.green(`  ✓ ${value} ${entry.id} — copied to clipboard; paste in chat (or it's queued for the agent)`);
  };

  const cleanup = () => {
    out.write(SHOW + ALT_OFF);
    if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
    process.stdin.pause();
  };

  // Read stdin whether it's a real TTY or a pipe — so a person OR an agent
  // (writing keystrokes to stdin) can drive it. Raw mode only applies to a TTY.
  if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (data: string) => {
    if (inAction) {
      if (data === "\x1b") { inAction = false; }
      else if (parseKey(data) === "up") actionIdx = Math.max(0, actionIdx - 1);
      else if (parseKey(data) === "down") actionIdx = Math.min(ACTIONS.length - 1, actionIdx + 1);
      else if (parseKey(data) === "enter") { await queueAction(ACTIONS[actionIdx].value); inAction = false; }
      draw();
      return;
    }
    if (data === "q" || data === "\x03") { stop = true; cleanup(); process.exit(0); }
    const res = reduceNav({ mode, idx }, parseKey(data), fleet.entries.length);
    if (res.openAction) { inAction = true; actionIdx = 0; toast = ""; }
    else { mode = res.state.mode; idx = res.state.idx; if (res.handled) toast = ""; }
    draw();
  });

  out.write(ALT_ON + HIDE);
  draw();
  // Live refresh.
  const timer = setInterval(async () => {
    if (stop) { clearInterval(timer); return; }
    fleet = await loadFleet(cwd);
    if (!inAction) draw();
  }, 1500);

  // Resolve when the user quits.
  await new Promise<void>((resolve) => {
    const check = setInterval(() => { if (stop) { clearInterval(check); clearInterval(timer); resolve(); } }, 100);
  });
}

function copyToClipboard(text: string): void {
  const cmd = process.platform === "darwin" ? "pbcopy" : "xclip";
  try {
    const p = spawn(cmd, process.platform === "darwin" ? [] : ["-selection", "clipboard"], { stdio: ["pipe", "ignore", "ignore"] });
    p.stdin?.end(text);
  } catch { /* clipboard optional */ }
}
