import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../model/types.js";

const ROLE_LABEL: Record<ChatMessage["role"], string> = {
  user: "you", assistant: "agent", system: "Ξ",
};
const ROLE_COLOR: Record<ChatMessage["role"], string> = {
  user: "cyan", assistant: "green", system: "yellow",
};

/** The default conversational view — shows the running dialogue with the agent. */
export function ChatView({ messages, busy }: { messages: ChatMessage[]; busy: boolean }) {
  const recent = messages.slice(-14);
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color="yellow">✦ CONVERSATION</Text>
      {recent.length === 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Ask anything about your research, or run a command.</Text>
          <Text dimColor>Type <Text color="cyan">/help</Text> to see what you can do.</Text>
        </Box>
      )}
      {recent.map((m, i) => (
        <Box key={m.id ?? i} flexDirection="column" marginTop={1}>
          <Text bold color={ROLE_COLOR[m.role]}>{ROLE_LABEL[m.role]}</Text>
          <Text>{m.text || (m.role === "assistant" && busy ? "…" : "")}</Text>
        </Box>
      ))}
      {busy && <Text color="yellow">  agent thinking…</Text>}
    </Box>
  );
}
