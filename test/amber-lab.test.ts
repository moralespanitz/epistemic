import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AMBER_LAB } from "../packages/omp/src/theme/amber-lab.js";

describe("AMBER_LAB", () => {
  it("has all required color tokens", () => {
    const required = ["bg", "bgPanel", "border", "primary", "text", "dim", "green", "red", "yellow", "cyan"];
    for (const key of required) {
      assert.ok(key in AMBER_LAB, `missing token: ${key}`);
      assert.match((AMBER_LAB as any)[key], /^#[0-9a-fA-F]{6}$/, `${key} must be a 6-digit hex color`);
    }
  });

  it("primary is amber (warm hue)", () => {
    assert.strictEqual(AMBER_LAB.primary, "#f59e0b");
  });

  it("bg is near-black dark amber", () => {
    assert.strictEqual(AMBER_LAB.bg, "#0f0a00");
  });
});
