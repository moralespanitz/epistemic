import React from "react";
import { Box, Text } from "ink";
import type { ResearchWorld } from "../model/types.js";
import { sparkline } from "../primitives/sparkline.js";
import { costBar } from "../primitives/cost-bar.js";

export function LensFocus({ world, selectedId }: { world: ResearchWorld; selectedId?: string }) {
  const run = world.runs.find((r) => r.id === selectedId);
  const node = world.nodes.find((n) => n.id === selectedId);
  if (!run || !node) {
    return (
      <Box flexGrow={1}>
        <Text dimColor>select a hypothesis to focus on it</Text>
      </Box>
    );
  }
  const lastAcc = run.accSeries[run.accSeries.length - 1];
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">⊙ FOCUS — {run.id} <Text dimColor>{node.status}</Text></Text>
      <Text>{node.claim}</Text>
      <Text dimColor>status {run.status} · target {node.computeTarget}</Text>
      <Text>trials {run.trialsDone}/{run.trialsTotal}</Text>
      <Text color="green">cost {sparkline(run.costSeries)} {costBar(run.spent, run.costCap, 10)}</Text>
      <Text color="yellow">acc  {sparkline(run.accSeries)} {lastAcc !== undefined ? lastAcc.toFixed(2) : "—"}</Text>
      {node.conditionalPlan && (
        <Text color="yellow">
          decision: if {node.conditionalPlan.condition} → {node.conditionalPlan.ifTrue} · else → {node.conditionalPlan.ifFalse}
        </Text>
      )}
      {node.childIds.length > 0 && <Text dimColor>children: {node.childIds.join(", ")}</Text>}
      {node.alternativeIds.length > 0 && <Text dimColor>alternatives: {node.alternativeIds.join(", ")}</Text>}
      {node.killReason && <Text color="red">killed: {node.killReason}</Text>}
      <Box marginTop={1}><Text dimColor>⏎ enter this hypothesis · /approve /reject /modify</Text></Box>
    </Box>
  );
}
