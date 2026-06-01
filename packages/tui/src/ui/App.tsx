import React, { useEffect, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { ChatMessage, HypothesisNode, LensName, ResearchWorld } from "../model/types.js";
import type { NodeContext } from "../agent-bridge.js";
import { parseSlash, COMMANDS } from "../slash-commands.js";
import { ChatView } from "./ChatView.js";
import { ModelPicker } from "./ModelPicker.js";
import { LensMissions } from "./LensMissions.js";
import { LensTree } from "./LensTree.js";
import { LensFocus } from "./LensFocus.js";
import { Inspector } from "./Inspector.js";
import { Header } from "./Header.js";
import { PromptInput } from "./PromptInput.js";
import { StatusFooter } from "./StatusFooter.js";

export interface AgentControls {
  setModel?: (id: string | undefined) => void;
  getModel?: () => string | undefined;
  loadModels?: (query: string) => Promise<string[]>;
}

interface PickerState {
  all: string[];
  query: string;
  index: number;
  loading: boolean;
}

export interface AppProps {
  initialWorld: ResearchWorld;
  subscribe: (cb: (w: ResearchWorld) => void) => () => void;
  runner: { spawn: (id: string, target: HypothesisNode["computeTarget"]) => Promise<void>; kill: (id: string) => void };
  ask: (question: string, ctx: NodeContext | undefined, onChunk: (c: string) => void) => Promise<string>;
  controls?: AgentControls;
}

function helpText(): string {
  const group = (kind: string) => COMMANDS.filter((c) => c.kind === kind).map((c) => `  /${c.name.padEnd(10)} ${c.description}`).join("\n");
  return [
    "Views", group("view"),
    "Actions", group("action"),
    "Forwarded to omp", group("passthrough"),
    "",
    "Plain text is sent to the agent. ↑↓ selects a hypothesis.",
  ].join("\n");
}

export function App({ initialWorld, subscribe, runner, ask, controls }: AppProps) {
  const { exit } = useApp();
  const [world, setWorld] = useState(initialWorld);
  const [lens, setLens] = useState<LensName>("chat");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const nextId = React.useRef(0);

  useEffect(() => subscribe(setWorld), [subscribe]);

  const pickerItems = (p: PickerState): string[] => {
    const q = p.query.toLowerCase();
    return q ? p.all.filter((m) => m.toLowerCase().includes(q)) : p.all;
  };

  const openModelPicker = () => {
    setPicker({ all: [], query: "", index: 0, loading: true });
    void (controls?.loadModels?.("") ?? Promise.resolve([])).then((all) =>
      setPicker((p) => (p ? { ...p, all, loading: false } : p)),
    );
  };

  const nodes = world.nodes;
  const selected = nodes[Math.min(selectedIdx, Math.max(nodes.length - 1, 0))];

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }]);

  // Push a system note and make sure it's visible (switch to the chat view).
  const note = (text: string) => { pushMessage({ role: "system", text }); setLens("chat"); };

  const sendToAgent = async (text: string) => {
    if (busy) { note("still waiting on the previous reply — try again in a moment"); return; }
    setLens("chat");
    setMessages((prev) => [
      ...prev,
      { role: "user", text, id: nextId.current++ },
      { role: "assistant", text: "", id: nextId.current++ },
    ]);
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

    if (r.kind === "unknown") { note(`unknown command: /${r.arg} — try /help`); return; }
    if (r.kind === "view") { setLens(r.name as LensName); return; }
    if (r.kind === "passthrough") {
      // Forward the raw "/command args" to the omp agent as a turn.
      void sendToAgent(text);
      return;
    }

    // Cockpit-native actions.
    switch (r.name) {
      case "spawn": {
        const node = r.arg ? nodes.find((n) => n.id === r.arg) : selected;
        if (node) {
          void runner.spawn(node.id, node.computeTarget);
          pushMessage({ role: "system", text: `spawned experiment ${node.id} (${node.computeTarget})` });
          setLens("missions");
        } else {
          note("no hypothesis to spawn — select one with ↑↓ or pass an id");
        }
        break;
      }
      case "kill": {
        const id = r.arg ?? selected?.id;
        if (id) { runner.kill(id); note(`killed ${id}`); }
        else note("no experiment to kill");
        break;
      }
      case "model": {
        if (r.arg) { controls?.setModel?.(r.arg); note(`model → ${r.arg}`); }
        else openModelPicker(); // no arg → open the interactive picker
        break;
      }
      case "clear":
        setMessages([]);
        setLens("chat");
        break;
      case "compact":
        setMessages((prev) => {
          const kept = prev.slice(-2);
          return [{ role: "system" as const, text: `(compacted ${prev.length} earlier messages)`, id: nextId.current++ }, ...kept];
        });
        setLens("chat");
        break;
      case "cost": {
        const perNode = nodes.map((n) => `${n.id}: $${n.spent.toFixed(2)} / $${n.costCap}`).join("\n  ");
        note(`Spend\n  total $${world.totalSpent.toFixed(2)} / $${world.totalCap}\n  ${perNode || "(no hypotheses)"}`);
        break;
      }
      case "review":
        void sendToAgent(
          `Run a falsification review on hypothesis ${selected?.id ?? "(none selected)"}: "${selected?.claim ?? ""}". Give the single cheapest experiment that would most likely disconfirm it.`,
        );
        break;
      case "help":
        note(helpText());
        break;
      case "quit":
        exit();
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

    // Model picker captures input while open.
    if (picker) {
      const items = pickerItems(picker);
      if (key.escape) { setPicker(null); return; }
      if (key.return) {
        const m = items[picker.index];
        if (m) { controls?.setModel?.(m); note(`model → ${m}`); }
        setPicker(null);
        return;
      }
      if (key.upArrow) { setPicker((p) => (p ? { ...p, index: Math.max(0, p.index - 1) } : p)); return; }
      if (key.downArrow) {
        setPicker((p) => (p ? { ...p, index: Math.min(pickerItems(p).length - 1, p.index + 1) } : p));
        return;
      }
      if (key.backspace || key.delete) { setPicker((p) => (p ? { ...p, query: p.query.slice(0, -1), index: 0 } : p)); return; }
      if (input && !key.ctrl && !key.meta) { setPicker((p) => (p ? { ...p, query: p.query + input, index: 0 } : p)); return; }
      return;
    }

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
          {picker ? (
            <ModelPicker
              items={pickerItems(picker)}
              query={picker.query}
              index={picker.index}
              loading={picker.loading}
              current={controls?.getModel?.()}
            />
          ) : (
            <>
              {lens === "chat" && <ChatView messages={messages} busy={busy} />}
              {lens === "tree" && <LensTree world={world} selectedId={selected?.id} />}
              {lens === "missions" && <LensMissions world={world} selectedId={selected?.id} />}
              {lens === "focus" && <LensFocus world={world} selectedId={selected?.id} />}
            </>
          )}
        </Box>
        <Inspector node={selected} world={world} />
      </Box>
      {!picker && <PromptInput draft={draft} busy={busy} />}
      <StatusFooter world={world} lens={lens} />
    </Box>
  );
}
