/**
 * Credential management for epistemic — set provider/experiment keys from inside
 * the agent (/credentials), persisted to a gitignored .env and applied live.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface KeySpec {
  name: string;       // env var
  label: string;      // human label
  used: string;       // what it's for
}

export const KNOWN_KEYS: KeySpec[] = [
  { name: "OPENROUTER_API_KEY", label: "OpenRouter", used: "default agent model (deepseek-v4-pro)" },
  { name: "ANTHROPIC_API_KEY", label: "Anthropic", used: "Claude as model or adversary" },
  { name: "OPENAI_API_KEY", label: "OpenAI", used: "falsification adversary" },
  { name: "GOOGLE_API_KEY", label: "Google", used: "falsification adversary" },
  { name: "HF_TOKEN", label: "HuggingFace", used: "baselines / gated datasets" },
  { name: "MODAL_TOKEN_ID", label: "Modal token id", used: "modal compute target" },
  { name: "MODAL_TOKEN_SECRET", label: "Modal token secret", used: "modal compute target" },
];

const isSet = (name: string): boolean => !!(process.env[name] && process.env[name]!.trim());

/** One status line per key — ✓ set / ✗ missing — never reveals the value. */
export function credentialStatus(): string[] {
  return KNOWN_KEYS.map((k) => `  ${isSet(k.name) ? "✓" : "✗"} ${k.name.padEnd(20)} ${k.used}`);
}

/** Options for a picker: "✓ OpenRouter — default agent model" etc. */
export function credentialOptions(): { label: string; key: string }[] {
  return KNOWN_KEYS.map((k) => ({ label: `${isSet(k.name) ? "✓" : "✗"} ${k.label} (${k.name})`, key: k.name }));
}

/** Upsert KEY=value into <cwd>/.env, preserving other lines. */
export async function saveKey(cwd: string, name: string, value: string): Promise<void> {
  const path = join(cwd, ".env");
  let content = "";
  try { content = await readFile(path, "utf8"); } catch { /* new file */ }
  const lines = content.split("\n");
  const line = `${name}=${value}`;
  const idx = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (idx >= 0) lines[idx] = line;
  else {
    if (content && !content.endsWith("\n")) lines.push("");
    lines.push(line);
  }
  await writeFile(path, lines.join("\n").replace(/\n+$/, "") + "\n", "utf8");
  process.env[name] = value; // apply to the running session immediately
}
