/**
 * Pure navigation + action logic for monitor mode. Kept side-effect-free so it
 * can be unit-tested without a terminal: the extension wires real I/O around it.
 */
import type { HypothesisEntry } from "../state/repo.js";
import type { MonitorMode } from "./monitor.js";

export type NavKey = "up" | "down" | "left" | "right" | "enter" | "other";

/** Map a raw terminal input chunk to a navigation key. */
export function parseKey(data: string): NavKey {
  switch (data) {
    case "\x1b[A": return "up";
    case "\x1b[B": return "down";
    case "\x1b[C": return "right";
    case "\x1b[D": return "left";
    case "\r": case "\n": return "enter";
    default: return "other";
  }
}

export interface NavState {
  mode: MonitorMode;
  idx: number;
}

export interface NavResult {
  state: NavState;
  /** True if the key was handled (should be consumed). */
  handled: boolean;
  /** Set when the user opened the action menu for the selected item. */
  openAction?: boolean;
}

/** Reduce a key press against nav state. Pure. `count` = number of hypotheses. */
export function reduceNav(state: NavState, key: NavKey, count: number): NavResult {
  const max = Math.max(count - 1, 0);
  switch (key) {
    case "up": return { state: { ...state, idx: Math.max(0, state.idx - 1) }, handled: true };
    case "down": return { state: { ...state, idx: Math.min(max, state.idx + 1) }, handled: true };
    case "right": return { state: { ...state, mode: "detail" }, handled: true };
    case "left": return { state: { ...state, mode: "tree" }, handled: true };
    case "enter": return { state, handled: true, openAction: count > 0 };
    default: return { state, handled: false };
  }
}

export type ActionLabel = "chat" | "approve" | "reject" | "modify";

/** Compose the agent instruction for an action on a hypothesis. Pure. */
export function actionPrompt(action: ActionLabel, entry: Pick<HypothesisEntry, "id" | "claim">): string {
  const tag = `${entry.id} ("${entry.claim}")`;
  switch (action) {
    case "chat": return `Tell me about hypothesis ${tag}. Current status and the next step?`;
    case "approve": return `Approve hypothesis ${tag}. Run kill-or-ship: if all gates pass, SHIP and run verification-before-publication; otherwise list exactly what's blocking.`;
    case "reject": return `Reject hypothesis ${tag}. Run kill-or-ship with a KILL decision and record the lesson.`;
    case "modify": return `Modify hypothesis ${tag}. Propose a REFINE or PIVOT per kill-or-ship and update the registration.`;
  }
}
