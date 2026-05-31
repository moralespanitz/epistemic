import React from "react";
import { Box, Text, useInput } from "ink";

export interface CommandBarProps {
  visible: boolean;
  draft: string;
  answer: string;
  busy: boolean;
  onChange: (next: string) => void;
  onSubmit: () => void;
}

export function CommandBar({ visible, draft, answer, busy, onChange, onSubmit }: CommandBarProps) {
  useInput(
    (input, key) => {
      if (!visible) return;
      if (key.return) { onSubmit(); return; }
      if (key.backspace || key.delete) { onChange(draft.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) onChange(draft + input);
    },
    { isActive: visible },
  );

  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={1}>
      <Text color="cyan">⌨  ask the agent (enter to send, esc to close)</Text>
      <Text>› {draft}</Text>
      {busy && <Text color="yellow">thinking…</Text>}
      {answer.length > 0 && <Text dimColor>{answer}</Text>}
    </Box>
  );
}
