/**
 * epistemic — its own coding-agent TUI, built on pi's library.
 *
 *   epistemic            → branded intro, then epistemic's own TUI (Chat ⇄ Monitor,
 *                          swap with Tab) driven by the real pi AgentSession
 *   epistemic monitor    → the full-screen monitor on its own
 *   epistemic --pi [...]  → fall back to pi's stock interactive agent + extension
 */
import { playIntro } from "./intro.js";
import { runEpistemicTui } from "../tui/app.js";
import { runMonitorApp } from "../monitor/app.js";

async function run() {
  const args = process.argv.slice(2);

  if (args[0] === "monitor") {
    await runMonitorApp(process.cwd());
    return;
  }

  if (args[0] === "--pi" || args.includes("-p") || args.includes("--print")) {
    // Stock pi agent (e.g. for non-interactive/print mode), extension auto-loads.
    const { main } = await import("@earendil-works/pi-coding-agent");
    await main(args.filter((a) => a !== "--pi"));
    return;
  }

  try { await playIntro(); } catch { /* never block on the intro */ }
  await runEpistemicTui(process.cwd());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
