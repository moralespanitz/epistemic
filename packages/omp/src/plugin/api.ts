/** Context available to command handlers and gate handlers at runtime. */
export interface EpistemicContext {
  cwd: string;
  ui: {
    notify(message: string, level: "info" | "warn" | "error"): void;
    setWidget(key: string, widget: unknown, opts?: { placement?: string }): void;
    setStatus?(key: string, text: string): void;
    setWorkingMessage?(text: string): void;
    setEditorText?(text: string): void;
    input?(prompt: string, placeholder?: string): Promise<string | undefined>;
    select?(title: string, options: string[]): Promise<string | undefined>;
    onTerminalInput?(handler: (data: string) => { consume: true } | undefined): void;
    custom?(factory: (tui: unknown, theme: unknown, kb: unknown, done: (result: unknown) => void) => unknown): Promise<unknown>;
  };
  sendUserMessage?(message: string): Promise<void>;
}

/** Options for registering a slash command. */
export interface CommandOpts {
  description: string;
  handler: (args: string, ctx: EpistemicContext) => Promise<void> | void;
}

/** A gate handler — return `{ block, reason }` to block a tool call. */
export type GateHandler = (
  event: unknown,
  ctx: EpistemicContext
) => Promise<{ block?: boolean; reason?: string } | undefined | void> | undefined | void;

/** The typed API surface exposed to plugins and used internally. */
export interface EpistemicAPI {
  /** Register a /slash command. */
  registerCommand(name: string, opts: CommandOpts): void;
  /** Subscribe to a pi lifecycle event. */
  on(event: string, handler: (...args: any[]) => any): void;
  /** Register a tool_call gate — return { block, reason } to interrupt. */
  gate(handler: GateHandler): void;
}

/**
 * A third-party epistemic plugin. Receives the EpistemicAPI and registers
 * its commands, events, and gates. Called once per pi instance.
 */
export type EpistemicPlugin = (api: EpistemicAPI) => void | Promise<void>;
