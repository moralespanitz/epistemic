import React, { useEffect, useState } from "react";
import { Text } from "ink";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Animated "working" indicator with elapsed seconds, so slow turns look alive. */
export function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const spin = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    const clock = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { clearInterval(spin); clearInterval(clock); };
  }, []);

  return (
    <Text color="yellow">
      {FRAMES[frame]} {label}{secs > 0 ? ` (${secs}s)` : ""}
    </Text>
  );
}
