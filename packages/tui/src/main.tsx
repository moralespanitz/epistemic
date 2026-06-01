import React from "react";
import { render } from "ink";
import { StateStore } from "./state-store.js";
import { ExperimentRunner } from "./experiment-runner.js";
import { AgentBridge } from "./agent-bridge.js";
import { App } from "./ui/App.js";
import type { ResearchWorld } from "./model/types.js";

async function main() {
  const cwd = process.cwd();
  const store = new StateStore(cwd);
  const runner = new ExperimentRunner(cwd);
  const bridge = new AgentBridge(cwd);

  const initialWorld = await store.read();

  const subscribers = new Set<(w: ResearchWorld) => void>();
  await store.watch((w) => subscribers.forEach((cb) => cb(w)));

  const { waitUntilExit } = render(
    <App
      initialWorld={initialWorld}
      subscribe={(cb) => { subscribers.add(cb); return () => subscribers.delete(cb); }}
      runner={runner}
      ask={(q, ctx, onChunk) => bridge.ask(q, ctx, onChunk)}
      controls={{
        setModel: (id) => bridge.setModel(id),
        getModel: () => bridge.getModel(),
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
