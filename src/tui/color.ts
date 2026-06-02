/**
 * Shared ANSI palette for the epistemic TUI. Honors NO_COLOR. Pairs with
 * pi-tui's visibleWidth()/truncateToWidth(), which ignore these escape codes,
 * so colored strings still lay out and truncate correctly.
 */
const ESC = "\x1b[";
const R = `${ESC}0m`;
const on = (): boolean => !process.env.NO_COLOR;
const wrap = (code: string) => (s: string): string => (on() ? `${ESC}${code}m${s}${R}` : s);

export const bold = wrap("1");
export const dim = wrap("2");
export const green = wrap("38;5;46");   // confirmed / ship
export const red = wrap("38;5;196");    // killed / falsified
export const yellow = wrap("38;5;226"); // running
export const gold = wrap("38;5;220");   // brand / xp
export const gray = wrap("38;5;244");   // open / idle
export const cyan = wrap("1;38;5;51");  // selection

/** Color a string by hypothesis status. */
export function byStatus(status: string, s: string): string {
  switch (status) {
    case "CONFIRMED": return green(s);
    case "RUNNING": return yellow(s);
    case "KILLED":
    case "FALSIFIED": return red(s);
    default: return gray(s); // OPEN
  }
}

/** A cost bar that greens up when cheap and reddens toward the cap. */
export function costBar(spent: number, cap: number, width = 14): string {
  const pct = cap > 0 ? Math.min(Math.round((spent / cap) * 100), 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const fill = "█".repeat(filled);
  const colored = pct >= 80 ? red(fill) : pct >= 50 ? yellow(fill) : green(fill);
  return `[${colored}${dim("░".repeat(width - filled))} ${pct}%]`;
}
