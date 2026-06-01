/**
 * epistemic — a branded variation of the pi/omp coding agent.
 *
 * Plays the epistemic intro animation, then hands off to the REAL pi interactive
 * agent (same engine omp runs) with the epistemic extension auto-injected — gates,
 * research commands (/tree, /hypothesis), and tools. This is omp, with discipline:
 * pi.dev + extensions, rebranded, not a replacement.
 */
import { main } from "@earendil-works/pi-coding-agent";
import epistemicExtension from "../index.js";
import { playIntro } from "./intro.js";

async function run() {
  const args = process.argv.slice(2);
  const interactive = !args.includes("-p") && !args.includes("--print");

  if (interactive) {
    try { await playIntro(); } catch { /* never block the agent on the intro */ }
  }

  await main(args, {
    // Inject epistemic as an in-process extension factory so it loads even when
    // launched outside a repo that lists it in .pi/settings.json.
    extensionFactories: [epistemicExtension as unknown as (pi: unknown) => void],
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
