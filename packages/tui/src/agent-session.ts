import { buildPrompt, type NodeContext } from "./agent-bridge.js";

/**
 * Real agent backend, built on the pi SDK's `createAgentSession` — the same
 * engine omp runs. Unlike the `omp -p` shell bridge, this is a persistent
 * session: it auto-discovers skills, extensions (epistemic's gates), tools,
 * MCP servers, and memory from `.pi/`, and streams text + tool activity.
 *
 * It exposes the same `ask(question, ctx, onChunk)` contract the UI already
 * uses, so it drops in for AgentBridge with no UI changes.
 */
export interface AgentSessionLike {
  subscribe(listener: (event: any) => void): () => void;
  prompt(text: string, opts?: unknown): Promise<unknown>;
  dispose(): void;
}

export interface SessionDeps {
  /** Inject the SDK factory (real one in prod, a fake in tests). */
  createSession: (opts: { model?: unknown }) => Promise<{ session: AgentSessionLike }>;
  /** Optional: resolve a model id to the SDK's model object. */
  resolveModel?: (id: string) => Promise<unknown> | unknown;
}

export class AgentSessionBridge {
  private session: AgentSessionLike | null = null;
  private model?: string;
  private resolvedModel?: unknown;
  private initError?: string;
  private starting?: Promise<AgentSessionLike | null>;

  constructor(private deps: SessionDeps) {}

  setModel(id: string | undefined): void {
    const next = id && id.trim() ? id.trim() : undefined;
    if (next === this.model) return;
    this.model = next;
    // Force a fresh session on the next turn with the new model.
    this.session?.dispose();
    this.session = null;
    this.starting = undefined;
  }

  getModel(): string | undefined {
    return this.model;
  }

  private async ensureSession(): Promise<AgentSessionLike | null> {
    if (this.session) return this.session;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      try {
        if (this.model && this.deps.resolveModel && this.resolvedModel === undefined) {
          this.resolvedModel = await this.deps.resolveModel(this.model);
        }
        const { session } = await this.deps.createSession({ model: this.resolvedModel });
        this.session = session;
        this.initError = undefined;
        return session;
      } catch (err) {
        this.initError = err instanceof Error ? err.message : String(err);
        return null;
      }
    })();
    return this.starting;
  }

  /**
   * Run one agent turn. Streams assistant text via onChunk and surfaces tool
   * activity as bracketed lines so the user sees the agent working.
   * Resolves with the full assistant text.
   */
  async ask(
    question: string,
    ctx: NodeContext | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const session = await this.ensureSession();
    if (!session) return `agent unavailable (${this.initError ?? "no session"})`;

    let full = "";
    const unsubscribe = session.subscribe((event: any) => {
      if (event?.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
        const delta: string = event.assistantMessageEvent.delta ?? "";
        full += delta;
        onChunk(delta);
      } else if (event?.type === "tool_execution_start") {
        onChunk(`\n  ⚙ ${event.toolName}…\n`);
      }
    });

    try {
      await session.prompt(buildPrompt(question, ctx));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return full || `agent error: ${msg}`;
    } finally {
      unsubscribe();
    }
    return full || "(no output)";
  }

  dispose(): void {
    this.session?.dispose();
    this.session = null;
  }
}
