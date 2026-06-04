/**
 * epistemic config — read/write persistent user config at ~/.epistemic/config.json
 *
 *   epistemic config get model
 *   epistemic config set model claude-sonnet-4-6
 *   epistemic config set model openrouter/deepseek/deepseek-v4-pro
 *   epistemic config list
 *   epistemic config reset model
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR  = join(homedir(), ".epistemic");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface EpistemicConfig {
  model?: string;
}

export function readConfig(): EpistemicConfig {
  try {
    if (existsSync(CONFIG_FILE)) return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch { /* corrupted — return empty */ }
  return {};
}

function writeConfig(cfg: EpistemicConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n");
}

const KNOWN_MODELS: Record<string, string> = {
  // Anthropic
  "claude-sonnet-4-6":   "claude-sonnet-4-6",
  "claude-opus-4-8":     "claude-opus-4-8",
  "claude-haiku-4-5":    "claude-haiku-4-5-20251001",
  "sonnet":              "claude-sonnet-4-6",
  "opus":                "claude-opus-4-8",
  "haiku":               "claude-haiku-4-5-20251001",
  // OpenRouter
  "deepseek":            "openrouter/deepseek/deepseek-v4-pro",
  "deepseek-flash":      "openrouter/deepseek/deepseek-v4-flash",
  "gemini":              "openrouter/google/gemini-2.5-pro",
  // Codex
  "codex":               "openai-codex/gpt-5.5",
  "gpt-4o":              "gpt-4o",
};

function resolveAlias(input: string): string {
  return KNOWN_MODELS[input.toLowerCase()] ?? input;
}

export async function runConfig(args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "list" || sub === "show") {
    const cfg = readConfig();
    console.log(`Ξ epistemic config  (${CONFIG_FILE})\n`);
    if (Object.keys(cfg).length === 0) {
      console.log("  (no config — using auto-detected defaults)");
    } else {
      for (const [k, v] of Object.entries(cfg)) console.log(`  ${k} = ${v}`);
    }
    console.log("\nAvailable aliases:");
    for (const [alias, id] of Object.entries(KNOWN_MODELS)) {
      console.log(`  ${alias.padEnd(20)} → ${id}`);
    }
    return;
  }

  if (sub === "get") {
    const key = args[1];
    if (!key) { console.error("Usage: epistemic config get <key>"); process.exit(1); }
    const val = (readConfig() as any)[key];
    if (val === undefined) console.log(`(not set)`);
    else console.log(val);
    return;
  }

  if (sub === "set") {
    const key = args[1];
    const val = args[2];
    if (!key || !val) { console.error("Usage: epistemic config set <key> <value>"); process.exit(1); }
    const cfg = readConfig();
    const resolved = key === "model" ? resolveAlias(val) : val;
    (cfg as any)[key] = resolved;
    writeConfig(cfg);
    console.log(`✓ ${key} = ${resolved}`);
    if (key === "model" && resolved !== val) console.log(`  (alias resolved from "${val}")`);
    console.log(`  saved to ${CONFIG_FILE}`);
    return;
  }

  if (sub === "reset" || sub === "unset") {
    const key = args[1];
    if (!key) { console.error("Usage: epistemic config reset <key>"); process.exit(1); }
    const cfg = readConfig();
    delete (cfg as any)[key];
    writeConfig(cfg);
    console.log(`✓ ${key} reset — will use auto-detected default`);
    return;
  }

  console.error(`Unknown config subcommand: ${sub}`);
  console.error("Usage: epistemic config [list|get|set|reset]");
  process.exit(1);
}
