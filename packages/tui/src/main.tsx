import React from "react";
import { render } from "ink";
import { StateStore } from "./state-store.js";
import { ExperimentRunner } from "./experiment-runner.js";
import { AgentBridge } from "./agent-bridge.js";
import { AgentSessionBridge } from "./agent-session.js";
import { listModels } from "./models.js";
import { App } from "./ui/App.js";
import type { NodeContext } from "./agent-bridge.js";
import type { ResearchWorld } from "./model/types.js";

/**
 * Build the agent backend. Prefers the real pi SDK session (full tools, MCP,
 * memory, epistemic gates); falls back to the `omp -p` shell bridge if the SDK
 * isn't importable in this environment.
 */
async function buildAgent(cwd: string): Promise<{
  ask: (q: string, ctx: NodeContext | undefined, onChunk: (c: string) => void) => Promise<string>;
  setModel: (id: string | undefined) => void;
  getModel: () => string | undefined;
}> {
  try {
    const sdk: any = await import("@earendil-works/pi-coding-agent");
    if (typeof sdk.createAgentSession !== "function") throw new Error("SDK has no createAgentSession");
    const bridge = new AgentSessionBridge({
      createSession: (opts) => sdk.createAgentSession(opts),
    });
    return {
      ask: (q, ctx, onChunk) => bridge.ask(q, ctx, onChunk),
      setModel: (id) => bridge.setModel(id),
      getModel: () => bridge.getModel(),
    };
  } catch {
    // Fallback: shell out to `omp -p`.
    const bridge = new AgentBridge(cwd);
    return {
      ask: (q, ctx, onChunk) => bridge.ask(q, ctx, onChunk),
      setModel: (id) => bridge.setModel(id),
      getModel: () => bridge.getModel(),
    };
  }
}

async function main() {
  const cwd = process.cwd();
  const store = new StateStore(cwd);
  const runner = new ExperimentRunner(cwd);
  const agent = await buildAgent(cwd);

  const initialWorld = await store.read();

  const subscribers = new Set<(w: ResearchWorld) => void>();
  await store.watch((w) => subscribers.forEach((cb) => cb(w)));

  const { waitUntilExit } = render(
    <App
      initialWorld={initialWorld}
      subscribe={(cb) => { subscribers.add(cb); return () => subscribers.delete(cb); }}
      runner={runner}
      ask={agent.ask}
      controls={{
        setModel: agent.setModel,
        getModel: agent.getModel,
        loadModels: (query) => listModels(query),
      }}
    />,
  );

  await waitUntilExit();
  await store.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
