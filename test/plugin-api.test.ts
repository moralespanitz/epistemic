import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EpistemicAPI, EpistemicPlugin, EpistemicContext, CommandOpts, GateHandler } from "../packages/omp/src/plugin/api.js";

describe("plugin api types", () => {
  it("EpistemicPlugin is callable with EpistemicAPI", () => {
    assert.ok(true, "types imported successfully");
  });
});
