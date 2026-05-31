import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld, RunStatus } from "../model/types.js";
import { sparkline } from "../primitives/sparkline.js";
import { costBar } from "../primitives/cost-bar.js";

const BORDER: Record<RunStatus, string> = {
  pending: "gray", running: "blue", done: "green", failed: "red", killed: "red",
};

export function LensMissions({ world, selectedId }: { world: ResearchWorld; selectedId?: string }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">▮ MISSION CONTROL — {world.runs.filter((r) => r.status === "running").length} live</Text>
      <Box flexWrap="wrap">
        {world.runs.map((r) => (
          <Box
            key={r.id}
            flexDirection="column"
            borderStyle="round"
            borderColor={r.id === selectedId ? "white" : BORDER[r.status]}
            paddingX={1}
            width={28}
            marginRight={1}
          >
            <Text color="cyan">{r.id} <Text dimColor>{r.status}</Text></Text>
            <Text dimColor>trial {r.trialsDone}/{r.trialsTotal}</Text>
            <Text color="green">cost {sparkline(r.costSeries)} ${r.spent.toFixed(1)}</Text>
            <Text color="yellow">acc  {sparkline(r.accSeries)}</Text>
            <Text>{costBar(r.spent, r.costCap, 8)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
