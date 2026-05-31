import React, { useEffect, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { HypothesisNode, ResearchWorld } from "../model/types.js";
import type { NodeContext } from "../agent-bridge.js";
import type { LensName } from "../commands.js";
import { LensMissions } from "./LensMissions.js";
import { LensTree } from "./LensTree.js";
import { LensFocus } from "./LensFocus.js";
import { Inspector } from "./Inspector.js";
import { StatusFooter } from "./StatusFooter.js";
import { CommandBar } from "./CommandBar.js";

export interface AppProps {
  initialWorld: ResearchWorld;
  subscribe: (cb: (w: ResearchWorld) => void) => () => void;
  runner: { spawn: (id: string, target: HypothesisNode["computeTarget"]) => Promise<void>; kill: (id: string) => void };
  ask: (question: string, ctx: NodeContext | undefined, onChunk: (c: string) => void) => Promise<string>;
}

export function App({ initialWorld, subscribe, runner, ask }: AppProps) {
  const { exit } = useApp();

  const [world, setWorld] = useState(initialWorld);
  const [lens, setLens] = useState<LensName>("missions");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [barVisible, setBarVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribe(setWorld), [subscribe]);

  const nodes = world.nodes;
  const selected = nodes[Math.min(selectedIdx, Math.max(nodes.length - 1, 0))];

  // Main navigation/action keys. Disabled while the command bar is open so
  // CommandBar's own useInput owns typing. useInput enables terminal raw mode,
  // which is what makes arrow keys / single chars get captured instead of echoed.
  useInput(
    (input, key) => {
      if (input === "q" || (key.ctrl && input === "c")) { exit(); return; }
      if (key.ctrl && input === "k") { setBarVisible(true); setAnswer(""); setDraft(""); return; }
      if (input === "1") setLens("tree");
      else if (input === "2") setLens("missions");
      else if (input === "3") setLens("focus");
      else if (key.upArrow || (key.shift && key.tab)) setSelectedIdx((i) => Math.max(0, i - 1));
      else if (key.downArrow || key.tab) setSelectedIdx((i) => Math.min(Math.max(nodes.length - 1, 0), i + 1));
      else if (input === "s" && selected) void runner.spawn(selected.id, selected.computeTarget);
      else if (input === "k" && selected) runner.kill(selected.id);
    },
    { isActive: !barVisible },
  );

  const closeBar = () => { setBarVisible(false); setAnswer(""); setDraft(""); };

  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setAnswer("");
    const ctx: NodeContext | undefined = selected
      ? { id: selected.id, claim: selected.claim, status: selected.status }
      : undefined;
    await ask(draft, ctx, (chunk) => setAnswer((a) => a + chunk));
    setBusy(false);
  };

  return (
    <Box flexDirection="column">
      <Box>
        {lens === "tree" && <LensTree world={world} selectedId={selected?.id} />}
        {lens === "missions" && <LensMissions world={world} selectedId={selected?.id} />}
        {lens === "focus" && <LensFocus world={world} selectedId={selected?.id} />}
        <Inspector node={selected} world={world} />
      </Box>
      <CommandBar
        visible={barVisible}
        draft={draft}
        answer={answer}
        busy={busy}
        onChange={setDraft}
        onSubmit={submit}
        onClose={closeBar}
      />
      <StatusFooter world={world} lens={lens} />
    </Box>
  );
}
