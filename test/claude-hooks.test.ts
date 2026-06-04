import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const HOOK = join(process.cwd(), "hooks", "session-start.mjs");

function runSessionStart(cwd: string) {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd }),
    encoding: "utf8",
  });
}

describe("Claude Code SessionStart hook", () => {
  it("stays silent outside research repos", () => {
    const dir = mkdtempSync(join(tmpdir(), "epistemic-nonresearch-"));
    try {
      const result = runSessionStart(dir);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("injects using-epistemic bootstrap content in research repos", () => {
    const dir = mkdtempSync(join(tmpdir(), "epistemic-research-"));
    try {
      writeFileSync(join(dir, "HYPOTHESES.md"), "# Hypotheses\n");
      const result = runSessionStart(dir);
      assert.equal(result.status, 0);

      const payload = JSON.parse(result.stdout);
      const context = payload.hookSpecificOutput.additionalContext;
      assert.equal(payload.hookSpecificOutput.hookEventName, "SessionStart");
      assert.match(context, /using-epistemic/);
      assert.match(context, /invoke the\s+`epistemic`\s+skill/i);
      assert.match(context, /No experiment-shaped command before/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
