/**
 * The epistemic monitor as a pi-tui Component, shown via ctx.ui.custom() — it
 * takes over the view with keyboard focus (full height, no truncation, native
 * arrow nav), then done() returns to pi's real chat. This is how we extend pi's
 * TUI: real chat + a full interactive monitor view, both inside pi.
 */
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { loadFleet, type Fleet } from "../monitor/fleet.js";
import { renderMonitor, type MonitorMode } from "./monitor.js";
import { parseKey, reduceNav, actionPrompt, type ActionLabel } from "./monitor-nav.js";

export interface MonitorResult {
  action: ActionLabel;
  id: string;
}

const ACTIONS: { label: string; value: ActionLabel }[] = [
  { label: "chat about it", value: "chat" },
  { label: "approve (ship)", value: "approve" },
  { label: "reject (kill)", value: "reject" },
  { label: "modify (refine/pivot)", value: "modify" },
];

const ESC = "\x1b[";
const R = `${ESC}0m`;
const dim = (s: string) => `${ESC}2m${s}${R}`;
const cyan = (s: string) => `${ESC}1;38;5;226m${s}${R}`;    // bright yellow — selection
const magenta = (s: string) => `${ESC}1;38;5;220m${s}${R}`; // yellow — header/brand

export class MonitorComponent implements Component {
  private mode: MonitorMode = "tree";
  private idx = 0;
  private inAction = false;
  private actionIdx = 0;
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private cwd: string,
    private fleet: Fleet,
    private tui: TUI,
    private done: (result: MonitorResult | null) => void,
  ) {
    this.timer = setInterval(async () => {
      this.fleet = await loadFleet(this.cwd);
      this.tui.requestRender();
    }, 1500);
  }

  render(width: number): string[] {
    const lines = renderMonitor(this.fleet, this.mode, this.idx);
    if (this.inAction) {
      lines.push("");
      lines.push(magenta(`  action on ${this.fleet.entries[this.idx]?.id ?? "?"} — ↑↓ choose · enter confirm · esc cancel`));
      ACTIONS.forEach((a, i) => lines.push(i === this.actionIdx ? cyan(`    ▸ ${a.label}`) : dim(`      ${a.label}`)));
    } else {
      lines.push("");
      lines.push(dim("  ↑↓ select · → detail · ← tree · enter actions · q/esc back to chat"));
    }
    // Truncate to the actual render width — wide inline decision forks would
    // otherwise overflow and crash pi ("Rendered line exceeds terminal width").
    const w = Math.max(1, width);
    return lines.map((l) => truncateToWidth(l, w));
  }

  handleInput(data: string): void {
    const key = parseKey(data);
    if (this.inAction) {
      if (data === "\x1b") this.inAction = false;
      else if (key === "up") this.actionIdx = Math.max(0, this.actionIdx - 1);
      else if (key === "down") this.actionIdx = Math.min(ACTIONS.length - 1, this.actionIdx + 1);
      else if (key === "enter") {
        const entry = this.fleet.entries[this.idx];
        this.finish(entry ? { action: ACTIONS[this.actionIdx].value, id: entry.id } : null);
        return;
      }
      this.tui.requestRender();
      return;
    }

    if (data === "q" || data === "\x03" || data === "\x1b") { this.finish(null); return; }
    const res = reduceNav({ mode: this.mode, idx: this.idx }, key, this.fleet.entries.length);
    if (res.openAction) { this.inAction = true; this.actionIdx = 0; }
    else { this.mode = res.state.mode; this.idx = res.state.idx; }
    this.tui.requestRender();
  }

  invalidate(): void {}

  dispose(): void { clearInterval(this.timer); }

  private finish(result: MonitorResult | null): void {
    clearInterval(this.timer);
    this.done(result);
  }
}

/** Compose the agent instruction for a chosen monitor action. */
export function monitorActionPrompt(result: MonitorResult, fleet: Fleet): string | null {
  const entry = fleet.entries.find((e) => e.id === result.id);
  return entry ? actionPrompt(result.action, entry) : null;
}
