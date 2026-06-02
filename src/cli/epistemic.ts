/**
 * epistemic — a research-discipline coding agent.
 *
 *   epistemic            → branded intro, then the interactive chat + the
 *                          epistemic extension (gates, /monitor, /map, skills)
 *   epistemic monitor    → the full-screen interactive experiment monitor
 *
 * Built on the pi agent SDK under the hood; the experience is epistemic's.
 */
// Suppress the underlying framework's version/update banner so only epistemic shows.
process.env.PI_SKIP_VERSION_CHECK = "1";
process.env.PI_TELEMETRY = process.env.PI_TELEMETRY ?? "0";

// Load a local .env (keys for adversary models, HuggingFace, Modal, etc.) so
// experiments and gates have what they need. Agent-model auth still goes via /login.
import { existsSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (existsSync(f)) { try { process.loadEnvFile(f); } catch { /* ignore */ } }
}

import { main } from "@earendil-works/pi-coding-agent";
import epistemicExtension from "../index.js";
import { playIntro } from "./intro.js";
import { runMonitorApp } from "../monitor/app.js";

// Fully-qualified openrouter id so it uses the OpenRouter provider (where you're
// authed), not the direct DeepSeek provider. Avoids Claude subscription billing.
const DEFAULT_MODEL = "openrouter/deepseek/deepseek-v4-pro";

async function run() {
  const args = process.argv.slice(2);

  if (args[0] === "monitor") {
    await runMonitorApp(process.cwd());
    return;
  }

  // Default to openrouter deepseek-v4-pro unless the user picks a model.
  if (!args.includes("--model") && !args.includes("-m")) {
    args.push("--model", DEFAULT_MODEL);
  }

  const interactive = !args.includes("-p") && !args.includes("--print");
  if (interactive) {
    try { await playIntro(); } catch { /* never block the agent on the intro */ }
  }
  // Inject the epistemic extension so gates + /monitor work from ANY directory
  // (not only inside a repo whose .pi/settings.json discovers it). The extension's
  // own process-wide guard prevents double-load when both paths apply.
  await main(args, { extensionFactories: [epistemicExtension as unknown as (pi: unknown) => void] });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
