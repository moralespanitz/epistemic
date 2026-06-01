/**
 * epistemic — pi.dev's real coding agent + the epistemic extension.
 *
 *   epistemic            → branded intro, then pi's REAL interactive chat
 *                          (full functionality: /model, markdown, tools, MCP, memory)
 *                          with the epistemic extension loaded (gates, /monitor, /map)
 *   epistemic monitor    → the full-screen interactive monitor on its own
 *
 * The chat is pi.dev, unchanged — epistemic is the extension on top, not a
 * replacement. The extension loads via omp's discovery (.pi/settings.json).
 */
import { main } from "@earendil-works/pi-coding-agent";
import { playIntro } from "./intro.js";
import { runMonitorApp } from "../monitor/app.js";

async function run() {
  const args = process.argv.slice(2);

  if (args[0] === "monitor") {
    await runMonitorApp(process.cwd());
    return;
  }

  const interactive = !args.includes("-p") && !args.includes("--print");
  if (interactive) {
    try { await playIntro(); } catch { /* never block the agent on the intro */ }
  }
  await main(args);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
