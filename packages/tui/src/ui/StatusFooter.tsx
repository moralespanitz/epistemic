import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.js";
import { costBar } from "../primitives/cost-bar.js";

/** Thin bottom status line: fleet-wide burn, running count, and active view. */
export function StatusFooter({ world, lens }: { world: ResearchWorld; lens: string }) {
  const running = world.runs.filter((r) => r.status === "running").length;
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text dimColor>
        burn ${world.totalSpent.toFixed(2)} / ${world.totalCap}{" "}
        <Text color="yellow">{costBar(world.totalSpent, world.totalCap, 10)}</Text>
      </Text>
      <Text>
        <Text color="cyan">{running} running</Text>
        {"  "}<Text dimColor>view:{lens}</Text>
      </Text>
    </Box>
  );
}
