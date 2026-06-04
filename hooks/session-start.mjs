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
import { execSync } from "node:child_process";

// Ensure the hf CLI (installed via pip --user) is on PATH for this session.
const HF_USER_BIN = join(homedir(), "Library", "Python", "3.9", "bin");
if (!process.env.PATH?.includes(HF_USER_BIN)) {
  process.env.PATH = `${HF_USER_BIN}:${process.env.PATH ?? ""}`;
}

// Instant enable/disable: `epistemic hooks off` drops this sentinel.
if (existsSync(join(homedir(), ".claude", "epistemic-hooks.disabled"))) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", async () => {
  let cwd = process.cwd();
  try { cwd = JSON.parse(input || "{}").cwd || cwd; } catch { /* use process.cwd */ }

  // Full research repo: has existing research artifacts.
  const isActiveResearch =
    existsSync(join(cwd, "HYPOTHESES.md")) ||
    existsSync(join(cwd, "experiments")) ||
    existsSync(join(cwd, "RESULTS.md")) ||
    existsSync(join(cwd, "RESEARCH.md"));

  // New research repo: has a git repo but no research files yet — bootstrap only.
  const isGitRepo = existsSync(join(cwd, ".git"));

  if (!isActiveResearch && !isGitRepo) { process.exit(0); } // not a repo at all — stay silent

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = join(scriptDir, "..");
  let usingEpistemic = "";
  try {
    usingEpistemic = await readFile(join(pluginRoot, "skills", "using-epistemic", "SKILL.md"), "utf8");
  } catch {
    usingEpistemic = "Error reading using-epistemic skill. Invoke the `epistemic` skill before empirical work.";
  }

  // New repo: inject a lightweight bootstrap so the agent knows epistemic is
  // available and routes research questions to /new instead of answering directly.
  if (!isActiveResearch) {
    const bootstrap = [
      "Ξ Epistemic is available in this repo (no research document yet).",
      "",
      "IMPORTANT: If the user asks a research question — anything involving",
      "\"does X improve Y\", \"compare X vs Y\", \"is X better than\", benchmarks,",
      "evals, or empirical claims — DO NOT answer it directly.",
      "Instead, say:",
      "  \"I can help you run a rigorous experiment on that. Type `/new` to start",
      "   a research document, or click '+ New Research' in the browser graph.\"",
      "",
      "Then wait. The epistemic pipeline (pre-register → baseline → experiment →",
      "falsify → kill-or-ship) will guide the work. Do not skip it.",
    ].join("\n");

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: bootstrap },
    }));
    process.exit(0);
  }

  // Check whether the hf CLI is authenticated.
  let hfUser = "";
  try { hfUser = execSync("hf auth whoami --format json 2>/dev/null", { env: process.env }).toString().trim(); } catch { /* not logged in */ }

  const hfStatus = hfUser
    ? `hf CLI authenticated: ${hfUser}`
    : "hf CLI installed but not authenticated — run \`hf auth login\` to unlock gated models/datasets.";

  const context = [
    "Ξ Epistemic research discipline is active in this repo.",
    "",
    "## Hugging Face Research Stack",
    "The following HF skills are available — load any with /skill:<name>:",
    "  - huggingface-papers   : read arXiv/HF papers as markdown, structured metadata",
    "  - hf-cli               : download/upload models, datasets, manage repos and jobs",
    "  - huggingface-datasets : paginate rows, search, filter, get parquet URLs",
    "  - huggingface-community-evals : run evals locally with inspect-ai or lighteval",
    "  - huggingface-trackio  : track/visualize ML experiments; log metrics and alerts",
    "  - huggingface-llm-trainer : fine-tune with TRL (SFT/DPO/GRPO) on HF Jobs",
    `  Status: ${hfStatus}`,
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
