import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { loadHypotheses, getActiveHypothesis, fileExists, updateHypothesisStatus } from "../../../../src/state/repo.js";
import { join } from "node:path";

export function registerPreregGate(pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isToolCallEventType("bash", event)) return;
    const cmd = event.input.command ?? "";
    if (!/^(bun|python|pytest|eval|benchmark|run_|train)/i.test(cmd)) return;

    const entries = await loadHypotheses(ctx.cwd);
    if (entries.length === 0) return;

    const active = getActiveHypothesis(entries);
    if (!active) return;

    const preregPath = join(ctx.cwd, "experiments", active.id, "prereg.md");
    const hasPrereg = await fileExists(preregPath);
    if (!hasPrereg) {
      return { block: true, reason: `Missing prereg.md for hypothesis "${active.id}". Complete pre-registration before launching experiments.` };
    }

    if (active.status === "OPEN") {
      await updateHypothesisStatus(ctx.cwd, active.id, "RUNNING");
    }
  });
}
