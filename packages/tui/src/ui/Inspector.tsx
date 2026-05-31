import React from "react";
import { Box, Text } from "ink";
import type { HypothesisNode } from "../model/types.js";
import { costBar } from "../primitives/cost-bar.js";

export function Inspector({ node }: { node: HypothesisNode | undefined }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} width={32}>
      <Text color="magenta" bold>INSPECTOR</Text>
      {!node ? (
        <Text dimColor>nothing selected</Text>
      ) : (
        <>
          <Text color="cyan">{node.id}</Text>
          <Text>{node.claim.slice(0, 60)}</Text>
          <Text dimColor>status {node.status}</Text>
          <Text dimColor>target {node.computeTarget}</Text>
          <Text color="green">{costBar(node.spent, node.costCap, 8)}</Text>
          {node.alternativeIds.length > 0 && (
            <Text dimColor>alts: {node.alternativeIds.join(", ")}</Text>
          )}
          {node.killReason && <Text color="red">killed: {node.killReason}</Text>}
        </>
      )}
    </Box>
  );
}
