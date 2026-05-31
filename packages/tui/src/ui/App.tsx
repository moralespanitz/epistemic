import React, { useEffect, useLayoutEffect, useState } from "react";
import { Box, useApp, useStdin } from "ink";
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

/** Minimal key metadata extracted from a raw stdin chunk. */
interface KeyMeta {
  upArrow: boolean;
  downArrow: boolean;
  ctrl: boolean;
  escape: boolean;
}

function parseRaw(raw: string): { input: string; key: KeyMeta } {
  const key: KeyMeta = {
    upArrow: raw === "\x1B[A",
    downArrow: raw === "\x1B[B",
    escape: raw === "\x1B",
    ctrl: raw.length === 1 && raw.charCodeAt(0) < 32 && raw.charCodeAt(0) !== 27,
  };
  let input = raw;
  if (key.ctrl) {
    // ctrl+<letter>: charCode 1–26 → letters a–z
    input = String.fromCharCode(raw.charCodeAt(0) + 96);
  } else if (key.upArrow || key.downArrow || key.escape) {
    input = "";
  }
  return { input, key };
}

export function App({ initialWorld, subscribe, runner, ask }: AppProps) {
  const { exit } = useApp();
  const { stdin } = useStdin();

  const [world, setWorld] = useState(initialWorld);
  const [lens, setLens] = useState<LensName>("missions");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [barVisible, setBarVisible] = useState(false);
  const barVisibleRef = React.useRef(false);
  const setBar = (v: boolean) => { barVisibleRef.current = v; setBarVisible(v); };
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribe(setWorld), [subscribe]);

  const nodes = world.nodes;
  const selected = nodes[Math.min(selectedIdx, Math.max(nodes.length - 1, 0))];

  // Use useLayoutEffect so the listener is registered synchronously after
  // the first paint — this ensures stdin.write() in tests is caught even
  // when called immediately after render().
  useLayoutEffect(() => {
    if (!stdin) return;

    const handleData = (chunk: Buffer | string) => {
      const { input, key } = parseRaw(String(chunk));

      // When the command bar is open, only handle escape to close it.
      // CommandBar's own useInput handles all typing.
      if (barVisibleRef.current) {
        if (key.escape) { setBar(false); setAnswer(""); setDraft(""); }
        return;
      }

      // Read barVisible from the ref — always reflects current value without
      // needing to re-register the listener.
      setBarVisible((visible) => {
        if (!visible) {
          if (input === "q") { exit(); }
          else if (key.ctrl && input === "c") { exit(); }
          else if (input === "1") setLens("tree");
          else if (input === "2") setLens("missions");
          else if (input === "3") setLens("focus");
          else if (key.upArrow) setSelectedIdx((i) => Math.max(0, i - 1));
          else if (key.downArrow) setSelectedIdx((i) => Math.min(nodes.length - 1, i + 1));
          else if (input === "s" && selected) void runner.spawn(selected.id, selected.computeTarget);
          else if (input === "k" && selected && !key.ctrl) runner.kill(selected.id);
          else if (key.ctrl && input === "k") { barVisibleRef.current = true; return true; } // open bar
        }
        return visible;
      });
    };

    stdin.on("data", handleData as (data: Buffer) => void);
    return () => {
      stdin.off("data", handleData as (data: Buffer) => void);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stdin, selected, nodes.length, runner, exit]);

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
        <Inspector node={selected} />
      </Box>
      <CommandBar
        visible={barVisible}
        draft={draft}
        answer={answer}
        busy={busy}
        onChange={setDraft}
        onSubmit={submit}
      />
      <StatusFooter world={world} lens={lens} />
    </Box>
  );
}
