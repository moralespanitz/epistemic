import { expect, test } from "vitest";
import { AgentBridge, buildPrompt } from "../src/agent-bridge.js";

test("buildPrompt prepends selected-node context when present", () => {
  const p = buildPrompt("why did this diverge?", {
    id: "H-004", claim: "scale to 7B", status: "RUNNING",
  });
  expect(p).toContain("H-004");
  expect(p).toContain("scale to 7B");
  expect(p).toContain("why did this diverge?");
});

test("buildPrompt without context is just the question", () => {
  expect(buildPrompt("hello", undefined)).toBe("hello");
});

test("ask streams stdout chunks and resolves with full text", async () => {
  // Fake agent binary: a node one-liner that prints two chunks.
  const bridge = new AgentBridge("/tmp", {
    bin: "node",
    baseArgs: ["-e", "process.stdout.write('think');process.stdout.write('ing')"],
  });
  const chunks: string[] = [];
  const full = await bridge.ask("q", undefined, (c) => chunks.push(c));
  expect(full).toBe("thinking");
  expect(chunks.join("")).toBe("thinking");
});

test("ask reports unavailable when the bin is missing", async () => {
  const bridge = new AgentBridge("/tmp", { bin: "definitely-not-a-real-bin-xyz", baseArgs: [] });
  const full = await bridge.ask("q", undefined, () => {});
  expect(full).toContain("agent unavailable");
});
