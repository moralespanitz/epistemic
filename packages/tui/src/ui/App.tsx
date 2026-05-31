import React, { useEffect, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { ChatMessage, HypothesisNode, LensName, ResearchWorld } from "../model/types.js";
import type { NodeContext } from "../agent-bridge.js";
import { parseSlash } from "../slash-commands.js";
import { ChatView } from "./ChatView.js";
import { LensMissions } from "./LensMissions.js";
import { LensTree } from "./LensTree.js";
import { LensFocus } from "./LensFocus.js";
import { Inspector } from "./Inspector.js";
import { Header } from "./Header.js";
import { PromptInput } from "./PromptInput.js";
import { StatusFooter } from "./StatusFooter.js";

export interface AppProps {
  initialWorld: ResearchWorld;
  subscribe: (cb: (w: ResearchWorld) => void) => () => void;
  runner: { spawn: (id: string, target: HypothesisNode["computeTarget"]) => Promise<void>; kill: (id: string) => void };
  ask: (question: string, ctx: NodeContext | undefined, onChunk: (c: string) => void) => Promise<string>;
}

const HELP_TEXT = [
  "Commands:",
  "  /chat /tree /missions /focus  — switch the main view",
  "  /spawn [id]   — run the selected (or named) experiment",
  "  /kill [id]    — stop the selected (or named) experiment",
  "  /review       — ask the agent for the cheapest disconfirming experiment",
  "  /help /quit   — this help · exit",
  "Plain text is sent to the agent. ↑↓ selects a hypothesis.",
].join("\n");

export function App({ initialWorld, subscribe, runner, ask }: AppProps) {
  const { exit } = useApp();
  const [world, setWorld] = useState(initialWorld);
  const [lens, setLens] = useState<LensName>("chat");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribe(setWorld), [subscribe]);

  const nodes = world.nodes;
  const selected = nodes[Math.min(selectedIdx, Math.max(nodes.length - 1, 0))];

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m]);

  const sendToAgent = async (text: string) => {
    setLens("chat");
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    const ctx: NodeContext | undefined = selected
      ? { id: selected.id, claim: selected.claim, status: selected.status }
      : undefined;
    await ask(text, ctx, (chunk) =>
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, text: last.text + chunk };
        return copy;
      }),
    );
    setBusy(false);
  };

  const runSlash = (text: string): void => {
    const r = parseSlash(text);
    if (!r) return;
    switch (r.kind) {
      case "lens":
        setLens(r.arg as LensName);
        break;
      case "spawn": {
        const node = r.arg ? nodes.find((n) => n.id === r.arg) : selected;
        if (node) {
          void runner.spawn(node.id, node.computeTarget);
          pushMessage({ role: "system", text: `spawned experiment ${node.id} (${node.computeTarget})` });
          setLens("missions");
        } else {
          pushMessage({ role: "system", text: "no hypothesis to spawn — select one with ↑↓ or pass an id" });
        }
        break;
      }
      case "kill": {
        const id = r.arg ?? selected?.id;
        if (id) { runner.kill(id); pushMessage({ role: "system", text: `killed ${id}` }); }
        else pushMessage({ role: "system", text: "no experiment to kill" });
        break;
      }
      case "review":
        void sendToAgent(
          `Run a falsification review on hypothesis ${selected?.id ?? "(none selected)"}: "${selected?.claim ?? ""}". Give the single cheapest experiment that would most likely disconfirm it.`,
        );
        break;
      case "help":
        pushMessage({ role: "system", text: HELP_TEXT });
        break;
      case "quit":
        exit();
        break;
      case "unknown":
        pushMessage({ role: "system", text: `unknown command: /${r.arg} — try /help` });
        break;
    }
  };

  const submit = (): void => {
    const text = draft.trim();
    setDraft("");
    if (!text) return;
    if (text.startsWith("/")) runSlash(text);
    else void sendToAgent(text);
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") { exit(); return; }
    if (key.return) { submit(); return; }
    if (key.escape) { setDraft(""); return; }
    if (key.backspace || key.delete) { setDraft((d) => d.slice(0, -1)); return; }
    if (key.upArrow) { setSelectedIdx((i) => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIdx((i) => Math.min(Math.max(nodes.length - 1, 0), i + 1)); return; }
    if (input && !key.ctrl && !key.meta) setDraft((d) => d + input);
  });

  return (
    <Box flexDirection="column">
      <Header world={world} />
      <Box>
        <Box flexDirection="column" flexGrow={1}>
          {lens === "chat" && <ChatView messages={messages} busy={busy} />}
          {lens === "tree" && <LensTree world={world} selectedId={selected?.id} />}
          {lens === "missions" && <LensMissions world={world} selectedId={selected?.id} />}
          {lens === "focus" && <LensFocus world={world} selectedId={selected?.id} />}
        </Box>
        <Inspector node={selected} world={world} />
      </Box>
      <PromptInput draft={draft} busy={busy} />
      <StatusFooter world={world} lens={lens} />
    </Box>
  );
}
