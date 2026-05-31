import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.js";
import { costBar } from "../primitives/cost-bar.js";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "gray", RUNNING: "blue", FALSIFIED: "red", CONFIRMED: "green", KILLED: "red",
};

/** Top bar: brand + the hypothesis currently in focus and its burn. */
export function Header({ world }: { world: ResearchWorld }) {
  const active = world.nodes.find((n) => n.status === "RUNNING") ?? world.nodes[0];
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text bold color="magenta">Ξ epistemic</Text>
      {active ? (
        <Text>
          {active.id} <Text color={STATUS_COLOR[active.status] ?? "white"}>{active.status}</Text>
          {"  "}<Text color="green">{costBar(active.spent, active.costCap, 8)}</Text>
        </Text>
      ) : (
        <Text dimColor>no active hypothesis — describe your research idea below</Text>
      )}
    </Box>
  );
}
