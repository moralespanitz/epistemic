import { expect, test } from "vitest";
import { AgentSessionBridge, type AgentSessionLike } from "../src/agent-session.js";

/** A fake session that emits text deltas + a tool event when prompted. */
function fakeSession(): AgentSessionLike {
  const listeners: ((e: any) => void)[] = [];
  return {
    subscribe(l) { listeners.push(l); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
    async prompt() {
      for (const l of listeners) {
        l({ type: "tool_execution_start", toolName: "bash", toolCallId: "1", args: {} });
        l({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hello" } });
        l({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: " world" } });
      }
    },
    dispose() {},
  };
}

test("ask streams text deltas and resolves with the full text", async () => {
  const bridge = new AgentSessionBridge({ createSession: async () => ({ session: fakeSession() }) });
  const chunks: string[] = [];
  const full = await bridge.ask("hi", undefined, (c) => chunks.push(c));
  expect(full).toBe("Hello world");
  expect(chunks.join("")).toContain("Hello world");
});

test("ask surfaces tool activity to the stream", async () => {
  const bridge = new AgentSessionBridge({ createSession: async () => ({ session: fakeSession() }) });
  const chunks: string[] = [];
  await bridge.ask("hi", undefined, (c) => chunks.push(c));
  expect(chunks.join("")).toContain("⚙ bash");
});

test("ask reports unavailable when session creation fails", async () => {
  const bridge = new AgentSessionBridge({
    createSession: async () => { throw new Error("no auth"); },
  });
  const full = await bridge.ask("hi", undefined, () => {});
  expect(full).toContain("agent unavailable");
  expect(full).toContain("no auth");
});

test("setModel disposes the current session so the next turn rebuilds", async () => {
  let created = 0;
  const bridge = new AgentSessionBridge({
    createSession: async () => { created++; return { session: fakeSession() }; },
  });
  await bridge.ask("a", undefined, () => {});
  expect(created).toBe(1);
  bridge.setModel("claude-opus-4-8");
  await bridge.ask("b", undefined, () => {});
  expect(created).toBe(2); // rebuilt with the new model
});
