import React from "react";
import { Box, Text } from "ink";
import { matchCommands } from "../slash-commands.js";

const CHAT_HINT = "⏎ on a hypothesis to enter it  ·  type to chat  ·  / for commands  ·  ↑↓ select  ·  ^C quit";

/**
 * The always-present input box at the bottom — the primary way to interact.
 * Plain text is sent to the agent; text starting with "/" is a command. When a
 * slash command is being typed, the hint line shows matching commands.
 */
export function PromptInput({ draft, busy, entered }: { draft: string; busy: boolean; entered?: string }) {
  const isSlash = draft.startsWith("/");
  const matches = isSlash ? matchCommands(draft.split(/\s+/)[0]).slice(0, 8) : [];
  const enteredHint = `in ${entered}  ·  /approve /reject /modify  ·  type to chat  ·  /back`;
  const hint = isSlash
    ? (matches.length ? matches.map((c) => `/${c.name}`).join("  ") : "no matching command — /help")
    : entered
      ? enteredHint
      : CHAT_HINT;
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor={isSlash ? "yellow" : "cyan"} paddingX={1}>
        <Text>
          {busy ? <Text color="yellow">… </Text> : <Text color="cyan">› </Text>}
          {draft}
          <Text inverse> </Text>
        </Text>
      </Box>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
