import React from "react";
import { Box, Text } from "ink";

export interface ModelPickerProps {
  items: string[]; // filtered list
  query: string;
  index: number;
  loading: boolean;
  current?: string;
}

const WINDOW = 12;

/** Interactive model selector — mirrors pi.dev's /model picker. */
export function ModelPicker({ items, query, index, loading, current }: ModelPickerProps) {
  // Keep the highlighted row inside a scrolling window.
  const start = Math.max(0, Math.min(index - Math.floor(WINDOW / 2), Math.max(0, items.length - WINDOW)));
  const visible = items.slice(start, start + WINDOW);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={1} flexGrow={1}>
      <Text color="cyan" bold>SELECT MODEL</Text>
      <Text dimColor>type to filter · ↑↓ choose · enter set · esc cancel{current ? `  ·  current: ${current}` : ""}</Text>
      <Text>filter: <Text color="yellow">{query}</Text><Text inverse> </Text></Text>
      {loading && <Text color="yellow">loading models…</Text>}
      {!loading && items.length === 0 && <Text dimColor>no models match</Text>}
      {visible.map((m, i) => {
        const selected = start + i === index;
        return (
          <Text key={m} color={selected ? "black" : undefined} backgroundColor={selected ? "cyan" : undefined}>
            {selected ? "▸ " : "  "}{m}
          </Text>
        );
      })}
      {items.length > visible.length && (
        <Text dimColor>  …{items.length - visible.length} more (keep typing to narrow)</Text>
      )}
    </Box>
  );
}
