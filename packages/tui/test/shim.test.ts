import { expect, test } from "vitest";
import { loadHypotheses } from "../src/epistemic-state.js";

test("shim re-exports loadHypotheses as a function", () => {
  expect(typeof loadHypotheses).toBe("function");
});

test("loadHypotheses on an empty dir returns []", async () => {
  const result = await loadHypotheses("/nonexistent-dir-xyz");
  expect(result).toEqual([]);
});
