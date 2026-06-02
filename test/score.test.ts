import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, levelForXp, xpToNextLevel } from "../src/research/score.js";
import type { Fleet } from "../src/monitor/fleet.js";

function fleet(p: Partial<Fleet>): Fleet {
  return {
    entries: [], hypothesesContent: "", stats: [],
    totalSpent: 0, totalCap: 0, running: 0, shipped: 0, killed: 0, ...p,
  };
}

test("XP rewards ships, kills, and running experiments", () => {
  const sc = computeScore(fleet({ shipped: 2, killed: 3, running: 1 }));
  assert.equal(sc.xp, 2 * 100 + 3 * 40 + 1 * 15); // 335
});

test("level grows monotonically with XP and starts at 1", () => {
  assert.equal(levelForXp(0), 1);
  assert.ok(levelForXp(1000) > levelForXp(100));
  assert.ok(levelForXp(100) >= levelForXp(0));
});

test("rank is named and bounded", () => {
  assert.equal(computeScore(fleet({})).rank, "Novice");
  assert.equal(typeof computeScore(fleet({ shipped: 50, killed: 200 })).rank, "string");
});

test("discipline reflects the kill:ship ratio (killing fast is rewarded)", () => {
  assert.equal(computeScore(fleet({ shipped: 1, killed: 5 })).discipline, "ruthless");
  assert.equal(computeScore(fleet({ shipped: 1, killed: 3 })).discipline, "disciplined");
  assert.equal(computeScore(fleet({ shipped: 2, killed: 1 })).discipline, "trigger-shy");
  assert.equal(computeScore(fleet({})).discipline, "warming up");
});

test("badges unlock from milestones", () => {
  assert.deepEqual(computeScore(fleet({})).badges, []);
  const sc = computeScore(fleet({ shipped: 1, killed: 5, running: 1 }));
  assert.ok(sc.badges.includes("🏆")); // first ship
  assert.ok(sc.badges.includes("🔪")); // serial killer
  assert.ok(sc.badges.includes("🎯")); // disciplined (ks=5≥3)
  assert.ok(sc.badges.includes("🚀")); // experiments in flight
});

test("xpToNextLevel is non-negative and reaches zero only past a boundary", () => {
  assert.ok(xpToNextLevel(0) >= 0);
  assert.ok(xpToNextLevel(10_000) >= 0);
});
