import React from "react";
import { Box, Text } from "ink";
import type { LensName } from "../model/types.js";

export const VIEWS: { name: LensName; label: string }[] = [
  { name: "chat", label: "Chat" },
  { name: "tree", label: "Tree" },
  { name: "missions", label: "Missions" },
  { name: "focus", label: "Focus" },
];

/** Game-style view switcher. ←/→ moves between full-screen views. */
export function TabBar({ active, entered }: { active: LensName; entered?: string }) {
  return (
    <Box paddingX={1}>
      {VIEWS.map((v, i) => {
        const on = !entered && v.name === active;
        return (
          <Text key={v.name}>
            {i > 0 ? " " : ""}
            <Text
              color={on ? "black" : "gray"}
              backgroundColor={on ? "cyan" : undefined}
              bold={on}
            >
              {" "}{v.label}{" "}
            </Text>
          </Text>
        );
      })}
      <Text dimColor>{entered ? `   ▸ ${entered}` : "   ← → switch view"}</Text>
    </Box>
  );
}
