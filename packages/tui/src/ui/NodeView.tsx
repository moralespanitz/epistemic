import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage, HypothesisNode } from "../model/types.js";
import { costBar } from "../primitives/cost-bar.js";
import { ChatView } from "./ChatView.js";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "gray", RUNNING: "blue", FALSIFIED: "red", CONFIRMED: "green", KILLED: "red",
};

/**
 * The drill-in workspace for a single hypothesis: its details, an action bar
 * (approve / reject / modify), and a conversation thread scoped to it.
 */
export function NodeView({ node, messages, busy }: { node: HypothesisNode; messages: ChatMessage[]; busy: boolean }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text>
        <Text color="magenta" bold>◆ {node.id}</Text>{" "}
        <Text color={STATUS_COLOR[node.status] ?? "white"}>{node.status}</Text>
      </Text>
      <Text>{node.claim}</Text>
      <Text dimColor>
        target {node.computeTarget}   <Text color="green">{costBar(node.spent, node.costCap, 10)}</Text>
      </Text>
      {node.conditionalPlan && (
        <Text color="yellow">
          decision: if {node.conditionalPlan.condition} → {node.conditionalPlan.ifTrue} · else → {node.conditionalPlan.ifFalse}
        </Text>
      )}
      {node.childIds.length > 0 && <Text dimColor>children: {node.childIds.join(", ")}</Text>}
      {node.alternativeIds.length > 0 && <Text dimColor>alternatives: {node.alternativeIds.join(", ")}</Text>}
      {node.killReason && <Text color="red">killed: {node.killReason}</Text>}

      <Box marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text>
          <Text color="green">/approve</Text>   <Text color="red">/reject</Text>   <Text color="yellow">/modify</Text>
          {"   "}<Text dimColor>· type to chat about this hypothesis · /back</Text>
        </Text>
      </Box>

      <ChatView messages={messages} busy={busy} />
    </Box>
  );
}
