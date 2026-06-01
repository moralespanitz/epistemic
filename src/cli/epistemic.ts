/**
 * epistemic — a branded variation of the pi/omp coding agent.
 *
 * Plays the epistemic intro animation, then hands off to the REAL pi interactive
 * agent (same engine omp runs) with the epistemic extension auto-injected — gates,
 * research commands (/tree, /hypothesis), and tools. This is omp, with discipline:
 * pi.dev + extensions, rebranded, not a replacement.
 */
import { main } from "@earendil-works/pi-coding-agent";
import { playIntro } from "./intro.js";

async function run() {
  const args = process.argv.slice(2);
  const interactive = !args.includes("-p") && !args.includes("--print");

  if (interactive) {
    try { await playIntro(); } catch { /* never block the agent on the intro */ }
  }

  // The epistemic extension loads via omp's normal discovery (.pi/settings.json
  // → package.json "pi".extensions → src/index.ts). Do NOT also inject it here,
  // or it loads twice and its tools/commands conflict with themselves.
  await main(args);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
