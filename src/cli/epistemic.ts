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
import { existsSync, readFileSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (existsSync(f)) { try { process.loadEnvFile(f); } catch { /* ignore */ } }
}

import { main } from "@earendil-works/pi-coding-agent";
import { epistemicExtension } from "@epistemic/omp";
import { playIntro } from "./intro.js";
import { runMonitorApp } from "../monitor/app.js";

// Fully-qualified openrouter id so it uses the OpenRouter provider (where you're
// authed), not the direct DeepSeek provider. Avoids Claude subscription billing.
const DEFAULT_MODEL = "openrouter/deepseek/deepseek-v4-pro";

/**
 * Pick a default model whose provider the user can actually authenticate.
 * Prefers the configured default (openrouter), then falls back to any provider
 * with a key in env or in ~/.pi/agent/auth.json, so the agent never boots into
 * a "No API key found" loop. Returns undefined if nothing is authed (let /login).
 */
function resolveDefaultModel(): string | undefined {
  let authed: Record<string, unknown> = {};
  try {
    const path = `${process.env.HOME}/.pi/agent/auth.json`;
    if (existsSync(path)) authed = JSON.parse(readFileSync(path, "utf8")) ?? {};
  } catch { /* ignore */ }
  const has = (envKey: string, provider: string) =>
    !!(process.env[envKey] && process.env[envKey]!.trim()) || provider in authed;

  if (has("OPENROUTER_API_KEY", "openrouter")) return DEFAULT_MODEL;
  if (has("ANTHROPIC_API_KEY", "anthropic")) return "claude-sonnet-4-6";
  if (has("OPENAI_API_KEY", "openai")) return "gpt-4o";
  return undefined;
}

async function run() {
  const args = process.argv.slice(2);

  if (args[0] === "monitor") {
    await runMonitorApp(process.cwd());
    return;
  }

  if (args[0] === "fleet") {
    const { runFleetApp } = await import("../research/fleet-app.js");
    await runFleetApp(process.cwd());
    return;
  }

  if (args[0] === "hooks") {
    const { runHooks } = await import("./hooks.js");
    await runHooks(args.slice(1));
    return;
  }

  if (args[0] === "skills") {
    const { runSkills } = await import("./skills.js");
    await runSkills(args.slice(1));
    return;
  }

  // Default to openrouter deepseek-v4-pro unless the user picks a model.
  // But only if its provider key is actually present — otherwise the agent
  // boots straight into "No API key found" and churns through fallbacks
  // (the failure seen in practice). Prefer a provider the user is authed for.
  if (!args.includes("--model") && !args.includes("-m")) {
    const model = resolveDefaultModel();
    if (model) args.push("--model", model);
    // If nothing is authed, let pi prompt /login rather than forcing a dead model.
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
