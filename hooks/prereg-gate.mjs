#!/usr/bin/env node
/**
 * PreToolUse "prereg gate" — real enforcement of the core epistemic rule:
 * no experiment-shaped command runs before a preregistration exists.
 *
 * Scoped & conservative to avoid false positives:
 *  - only acts in a research repo (HYPOTHESES.md present),
 *  - only on Bash commands that clearly look like an experiment run,
 *  - only when NO experiments/<id>/prereg.md exists yet.
 * When it fires it returns permissionDecision "ask" (interrupt + confirm) with a
 * reason — discipline, not a hard wall. Flip ASK→"deny" below to hard-block.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DECISION = "ask"; // change to "deny" for a hard block

// Instant enable/disable: `epistemic hooks off` drops this sentinel.
if (existsSync(join(homedir(), ".claude", "epistemic-hooks.disabled"))) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data = {};
  try { data = JSON.parse(input || "{}"); } catch { process.exit(0); }
  if (data.tool_name !== "Bash") process.exit(0);

  const cwd = data.cwd || process.cwd();
  const command = String(data.tool_input?.command ?? "");

  // Only enforce inside a research repo.
  if (!existsSync(join(cwd, "HYPOTHESES.md"))) process.exit(0);

  // Heuristic: does this command look like running an experiment?
  const experimentish = /\b(train|finetune|fine-tune|sweep|benchmark|evaluate|eval)\b/i.test(command)
    || /modal\s+run/.test(command)
    || /python3?\s+[^\n]*experiments\//.test(command)
    || /experiments\/[^\s]+\.(py|sh)\b/.test(command);
  if (!experimentish) process.exit(0);

  // Is there ANY preregistration on disk?
  let hasPrereg = false;
  try {
    const expRoot = join(cwd, "experiments");
    if (existsSync(expRoot)) {
      for (const d of readdirSync(expRoot, { withFileTypes: true })) {
        if (d.isDirectory() && existsSync(join(expRoot, d.name, "prereg.md"))) { hasPrereg = true; break; }
      }
    }
  } catch { /* treat as none */ }
  if (hasPrereg) process.exit(0);

  const reason = [
    "Ξ epistemic prereg gate: this looks like an experiment run, but no",
    "experiments/<id>/prereg.md exists. Pre-register first (use the `preregistration`",
    "skill): lock the claim, falsifier, judge, baseline, cost cap, and compute target.",
    "Running before prereg contaminates the result. Proceed only if this isn't an",
    "experiment (e.g. a smoke test under smokes/), or pre-register, then re-run.",
  ].join(" ");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: DECISION,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
});
