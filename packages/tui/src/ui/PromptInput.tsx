import React from "react";
import { Box, Text } from "ink";

const CHAT_HINT = "enter send  ·  / for commands  ·  ↑↓ select hypothesis  ·  ^C quit";
const SLASH_HINT = "/chat  /tree  /missions  /focus  /spawn  /kill  /review  /help  /quit";

/**
 * The always-present input box at the bottom — the primary way to interact.
 * Plain text is sent to the agent; text starting with "/" is a command.
 */
export function PromptInput({ draft, busy }: { draft: string; busy: boolean }) {
  const isSlash = draft.startsWith("/");
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor={isSlash ? "yellow" : "cyan"} paddingX={1}>
        <Text>
          {busy ? <Text color="yellow">… </Text> : <Text color="cyan">› </Text>}
          {draft}
          <Text inverse> </Text>
        </Text>
      </Box>
      <Text dimColor>{isSlash ? SLASH_HINT : CHAT_HINT}</Text>
    </Box>
  );
}
