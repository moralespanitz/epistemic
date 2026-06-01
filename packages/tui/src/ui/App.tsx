import React, { useEffect, useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { ChatMessage, HypothesisNode, LensName, ResearchWorld } from "../model/types.js";
import type { NodeContext } from "../agent-bridge.js";
import { parseSlash, COMMANDS } from "../slash-commands.js";
import { ChatView } from "./ChatView.js";
import { ModelPicker } from "./ModelPicker.js";
import { NodeView } from "./NodeView.js";
import { LensMissions } from "./LensMissions.js";
import { LensTree } from "./LensTree.js";
import { LensFocus } from "./LensFocus.js";
import { Header } from "./Header.js";
import { TabBar, VIEWS } from "./TabBar.js";
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
    "⏎ on a selected hypothesis enters it. Plain text chats. ↑↓ selects.",
  ].join("\n");
}

export function App({ initialWorld, subscribe, runner, ask, controls }: AppProps) {
  const { exit } = useApp();
  const [world, setWorld] = useState(initialWorld);
  const [lens, setLens] = useState<LensName>("chat");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [entered, setEntered] = useState<string | null>(null); // hypothesis id being drilled into
  const [messages, setMessages] = useState<ChatMessage[]>([]); // global chat thread
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({}); // per-hypothesis threads
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const nextId = React.useRef(0);

  useEffect(() => subscribe(setWorld), [subscribe]);

  const nodes = world.nodes;
  const selected = nodes[Math.min(selectedIdx, Math.max(nodes.length - 1, 0))];
  const enteredNode = entered ? nodes.find((n) => n.id === entered) : undefined;
  const focusNode = enteredNode ?? selected;

  // ── conversation plumbing (target = null → global thread, or a hypothesis id) ──
  const threadOf = (target: string | null): ChatMessage[] => (target ? threads[target] ?? [] : messages);

  const pushTo = (target: string | null, m: ChatMessage) => {
    const withId = { ...m, id: nextId.current++ };
    if (target) setThreads((t) => ({ ...t, [target]: [...(t[target] ?? []), withId] }));
    else setMessages((prev) => [...prev, withId]);
  };

  const appendChunk = (target: string | null, chunk: string) => {
    const upd = (arr: ChatMessage[]): ChatMessage[] => {
      const copy = arr.slice();
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, text: last.text + chunk };
      return copy;
    };
    if (target) setThreads((t) => ({ ...t, [target]: upd(t[target] ?? []) }));
    else setMessages(upd);
  };

  // Push a system note into the active thread and make sure it's visible.
  const note = (text: string) => {
    pushTo(entered, { role: "system", text });
    if (!entered) setLens("chat");
  };

  const sendToAgent = async (text: string, targetArg?: string | null) => {
    if (busy) { note("still waiting on the previous reply — try again in a moment"); return; }
    const target = targetArg !== undefined ? targetArg : entered;
    const node = target ? nodes.find((n) => n.id === target) : selected;
    if (!target) setLens("chat");
    pushTo(target, { role: "user", text });
    pushTo(target, { role: "assistant", text: "" });
    setBusy(true);
    const ctx: NodeContext | undefined = node ? { id: node.id, claim: node.claim, status: node.status } : undefined;
    await ask(text, ctx, (chunk) => appendChunk(target, chunk));
    setBusy(false);
  };

  // ── model picker ──
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

  const enterNode = (id: string) => {
    setEntered(id);
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx >= 0) setSelectedIdx(idx);
  };

  // ←/→ move between full-screen views (leaving any entered hypothesis).
  const cycleView = (dir: number) => {
    setEntered(null);
    setLens((l) => {
      const order = VIEWS.map((v) => v.name);
      const i = order.indexOf(l);
      return order[(i + dir + order.length) % order.length];
    });
  };

  const runSlash = (text: string): void => {
    const r = parseSlash(text);
    if (!r) return;

    if (r.kind === "unknown") { note(`unknown command: /${r.arg} — try /help`); return; }
    if (r.kind === "view") { setEntered(null); setLens(r.name as LensName); return; }
    if (r.kind === "passthrough") { void sendToAgent(text); return; }

    switch (r.name) {
      case "open": {
        const id = r.arg ?? selected?.id;
        if (id && nodes.some((n) => n.id === id)) enterNode(id);
        else note("no hypothesis to open — select one with ↑↓ or pass an id");
        break;
      }
      case "back":
        setEntered(null);
        break;
      case "approve": {
        const node = enteredNode ?? selected;
        if (!node) { note("select a hypothesis first"); break; }
        enterNode(node.id);
        void sendToAgent(
          `Approve hypothesis ${node.id} ("${node.claim}"). Run the kill-or-ship skill: if all gates pass, SHIP it and run verification-before-publication; otherwise list exactly what's blocking.`,
          node.id,
        );
        break;
      }
      case "reject": {
        const node = enteredNode ?? selected;
        if (!node) { note("select a hypothesis first"); break; }
        enterNode(node.id);
        void sendToAgent(
          `Reject hypothesis ${node.id} ("${node.claim}"). Run kill-or-ship with a KILL decision. Reason: ${r.arg ?? "manual rejection"}. Record the lesson.`,
          node.id,
        );
        break;
      }
      case "modify": {
        const node = enteredNode ?? selected;
        if (!node) { note("select a hypothesis first"); break; }
        if (!r.arg) { note("usage: /modify <what to change>"); break; }
        enterNode(node.id);
        void sendToAgent(
          `Modify hypothesis ${node.id} ("${node.claim}"): ${r.arg}. Propose a REFINE or PIVOT per kill-or-ship and update the registration.`,
          node.id,
        );
        break;
      }
      case "spawn": {
        const node = r.arg ? nodes.find((n) => n.id === r.arg) : focusNode;
        if (node) {
          void runner.spawn(node.id, node.computeTarget);
          pushTo(entered, { role: "system", text: `spawned experiment ${node.id} (${node.computeTarget})` });
          if (!entered) setLens("missions");
        } else note("no hypothesis to spawn — select one with ↑↓ or pass an id");
        break;
      }
      case "kill": {
        const id = r.arg ?? focusNode?.id;
        if (id) { runner.kill(id); note(`killed ${id}`); }
        else note("no experiment to kill");
        break;
      }
      case "model":
        if (r.arg) { controls?.setModel?.(r.arg); note(`model → ${r.arg}`); }
        else openModelPicker();
        break;
      case "clear":
        if (entered) setThreads((t) => ({ ...t, [entered]: [] }));
        else { setMessages([]); setLens("chat"); }
        break;
      case "compact":
        if (entered) setThreads((t) => ({ ...t, [entered]: (t[entered] ?? []).slice(-2) }));
        else setMessages((prev) => prev.slice(-2));
        break;
      case "cost": {
        const perNode = nodes.map((n) => `${n.id}: $${n.spent.toFixed(2)} / $${n.costCap}`).join("\n  ");
        note(`Spend\n  total $${world.totalSpent.toFixed(2)} / $${world.totalCap}\n  ${perNode || "(no hypotheses)"}`);
        break;
      }
      case "review": {
        const node = focusNode;
        void sendToAgent(
          `Run a falsification review on hypothesis ${node?.id ?? "(none selected)"}: "${node?.claim ?? ""}". Give the single cheapest experiment that would most likely disconfirm it.`,
          node?.id ?? null,
        );
        break;
      }
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
    if (!text) {
      // Empty ⏎ on a selected hypothesis enters it (drill in).
      if (!entered && selected) enterNode(selected.id);
      return;
    }
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
      if (key.downArrow) { setPicker((p) => (p ? { ...p, index: Math.min(pickerItems(p).length - 1, p.index + 1) } : p)); return; }
      if (key.backspace || key.delete) { setPicker((p) => (p ? { ...p, query: p.query.slice(0, -1), index: 0 } : p)); return; }
      if (input && !key.ctrl && !key.meta) { setPicker((p) => (p ? { ...p, query: p.query + input, index: 0 } : p)); return; }
      return;
    }

    if (key.return) { submit(); return; }
    if (key.escape) {
      if (draft) setDraft("");
      else if (entered) setEntered(null); // esc on empty leaves the hypothesis
      return;
    }
    if (key.backspace || key.delete) { setDraft((d) => d.slice(0, -1)); return; }
    if (key.leftArrow) { cycleView(-1); return; }
    if (key.rightArrow) { cycleView(1); return; }
    if (key.upArrow) { setSelectedIdx((i) => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIdx((i) => Math.min(Math.max(nodes.length - 1, 0), i + 1)); return; }
    if (input && !key.ctrl && !key.meta) setDraft((d) => d + input);
  });

  const mainPane = () => {
    if (picker) {
      return (
        <ModelPicker
          items={pickerItems(picker)}
          query={picker.query}
          index={picker.index}
          loading={picker.loading}
          current={controls?.getModel?.()}
        />
      );
    }
    if (enteredNode) {
      return <NodeView node={enteredNode} messages={threadOf(enteredNode.id)} busy={busy} />;
    }
    if (lens === "tree") return <LensTree world={world} selectedId={selected?.id} />;
    if (lens === "missions") return <LensMissions world={world} selectedId={selected?.id} />;
    if (lens === "focus") return <LensFocus world={world} selectedId={selected?.id} />;
    return <ChatView messages={messages} busy={busy} />;
  };

  return (
    <Box flexDirection="column">
      <Header world={world} />
      {!picker && <TabBar active={lens} entered={entered ?? undefined} />}
      <Box flexDirection="column" flexGrow={1}>{mainPane()}</Box>
      {!picker && <PromptInput draft={draft} busy={busy} entered={entered ?? undefined} />}
      <StatusFooter world={world} lens={entered ? `▸${entered}` : lens} />
    </Box>
  );
}
