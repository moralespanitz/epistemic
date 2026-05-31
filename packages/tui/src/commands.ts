import type { ComputeTarget, HypothesisNode } from "./model/types.js";

export type LensName = "tree" | "missions" | "focus";

export interface CommandDeps {
  runner: { spawn: (id: string, target: ComputeTarget) => Promise<void>; kill: (id: string) => void };
  selectedNode: () => HypothesisNode | undefined;
  setLens: (lens: LensName) => void;
  openCommandBar: () => void;
}

export interface Command {
  id: string;
  label: string;
  run: () => void | Promise<void>;
}

export function buildCommands(deps: CommandDeps): Command[] {
  return [
    {
      id: "spawn",
      label: "Spawn experiment for selected hypothesis",
      run: async () => {
        const n = deps.selectedNode();
        if (n) await deps.runner.spawn(n.id, n.computeTarget);
      },
    },
    {
      id: "kill",
      label: "Kill selected experiment",
      run: () => {
        const n = deps.selectedNode();
        if (n) deps.runner.kill(n.id);
      },
    },
    { id: "lens-tree", label: "Switch to Tree lens", run: () => deps.setLens("tree") },
    { id: "lens-missions", label: "Switch to Missions lens", run: () => deps.setLens("missions") },
    { id: "lens-focus", label: "Switch to Focus lens", run: () => deps.setLens("focus") },
    { id: "summon-agent", label: "Ask the agent (Ctrl+K)", run: () => deps.openCommandBar() },
  ];
}
