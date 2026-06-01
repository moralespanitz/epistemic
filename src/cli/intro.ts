/**
 * Branded terminal intro animation for epistemic — shown before handing off to
 * the real pi/omp interactive agent. Pure ANSI; no dependencies.
 */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;
const CLEAR = `${ESC}2J${ESC}H`;

const c = {
  magenta: (s: string) => `${ESC}38;5;213m${s}${RESET}`,
  cyan: (s: string) => `${ESC}38;5;51m${s}${RESET}`,
  dim: (s: string) => `${ESC}2m${s}${RESET}`,
  bold: (s: string) => `${ESC}1m${s}${RESET}`,
};

// Wordmark — the Ξ mark + EPISTEMIC.
const WORDMARK = [
  "  ▟▛▀▀▜▙   ███████ ███████ ██ ███████ ████████ ███████ ███    ███ ██  ██████",
  "  ▜▛▄▄▟▛   ██      ██   ██ ██ ██         ██    ██   ██ ████  ████ ██ ██     ",
  "  ▟▛▀▀▜▙   █████   ███████ ██ ███████    ██    ███████ ██ ████ ██ ██ ██     ",
  "  ▜▙▄▄▟▛   ██      ██      ██      ██    ██    ██   ██ ██  ██  ██ ██ ██     ",
  "  ▝▀▀▀▀▘   ███████ ██      ██ ███████    ██    ██   ██ ██      ██ ██  ██████",
];

const TAGLINE = "research-grade coding agent  ·  pi.dev, with discipline";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Render one intro frame. `progress` is 0..1 (reveal amount); `tick` advances
 * the spinner. Returns the full screen string. Pure — used by the loop and tests.
 */
export function renderIntro(progress: number, tick: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  const logo = WORDMARK.map((line) => c.magenta(line)).join("\n");

  const revealChars = Math.round(TAGLINE.length * clamped);
  const shown = TAGLINE.slice(0, revealChars);
  const tag = c.cyan(shown) + c.dim(TAGLINE.slice(revealChars));

  const spin = c.magenta(SPINNER[tick % SPINNER.length]);
  const status = clamped >= 1 ? c.dim("ready") : `${spin} ${c.dim("loading agent…")}`;

  return [
    "",
    "",
    logo,
    "",
    `      ${tag}`,
    "",
    `      ${status}`,
    "",
  ].join("\n");
}

/** Play the intro animation, then leave the terminal clean for the agent. */
export async function playIntro(
  out: NodeJS.WriteStream = process.stdout,
  durationMs = 1100,
): Promise<void> {
  if (!out.isTTY) return; // skip when piped / non-interactive
  const frames = 14;
  const interval = Math.max(40, Math.floor(durationMs / frames));
  out.write(HIDE_CURSOR);
  try {
    for (let i = 0; i <= frames; i++) {
      out.write(CLEAR);
      out.write(renderIntro(i / frames, i));
      await sleep(interval);
    }
    await sleep(180);
  } finally {
    out.write(CLEAR);
    out.write(SHOW_CURSOR);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
