import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { loadHypotheses, getActiveHypothesis, getJudgeLock, computeJudgeHash } from "../state/repo.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export function registerJudgeLockGate(pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isToolCallEventType("bash", event)) return;
    const cmd = event.input.command ?? "";
    if (!/^(bun|python|pytest|eval|benchmark|run_|train)/i.test(cmd)) return;

    const entries = await loadHypotheses(ctx.cwd);
    const active = getActiveHypothesis(entries);
    if (!active) return;

    const lockedHash = await getJudgeLock(ctx.cwd, active.id);
    if (!lockedHash) return; // no lock yet — prereg gate handles this

    // Try to read current judge config file
    const judgeConfigPath = join(ctx.cwd, "experiments", active.id, "judge-config.json");
    let currentHash: string;
    try {
      const content = await readFile(judgeConfigPath, "utf8");
      const parsed = JSON.parse(content);
      currentHash = computeJudgeHash(JSON.stringify(parsed), active.id);
    } catch {
      return; // no config file — skip
    }

    if (currentHash !== lockedHash) {
      return {
        block: true,
        reason: `Judge config has drifted from locked hash for hypothesis "${active.id}". Reset judge-config.json to match prereg.md or re-run preregistration.`,
      };
    }
  });
}
