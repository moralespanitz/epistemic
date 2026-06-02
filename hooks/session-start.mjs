#!/usr/bin/env node
/**
 * SessionStart hook — the "superpowers for research" preamble.
 *
 * Activates the epistemic research discipline at the start of a Claude Code
 * session. Scoped: it stays silent in non-research directories, and injects the
 * full mechanism (use the `epistemic` skill, gates, parallel lanes) only when
 * the cwd looks like a research repo (HYPOTHESES.md or experiments/).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Instant enable/disable: `epistemic hooks off` drops this sentinel.
if (existsSync(join(homedir(), ".claude", "epistemic-hooks.disabled"))) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let cwd = process.cwd();
  try { cwd = JSON.parse(input || "{}").cwd || cwd; } catch { /* use process.cwd */ }

  const isResearch =
    existsSync(join(cwd, "HYPOTHESES.md")) ||
    existsSync(join(cwd, "experiments")) ||
    existsSync(join(cwd, "RESULTS.md"));

  if (!isResearch) { process.exit(0); } // silent elsewhere

  const context = [
    "Ξ Epistemic research discipline is active in this repo.",
    "",
    "For ANY empirical/eval/benchmark/\"is X better than Y\" work, you MUST use the",
    "`epistemic` skill (the umbrella mechanism) and its stage skills, in order:",
    "research-question → preregistration → baseline-reproduction → experiment-execution",
    "→ statistical-rigor → falsification-review → surprise-triage → kill-or-ship →",
    "verification-before-publication.",
    "",
    "Self-enforce the gates (no number leaves smokes/ into a headline file; never",
    "compare to an unreproduced baseline; nothing runs before experiments/<id>/prereg.md",
    "exists; kill at >1.5x cost cap). Work hypotheses as PARALLEL lanes, not one linear",
    "funnel. Killing a bad idea fast is a win.",
  ].join("\n");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  }));
  process.exit(0);
});
