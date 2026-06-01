/**
 * epistemic — a branded variation of the pi/omp coding agent.
 *
 * One command. A branded intro, then the REAL pi agent + epistemic extension.
 * The mission-control dashboard lives INSIDE the chat: type /monitor (and
 * /monitor off to return) — like `claude agents`, no separate command needed.
 */
import { main } from "@earendil-works/pi-coding-agent";
import { playIntro } from "./intro.js";
import { runMonitorApp } from "../monitor/app.js";

async function run() {
  const args = process.argv.slice(2);

  // Full-screen interactive monitor (reliable, full-height, native arrow nav).
  if (args[0] === "monitor") {
    await runMonitorApp(process.cwd());
    return;
  }

  const interactive = !args.includes("-p") && !args.includes("--print");
  if (interactive) {
    try { await playIntro(); } catch { /* never block the agent on the intro */ }
  }
  // The epistemic extension loads via omp's discovery (.pi/settings.json).
  await main(args);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
