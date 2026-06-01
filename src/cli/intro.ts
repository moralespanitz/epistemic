/**
 * Branded terminal intro for epistemic — clean, white, minimal — shown before
 * handing off to the real pi/omp agent. Pure ANSI; no dependencies.
 */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;
const CLEAR = `${ESC}2J${ESC}H`;

const white = (s: string) => `${ESC}97m${s}${RESET}`;
const boldWhite = (s: string) => `${ESC}1;97m${s}${RESET}`;
const dim = (s: string) => `${ESC}2m${s}${RESET}`;

const TAGLINE = "research-grade coding agent · pi.dev, with discipline";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const BAR_WIDTH = 26;

/**
 * Render one intro frame. `progress` is 0..1; `tick` advances the spinner.
 * Pure — used by the animation loop and by tests.
 */
export function renderIntro(progress: number, tick: number): string {
  const p = Math.max(0, Math.min(1, progress));
  const filled = Math.round(p * BAR_WIDTH);
  const bar = "█".repeat(filled) + dim("·".repeat(BAR_WIDTH - filled));
  const spin = p >= 1 ? "✓" : SPINNER[tick % SPINNER.length];

  return [
    "",
    "",
    `   ${boldWhite("Ξ epistemic")}`,
    `   ${dim(TAGLINE)}`,
    "",
    `   ${white(spin)}  ${white(bar)}`,
    "",
  ].join("\n");
}

/** Play the intro animation, then leave the terminal clean for the agent. */
export async function playIntro(
  out: NodeJS.WriteStream = process.stdout,
  durationMs = 900,
): Promise<void> {
  if (!out.isTTY) return; // skip when piped / non-interactive
  const frames = 16;
  const interval = Math.max(35, Math.floor(durationMs / frames));
  out.write(HIDE_CURSOR);
  try {
    for (let i = 0; i <= frames; i++) {
      out.write(CLEAR);
      out.write(renderIntro(i / frames, i));
      await sleep(interval);
    }
    await sleep(150);
  } finally {
    out.write(CLEAR);
    out.write(SHOW_CURSOR);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
