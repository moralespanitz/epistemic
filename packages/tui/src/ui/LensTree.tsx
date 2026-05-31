import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.js";
import { treeLines } from "../primitives/tree-lines.js";

export function LensTree({ world, selectedId }: { world: ResearchWorld; selectedId?: string }) {
  const lines = treeLines(world.nodes, selectedId);
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">◆ RESEARCH TREE — ↑↓ navigate</Text>
      {lines.map((line, i) => {
        const isSelected = line.includes("▸");
        const isKilled = line.includes("☓");
        return (
          <Text key={i} color={isKilled ? "red" : isSelected ? "cyan" : undefined}>
            {line}
          </Text>
        );
      })}
      {lines.length === 0 && <Text dimColor>no hypotheses yet — press ^K to ask the agent</Text>}
    </Box>
  );
}
