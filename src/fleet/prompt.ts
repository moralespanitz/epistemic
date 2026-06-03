import type { HypothesisEntry } from "../state/repo.js";

export function buildStagePrompt(
  h: HypothesisEntry,
  worktreePath: string,
  stage: string,
): string {
  return [
    `You are advancing epistemic hypothesis ${h.id}: "${h.claim}"`,
    ``,
    `Working directory: ${worktreePath}`,
    `Current pipeline stage: ${stage}`,
    `Cost cap: $${h.costCap}`,
    `Compute target: ${h.computeTarget}`,
    ``,
    `Use the epistemic skill to advance this hypothesis exactly one stage.`,
    `Read the existing files in experiments/${h.id}/ to understand current state.`,
    `Follow all epistemic gates — do not skip preregistration, judge lock, or baseline gates.`,
    `Write all outputs to the working directory (not the parent repo).`,
    `When done with this stage, stop. Do not advance multiple stages in one run.`,
  ].join("\n");
}
