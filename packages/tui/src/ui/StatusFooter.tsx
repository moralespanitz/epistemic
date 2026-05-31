import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.js";
import { costBar } from "../primitives/cost-bar.js";

export function StatusFooter({ world, lens }: { world: ResearchWorld; lens: string }) {
  const running = world.runs.filter((r) => r.status === "running").length;
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Text>
        burn ${world.totalSpent.toFixed(2)} / ${world.totalCap}{" "}
        <Text color="yellow">{costBar(world.totalSpent, world.totalCap, 10)}</Text>
      </Text>
      <Text>
        <Text color="cyan">{running} running</Text>
        {"  "}lens:{lens}{"  "}
        <Text dimColor>[1]tree [2]missions [3]focus  ^K ask  q quit</Text>
      </Text>
    </Box>
  );
}
