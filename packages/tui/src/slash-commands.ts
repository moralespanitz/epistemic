import type { LensName } from "./model/types.js";

export type SlashKind = "lens" | "spawn" | "kill" | "review" | "help" | "quit" | "unknown";

export interface SlashResult {
  kind: SlashKind;
  /** For "lens": the lens name. For spawn/kill: optional id. For unknown: the word typed. */
  arg?: string;
}

/** The slash commands shown in the hint line and accepted by the parser. */
export const SLASH_COMMANDS = [
  "/chat", "/tree", "/missions", "/focus",
  "/spawn", "/kill", "/review", "/help", "/quit",
] as const;

const LENS_WORDS: ReadonlySet<string> = new Set<LensName>(["chat", "tree", "missions", "focus"]);

/**
 * Parse a slash command. Returns null if the text is not a slash command
 * (i.e. it should be sent to the agent as a normal message instead).
 */
export function parseSlash(text: string): SlashResult | null {
  if (!text.startsWith("/")) return null;
  const [word = "", ...rest] = text.slice(1).trim().split(/\s+/);
  const arg = rest.join(" ") || undefined;
  const w = word.toLowerCase();

  if (!w) return { kind: "help" }; // bare "/" → show help
  if (LENS_WORDS.has(w)) return { kind: "lens", arg: w };
  if (w === "spawn") return { kind: "spawn", arg };
  if (w === "kill") return { kind: "kill", arg };
  if (w === "review") return { kind: "review", arg };
  if (w === "help") return { kind: "help" };
  if (w === "quit" || w === "exit" || w === "q") return { kind: "quit" };
  return { kind: "unknown", arg: w };
}
