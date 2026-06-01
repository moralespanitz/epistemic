/**
 * Branded intro animation for epistemic. Runs in the alternate screen buffer
 * (so it never scrolls the terminal) and animates a centered build-in of the Ξ
 * mark, the name revealing letter by letter, and a tagline fading in.
 */

const ESC = "\x1b[";
const R = `${ESC}0m`;
const ALT_ON = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE = `${ESC}?25l`, SHOW = `${ESC}?25h`;
const CLEAR = `${ESC}2J`;
const at = (row: number, col: number) => `${ESC}${row};${col}H`;

const magenta = (s: string) => `${ESC}1;38;5;213m${s}${R}`;
const magDim = (s: string) => `${ESC}38;5;132m${s}${R}`;
const white = (s: string) => `${ESC}1;97m${s}${R}`;
const cyan = (s: string) => `${ESC}38;5;51m${s}${R}`;
const dim = (s: string) => `${ESC}2m${s}${R}`;

const NAME = "epistemic";

/** Build the centered frame lines for progress p∈[0,1] and animation tick. */
export function introFrame(p: number, tick: number): string[] {
  const t = Math.max(0, Math.min(1, p));

  // Ξ mark: three bars that grow in over the first 40% of the animation.
  const grow = Math.min(1, t / 0.4);
  const full = 7;
  const w = Math.round(grow * full);
  const barColor = tick % 2 === 0 ? magenta : magDim; // gentle pulse
  const bar = (n: number) => barColor("█".repeat(Math.max(0, n)));
  const mark = [bar(w), bar(Math.max(0, w - 2)), bar(w)];

  // Name reveals letter by letter between 35% and 80%.
  const revealed = Math.round(Math.max(0, Math.min(1, (t - 0.35) / 0.45)) * NAME.length);
  const name = NAME.split("").map((ch, i) => (i < revealed ? white(ch) : dim(ch))).join(" ");

  // Tagline + loader fade in at the end.
  const tagline = t > 0.78 ? cyan("research-grade coding agent") : "";
  const dotN = Math.round((Math.sin(tick / 2) * 0.5 + 0.5) * 3);
  const loader = t >= 1 ? dim("ready") : dim("·".repeat(dotN + 1));

  return [...mark, "", `${white("Ξ")}  ${name}`, "", tagline, loader];
}

export async function playIntro(out: NodeJS.WriteStream = process.stdout, durationMs = 1100): Promise<void> {
  if (!out.isTTY) return;
  const rows = out.rows ?? 24;
  const cols = out.columns ?? 80;
  const frames = 22;
  const interval = Math.max(35, Math.floor(durationMs / frames));

  out.write(ALT_ON + HIDE);
  try {
    for (let i = 0; i <= frames; i++) {
      const lines = introFrame(i / frames, i);
      const top = Math.max(1, Math.floor((rows - lines.length) / 2));
      let buf = CLEAR;
      lines.forEach((line, j) => {
        const visible = line.replace(/\x1b\[[0-9;]*m/g, "").length;
        const col = Math.max(1, Math.floor((cols - visible) / 2) + 1);
        buf += at(top + j, col) + line;
      });
      out.write(buf);
      await sleep(interval);
    }
    await sleep(160);
  } finally {
    out.write(CLEAR + SHOW + ALT_OFF);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
