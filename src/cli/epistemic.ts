/**
 * epistemic — a branded variation of the pi/omp coding agent.
 *
 *   epistemic            → branded intro, then the REAL pi agent + epistemic extension
 *   epistemic monitor    → live game-style mission-control dashboard (read-only)
 *   epistemic dash       → split terminal: real chat (left) + live monitor (right)
 *
 * pi.dev + extensions, rebranded — not a replacement.
 */
import { main } from "@earendil-works/pi-coding-agent";
import { playIntro } from "./intro.js";
import { runMonitor } from "../monitor/run.js";
import { runDash } from "./dash.js";

async function run() {
  const [sub, ...rest] = process.argv.slice(2);

  if (sub === "monitor") {
    await runMonitor(process.cwd());
    return;
  }
  if (sub === "dash") {
    await runDash(process.cwd());
    return;
  }

  // Default: the agent.
  const args = process.argv.slice(2);
  const interactive = !args.includes("-p") && !args.includes("--print");
  if (interactive) {
    try { await playIntro(); } catch { /* never block the agent on the intro */ }
  }
  // The epistemic extension loads via omp's discovery (.pi/settings.json).
  await main(args);
  void rest;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
