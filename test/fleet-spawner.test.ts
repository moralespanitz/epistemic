import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.NO_COLOR = "1";

const { isAlive, buildLogPath } = await import("../src/fleet/spawner.js");

describe("spawner", () => {
  it("isAlive returns true for the current process", () => {
    assert.ok(isAlive(process.pid));
  });

  it("isAlive returns false for a clearly dead pid", () => {
    assert.ok(!isAlive(999999999));
  });

  it("buildLogPath returns .worktrees/<id>/fleet.log", () => {
    assert.strictEqual(buildLogPath("/repo", "H-001"), "/repo/.worktrees/H-001/fleet.log");
  });
});
