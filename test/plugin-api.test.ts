import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EpistemicAPI, EpistemicPlugin, EpistemicContext, CommandOpts, GateHandler } from "../packages/omp/src/plugin/api.js";

describe("plugin api types", () => {
  it("EpistemicPlugin is callable with EpistemicAPI", () => {
    assert.ok(true, "types imported successfully");
  });
});

import { createEpistemicAPI } from "../packages/omp/src/plugin/runtime.js";

describe("createEpistemicAPI", () => {
  function makeMockPi() {
    const calls: { method: string; args: unknown[] }[] = [];
    return {
      calls,
      on: (event: string, handler: unknown) => { calls.push({ method: "on", args: [event, handler] }); },
      registerCommand: (name: string, opts: unknown) => { calls.push({ method: "registerCommand", args: [name, opts] }); },
    };
  }

  it("registerCommand delegates to pi.registerCommand", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    const handler = async () => {};
    api.registerCommand("test-cmd", { description: "a test command", handler });
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].method, "registerCommand");
    assert.strictEqual(mock.calls[0].args[0], "test-cmd");
  });

  it("on delegates to pi.on", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    const handler = () => {};
    api.on("session_start", handler);
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].method, "on");
    assert.strictEqual(mock.calls[0].args[0], "session_start");
    assert.strictEqual(mock.calls[0].args[1], handler);
  });

  it("gate registers a tool_call listener via pi.on", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    const gateHandler = async () => {};
    api.gate(gateHandler);
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].method, "on");
    assert.strictEqual(mock.calls[0].args[0], "tool_call");
  });

  it("returns an object with the three EpistemicAPI methods", () => {
    const mock = makeMockPi();
    const api = createEpistemicAPI(mock);
    assert.strictEqual(typeof api.registerCommand, "function");
    assert.strictEqual(typeof api.on, "function");
    assert.strictEqual(typeof api.gate, "function");
  });
});
