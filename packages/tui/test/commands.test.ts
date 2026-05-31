import { expect, test, vi } from "vitest";
import { buildCommands } from "../src/commands.js";

function deps() {
  return {
    runner: { spawn: vi.fn().mockResolvedValue(undefined), kill: vi.fn() },
    selectedNode: () => ({ id: "H-004", computeTarget: "local" as const, claim: "c", status: "RUNNING" as const }),
    setLens: vi.fn(),
    openCommandBar: vi.fn(),
  };
}

test("registry exposes spawn/kill/switch-lens/summon-agent verbs", () => {
  const cmds = buildCommands(deps() as never);
  const ids = cmds.map((c) => c.id);
  expect(ids).toEqual(
    expect.arrayContaining(["spawn", "kill", "lens-tree", "lens-missions", "lens-focus", "summon-agent"]),
  );
});

test("spawn invokes runner.spawn with the selected node's id and target", async () => {
  const d = deps();
  const cmds = buildCommands(d as never);
  await cmds.find((c) => c.id === "spawn")!.run();
  expect(d.runner.spawn).toHaveBeenCalledWith("H-004", "local");
});

test("kill invokes runner.kill with the selected node id", async () => {
  const d = deps();
  const cmds = buildCommands(d as never);
  await cmds.find((c) => c.id === "kill")!.run();
  expect(d.runner.kill).toHaveBeenCalledWith("H-004");
});

test("lens-missions sets the missions lens", async () => {
  const d = deps();
  const cmds = buildCommands(d as never);
  await cmds.find((c) => c.id === "lens-missions")!.run();
  expect(d.setLens).toHaveBeenCalledWith("missions");
});
