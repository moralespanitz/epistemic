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
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Instant enable/disable: `epistemic hooks off` drops this sentinel.
if (existsSync(join(homedir(), ".claude", "epistemic-hooks.disabled"))) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", async () => {
  let cwd = process.cwd();
  try { cwd = JSON.parse(input || "{}").cwd || cwd; } catch { /* use process.cwd */ }

  const isResearch =
    existsSync(join(cwd, "HYPOTHESES.md")) ||
    existsSync(join(cwd, "experiments")) ||
    existsSync(join(cwd, "RESULTS.md"));

  if (!isResearch) { process.exit(0); } // silent elsewhere

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = join(scriptDir, "..");
  let usingEpistemic = "";
  try {
    usingEpistemic = await readFile(join(pluginRoot, "skills", "using-epistemic", "SKILL.md"), "utf8");
  } catch {
    usingEpistemic = "Error reading using-epistemic skill. Invoke the `epistemic` skill before empirical work.";
  }

  const context = [
    "Ξ Epistemic research discipline is active in this repo.",
    "",
    "Below is the full content of your `using-epistemic` bootstrap skill. Follow it",
    "for empirical/eval/benchmark/\"is X better than Y\" work. Use the Skill tool",
    "to load the umbrella `epistemic` skill and any stage-specific skill before",
    "acting.",
    "",
    usingEpistemic,
  ].join("\n");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  }));
  process.exit(0);
});
