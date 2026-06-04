/**
 * Branded intro animation for epistemic. Runs in the alternate screen buffer
 * (so it never scrolls the terminal) and plays in two acts:
 *
 *   Act 1 — a real 3D Ξ mark: three extruded bars rasterized to a character
 *           grid with a per-cell Z-buffer, Lambert + ambient lighting mapped to
 *           an ASCII brightness ramp, and a depth-modulated amber glow. The mesh
 *           spins on Y with a gentle X wobble (the classic donut.c technique).
 *   Act 2 — the spin settles and dissolves into the flat Ξ, the name reveals
 *           letter by letter, and the tagline fades in.
 */

const ESC = "\x1b[";
const R = `${ESC}0m`;
const ALT_ON = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE = `${ESC}?25l`, SHOW = `${ESC}?25h`;
const CLEAR = `${ESC}2J`;
const at = (row: number, col: number) => `${ESC}${row};${col}H`;

// Research yellow is the primary accent.
const magenta = (s: string) => `${ESC}1;38;5;220m${s}${R}`; // yellow (brand)
const magDim = (s: string) => `${ESC}38;5;136m${s}${R}`;    // dim yellow (pulse)
const white = (s: string) => `${ESC}1;97m${s}${R}`;
const cyan = (s: string) => `${ESC}38;5;221m${s}${R}`;      // soft yellow (tagline)
const dim = (s: string) => `${ESC}2m${s}${R}`;

const NAME = "epistemic";

// ---------------------------------------------------------------------------
// Act 1: the 3D renderer is in the shared module — import it.
// ---------------------------------------------------------------------------
import { render3D } from "../tui/render3d.js";

// ---------------------------------------------------------------------------
// Wordmark: the name + tagline that appear BENEATH the 3D mark (no flat Ξ).
// ---------------------------------------------------------------------------

/** Build the text lines below the mark for reveal progress t∈[0,1] and tick. */
function wordmarkLines(t: number, tick: number): string[] {
  // Name reveals letter by letter over the first ~65% of the reveal.
  const revealed = Math.round(Math.max(0, Math.min(1, t / 0.65)) * NAME.length);
  const name = NAME.split("").map((ch, i) => (i < revealed ? white(ch) : dim(ch))).join(" ");

  // Tagline + loader fade in at the end.
  const tagline = t > 0.7 ? cyan("research-grade coding agent") : "";
  const dotN = Math.round((Math.sin(tick / 2) * 0.5 + 0.5) * 3);
  const loader = t >= 1 ? dim("ready") : dim("·".repeat(dotN + 1));

  return [`${name}`, "", tagline, loader];
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function writeCentered(out: NodeJS.WriteStream, lines: string[], rows: number, cols: number): void {
  const top = Math.max(1, Math.floor((rows - lines.length) / 2));
  let buf = CLEAR;
  lines.forEach((line, j) => {
    const visible = line.replace(/\x1b\[[0-9;]*m/g, "").length;
    const col = Math.max(1, Math.floor((cols - visible) / 2) + 1);
    buf += at(top + j, col) + line;
  });
  out.write(buf);
}

export async function playIntro(out: NodeJS.WriteStream = process.stdout, durationMs = 1100): Promise<void> {
  if (!out.isTTY) return;
  const rows = out.rows ?? 24;
  const cols = out.columns ?? 80;

  // The 3D mark grid. Keep it compact so the wordmark fits beneath it.
  const gw = Math.min(cols, 40);
  const gh = Math.min(Math.max(rows - 8, 9), 14);

  out.write(ALT_ON + HIDE);
  try {
    // --- Act 1: 3D spin, settling to face forward ---------------------------
    const spinFrames = 30;
    const spinInterval = 40;
    for (let i = 0; i <= spinFrames; i++) {
      const k = i / spinFrames;
      const ay = k * Math.PI * 2.2;                       // ~1.1 turns
      const settle = k > 0.78 ? (k - 0.78) / 0.22 : 0;    // ease toward front face
      const ayS = ay * (1 - settle) + Math.round(ay / (2 * Math.PI)) * 2 * Math.PI * settle;
      const ax = Math.sin(k * Math.PI) * 0.45 * (1 - settle); // wobble that returns to 0
      writeCentered(out, render3D(ayS, ax, gw, gh), rows, cols);
      await sleep(spinInterval);
    }

    // --- Act 2: hold the 3D mark, reveal the name beneath it -----------------
    // The Ξ stays a shaded 3D object — it breathes gently while the wordmark
    // types in. No reverting to a flat 2D mark.
    const frames = 22;
    const interval = Math.max(35, Math.floor(durationMs / frames));
    for (let i = 0; i <= frames; i++) {
      const t = i / frames;
      const breathe = Math.sin(i / 3) * 0.10;             // subtle living wobble
      const mark = render3D(0, breathe, gw, gh);
      writeCentered(out, [...mark, "", ...wordmarkLines(t, i)], rows, cols);
      await sleep(interval);
    }
    await sleep(220);
  } finally {
    out.write(CLEAR + SHOW + ALT_OFF);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
