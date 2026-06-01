/**
 * Branded terminal intro for epistemic — clean, white, minimal. Animates a
 * single line IN PLACE (carriage return), so it never scrolls the terminal.
 * Pure ANSI; no dependencies.
 */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;
const CLEAR_LINE = `${ESC}2K\r`; // erase current line, return to col 0

const white = (s: string) => `${ESC}97m${s}${RESET}`;
const boldWhite = (s: string) => `${ESC}1;97m${s}${RESET}`;
const dim = (s: string) => `${ESC}2m${s}${RESET}`;

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const BAR_WIDTH = 22;

/** The static brand header (printed once, above the animated line). */
export function brandHeader(): string {
  return [
    "",
    `  ${boldWhite("Ξ epistemic")}  ${dim("research-grade coding agent")}`,
    "",
  ].join("\n");
}

/** The single animated progress line. Pure — used by the loop and tests. */
export function progressLine(progress: number, tick: number): string {
  const p = Math.max(0, Math.min(1, progress));
  const filled = Math.round(p * BAR_WIDTH);
  const bar = white("█".repeat(filled)) + dim("·".repeat(BAR_WIDTH - filled));
  const spin = p >= 1 ? white("✓") : white(SPINNER[tick % SPINNER.length]);
  return `  ${spin}  ${bar}`;
}

/**
 * Print the brand header once, then animate the progress line in place.
 * Leaves the brand on screen and the agent renders below — no full-screen
 * clears, no scrolling.
 */
export async function playIntro(
  out: NodeJS.WriteStream = process.stdout,
  durationMs = 700,
): Promise<void> {
  if (!out.isTTY) return; // skip when piped / non-interactive
  const frames = 14;
  const interval = Math.max(35, Math.floor(durationMs / frames));
  out.write(HIDE_CURSOR);
  out.write(`${brandHeader()}\n`);
  try {
    for (let i = 0; i <= frames; i++) {
      out.write(CLEAR_LINE + progressLine(i / frames, i));
      await sleep(interval);
    }
  } finally {
    out.write(CLEAR_LINE + SHOW_CURSOR + "\n");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
