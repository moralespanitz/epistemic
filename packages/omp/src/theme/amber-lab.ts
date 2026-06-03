export const AMBER_LAB = {
  bg:      "#0f0a00",
  bgPanel: "#1a0f00",
  border:  "#2a1a00",
  primary: "#f59e0b",
  text:    "#fbbf24",
  dim:     "#78492a",
  green:   "#34d399",
  red:     "#ef4444",
  yellow:  "#fcd34d",
  cyan:    "#fde68a",
} as const;

export type AmberLabToken = keyof typeof AMBER_LAB;
