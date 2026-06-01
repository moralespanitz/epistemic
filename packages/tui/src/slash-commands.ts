/**
 * Slash-command registry for the cockpit. Mirrors pi.dev / omp command names so
 * the interface feels familiar, grouped by how the cockpit handles each:
 *
 *  - "view":        switches the main pane (cockpit-native)
 *  - "action":      a cockpit-native action (spawn/kill/model/clear/…)
 *  - "passthrough": forwarded to the omp agent as a turn (commit, mcp, memory, …)
 */
export type CommandKind = "view" | "action" | "passthrough";

export interface CommandSpec {
  name: string;          // without the leading slash
  kind: CommandKind;
  description: string;
  /** Aliases that resolve to this command. */
  aliases?: string[];
}

export const COMMANDS: CommandSpec[] = [
  // ── views ───────────────────────────────────────────────
  { name: "chat", kind: "view", description: "Conversation view (default)" },
  { name: "tree", kind: "view", description: "Research tree: parallel trees, conditional plans, alternatives" },
  { name: "missions", kind: "view", description: "Live grid of parallel experiments" },
  { name: "focus", kind: "view", description: "Deep view of the selected experiment" },

  // ── per-hypothesis actions ──────────────────────────────
  { name: "open", kind: "action", description: "Enter a hypothesis (/open H-004) — or ⏎ on a selected one" },
  { name: "back", kind: "action", description: "Leave the hypothesis and return to the tree" },
  { name: "approve", kind: "action", description: "Approve the hypothesis — ship via kill-or-ship" },
  { name: "reject", kind: "action", description: "Reject/kill the hypothesis (/reject [reason])" },
  { name: "modify", kind: "action", description: "Propose a change — refine or pivot (/modify <what>)" },

  // ── cockpit actions ─────────────────────────────────────
  { name: "model", kind: "action", description: "Show or switch the agent model (/model gpt-5.2)" },
  { name: "spawn", kind: "action", description: "Run the selected (or named) experiment" },
  { name: "kill", kind: "action", description: "Stop the selected (or named) experiment" },
  { name: "clear", kind: "action", description: "Clear the conversation" },
  { name: "compact", kind: "action", description: "Compact the conversation, keeping a short summary" },
  { name: "cost", kind: "action", description: "Show spend so far across hypotheses" },
  { name: "review", kind: "action", description: "Ask the agent for the cheapest disconfirming experiment" },
  { name: "help", kind: "action", description: "List commands", aliases: ["?"] },
  { name: "quit", kind: "action", description: "Exit", aliases: ["exit", "q"] },

  // ── forwarded to the omp agent ──────────────────────────
  { name: "commit", kind: "passthrough", description: "AI-generated conventional commit" },
  { name: "branch", kind: "passthrough", description: "Branch the current session state" },
  { name: "python", kind: "passthrough", description: "Drop into a persistent IPython kernel" },
  { name: "export", kind: "passthrough", description: "Export the session to HTML" },
  { name: "mcp", kind: "passthrough", description: "Manage MCP servers" },
  { name: "memory", kind: "passthrough", description: "Manage the autonomous memory system" },
  { name: "agents", kind: "passthrough", description: "Manage subagents" },
  { name: "plan", kind: "passthrough", description: "Toggle plan mode (plan before executing)" },
  { name: "goal", kind: "passthrough", description: "Manage persistent autonomous objectives" },
  { name: "loop", kind: "passthrough", description: "Toggle loop mode for auto-submitting yields" },
  { name: "fast", kind: "passthrough", description: "Toggle priority service tier" },
  { name: "todo", kind: "passthrough", description: "Manage the task list" },
  { name: "session", kind: "passthrough", description: "Switch or delete sessions" },
  { name: "share", kind: "passthrough", description: "Share the session via gist" },
  { name: "settings", kind: "passthrough", description: "Open the settings menu" },
];

const BY_TOKEN: Map<string, CommandSpec> = (() => {
  const m = new Map<string, CommandSpec>();
  for (const c of COMMANDS) {
    m.set(c.name, c);
    for (const a of c.aliases ?? []) m.set(a, c);
  }
  return m;
})();

/** All command tokens with leading slash, for the hint/autocomplete line. */
export const COMMAND_TOKENS = COMMANDS.map((c) => `/${c.name}`);

export interface SlashResult {
  /** Resolved command name (canonical, without slash), or "unknown". */
  name: string;
  kind: CommandKind | "unknown";
  /** Trailing argument text, if any. */
  arg?: string;
  /** The matched spec, when known. */
  spec?: CommandSpec;
}

/**
 * Parse a slash command. Returns null when the text is not a slash command
 * (it should be sent to the agent as a normal message instead).
 */
export function parseSlash(text: string): SlashResult | null {
  if (!text.startsWith("/")) return null;
  const [word = "", ...rest] = text.slice(1).trim().split(/\s+/);
  const arg = rest.join(" ") || undefined;
  const w = word.toLowerCase();

  if (!w) return { name: "help", kind: "action", spec: BY_TOKEN.get("help") };

  const spec = BY_TOKEN.get(w);
  if (!spec) return { name: "unknown", kind: "unknown", arg: w };
  return { name: spec.name, kind: spec.kind, arg, spec };
}

/** Commands whose name begins with the given partial (for autocomplete). */
export function matchCommands(partial: string): CommandSpec[] {
  const p = partial.replace(/^\//, "").toLowerCase();
  return COMMANDS.filter((c) => c.name.startsWith(p));
}
