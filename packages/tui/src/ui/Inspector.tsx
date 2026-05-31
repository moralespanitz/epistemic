import React from "react";
import { Box, Text } from "ink";
import type { HypothesisNode, ResearchWorld } from "../model/types.js";
import { costBar } from "../primitives/cost-bar.js";

export function Inspector({ node, world }: { node: HypothesisNode | undefined; world?: ResearchWorld }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} width={34}>
      <Text color="magenta" bold>INSPECTOR</Text>
      {!node ? (
        <Text dimColor>nothing selected</Text>
      ) : (
        <>
          <Text color="cyan">{node.id} <Text dimColor>{node.status}</Text></Text>
          <Text>{node.claim.slice(0, 64)}</Text>
          <Text dimColor>target {node.computeTarget}</Text>
          <Text color="green">{costBar(node.spent, node.costCap, 8)}</Text>

          {node.parentId && <Text dimColor>↑ parent: {node.parentId}</Text>}
          {node.childIds.length > 0 && (
            <Text dimColor>↓ children: {node.childIds.join(", ")}</Text>
          )}

          {node.conditionalPlan && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">DECISION</Text>
              <Text>if {node.conditionalPlan.condition}</Text>
              <Text color="green">  → {node.conditionalPlan.ifTrue}</Text>
              <Text color="red">  else → {node.conditionalPlan.ifFalse}</Text>
            </Box>
          )}

          {node.alternativeIds.length > 0 && (
            <Text dimColor>alts: {node.alternativeIds.join(", ")}</Text>
          )}
          {node.killReason && <Text color="red">killed: {node.killReason}</Text>}
        </>
      )}
    </Box>
  );
}
