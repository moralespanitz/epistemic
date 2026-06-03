import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { loadHypotheses, getActiveHypothesis } from "../../../../src/state/repo.js";

// Patterns that indicate a numeric result being written to a headline file
const RESULT_WRITE_PATTERNS = [
  /tee\s+.*RESULTS\.md/,
  />\s*RESULTS\.md/,
  />>\s*RESULTS\.md/,
  /echo.*>\s*RESULTS\.md/,
  /write.*RESULTS\.md/,
];

// Patterns that mean it's going to smokes/ (allowed)
const SMOKES_PATTERN = /smokes\//;

export function registerSmokeGate(pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isToolCallEventType("bash", event)) return;
    const cmd = event.input.command ?? "";

    // Allow writes to smokes/ (provisional)
    if (SMOKES_PATTERN.test(cmd)) return;

    // Block writes to RESULTS.md that look like they contain numbers
    const isHeadlineWrite = RESULT_WRITE_PATTERNS.some(p => p.test(cmd));
    if (!isHeadlineWrite) return;

    const entries = await loadHypotheses(ctx.cwd);
    const active = getActiveHypothesis(entries);
    if (!active) return;

    // If the result hasn't been through falsification review, block it
    const { join } = await import("node:path");
    const { readdir } = await import("node:fs/promises");
    const falsifierDir = join(ctx.cwd, "experiments", active.id, "falsifiers");
    let falsifierCount = 0;
    try {
      const files = await readdir(falsifierDir);
      falsifierCount = files.filter(f => f.endsWith(".md")).length;
    } catch { /* no falsifiers dir */ }

    if (falsifierCount === 0) {
      return {
        block: true,
        reason: `Provisional results must go to experiments/${active.id}/smokes/ first. Run falsification review before promoting to RESULTS.md.`,
      };
    }
  });
}
