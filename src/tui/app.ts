/**
 * epistemic's own TUI, built on pi's library (@earendil-works/pi-tui) and driven
 * by the real pi agent (@earendil-works/pi-coding-agent AgentSession). Because
 * we own the layout, we get the claude-agents experience: the same chat, with
 * Tab / ←→ to swap between Chat and Monitor views — reliably, no truncation.
 */
import { ProcessTerminal, TUI, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import { loadFleet, type Fleet } from "../monitor/fleet.js";
import { renderMonitor, type MonitorMode } from "../research/monitor.js";
import { parseKey, reduceNav, actionPrompt, type ActionLabel } from "../research/monitor-nav.js";

const ESC = "\x1b[";
const R = `${ESC}0m`;
const magenta = (s: string) => `${ESC}1;38;5;213m${s}${R}`;
const cyan = (s: string) => `${ESC}38;5;51m${s}${R}`;
const dim = (s: string) => `${ESC}2m${s}${R}`;
const green = (s: string) => `${ESC}38;5;42m${s}${R}`;

type ViewName = "chat" | "monitor";
interface Msg { role: "you" | "agent" | "system"; text: string; }

export async function runEpistemicTui(cwd: string): Promise<void> {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  let view: ViewName = "chat";
  const messages: Msg[] = [{ role: "system", text: "Ξ epistemic — your research agent. Tab swaps Chat ⇄ Monitor. Type to chat." }];
  let draft = "";
  let busy = false;
  let fleet: Fleet = await loadFleet(cwd);
  let monMode: MonitorMode = "tree";
  let monIdx = 0;
  const actions: ActionLabel[] = ["chat", "approve", "reject", "modify"];

  // Real agent session (same engine omp runs). Degrade gracefully if it can't start.
  let session: any = null;
  let agentError = "";
  try {
    const created = await createAgentSession({});
    session = created.session;
    session.subscribe((ev: any) => {
      if (ev?.type === "message_update" && ev.assistantMessageEvent?.type === "text_delta") {
        const last = messages[messages.length - 1];
        if (last?.role === "agent") { last.text += ev.assistantMessageEvent.delta ?? ""; tui.requestRender(); }
      } else if (ev?.type === "tool_execution_start") {
        messages.push({ role: "system", text: `⚙ ${ev.toolName}…` }); tui.requestRender();
      }
    });
  } catch (e) {
    agentError = e instanceof Error ? e.message : String(e);
  }

  function header(width: number): string[] {
    const tab = (name: string, on: boolean) => (on ? magenta(`[ ${name} ]`) : dim(`  ${name}  `));
    const bar = `${magenta("Ξ epistemic")}   ${tab("Chat", view === "chat")}${tab("Monitor", view === "monitor")}   ${dim("tab swap · ←→ in view · ^C quit")}`;
    return [bar, dim("─".repeat(Math.min(width, 100)))];
  }

  function renderChatBody(width: number): string[] {
    const out: string[] = [];
    for (const m of messages.slice(-40)) {
      const label = m.role === "you" ? cyan("you") : m.role === "agent" ? green("agent") : dim("Ξ");
      out.push(label);
      for (const line of wrapTextWithAnsi(m.text || (busy && m.role === "agent" ? "…" : ""), width)) out.push("  " + line);
      out.push("");
    }
    if (busy) out.push(dim("  …thinking"));
    out.push(dim("─".repeat(Math.min(width, 100))));
    out.push(`${cyan("›")} ${draft}${dim("▋")}`);
    return out;
  }

  const root = {
    render(width: number): string[] {
      const lines = header(width);
      if (view === "chat") lines.push(...renderChatBody(width));
      else lines.push(...renderMonitor(fleet, monMode, monIdx));
      return lines;
    },
    invalidate(): void {},
  };
  tui.addChild(root);

  async function submit() {
    const text = draft.trim();
    draft = "";
    if (!text) return;
    messages.push({ role: "you", text });
    messages.push({ role: "agent", text: "" });
    tui.requestRender();
    if (!session) {
      const last = messages[messages.length - 1];
      last.text = `agent unavailable (${agentError || "no session"})`;
      tui.requestRender();
      return;
    }
    busy = true; tui.requestRender();
    try { await session.prompt(text); } catch (e) { messages.push({ role: "system", text: `error: ${e}` }); }
    busy = false; tui.requestRender();
  }

  function monitorKey(data: string) {
    const res = reduceNav({ mode: monMode, idx: monIdx }, parseKey(data), fleet.entries.length);
    if (!res.handled) return;
    monMode = res.state.mode; monIdx = res.state.idx;
    if (res.openAction) {
      // Enter opens the selected hypothesis in chat (a scoped discussion). The
      // full approve/reject/modify menu is a follow-up; for now it discusses it.
      const entry = fleet.entries[monIdx];
      if (entry) {
        const prompt = actionPrompt("chat", entry);
        messages.push({ role: "you", text: prompt }, { role: "agent", text: "" });
        view = "chat";
        if (session) { busy = true; void session.prompt(prompt).finally(() => { busy = false; tui.requestRender(); }); }
      }
    }
    tui.requestRender();
    void actions;
  }

  function chatKey(data: string) {
    if (data === "\r" || data === "\n") { void submit(); return; }
    if (data === "\x7f" || data === "\b") { draft = draft.slice(0, -1); tui.requestRender(); return; }
    if (data >= " " && !data.startsWith("\x1b")) { draft += data; tui.requestRender(); }
  }

  tui.addInputListener((data: string) => {
    if (data === "\x03") { tui.stop(); session?.dispose?.(); process.exit(0); } // ctrl+c
    if (data === "\t") { view = view === "chat" ? "monitor" : "chat"; tui.requestRender(); return; }
    if (view === "monitor") monitorKey(data);
    else chatKey(data);
  });

  // Live monitor refresh.
  const timer = setInterval(async () => { fleet = await loadFleet(cwd); if (view === "monitor") tui.requestRender(); }, 1500);

  tui.start();
  tui.requestRender();
  await new Promise<void>(() => { void timer; }); // run until ctrl+c exits the process
}
