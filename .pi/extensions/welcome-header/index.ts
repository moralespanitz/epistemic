/**
 * Welcome Header Extension for epistemic.
 *
 * Replaces the default pi header with a 3D Ξ mark (the same software renderer
 * used by the startup intro — Z-buffered rasterizer, Lambert shading, depth-
 * modulated amber true-color glow) plus model name, provider, and research tips.
 *
 * The mark is rendered at a fixed "hero" angle: slightly rotated on Y and
 * tilted on X so both the front face and the top edge are visible — giving
 * the 3D depth without animation overhead.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { render3D } from "../../src/tui/render3d.js";

// Hero angle: ~15° Y-rotation (shows right side), ~12° X-tilt (shows top edge).
const HERO_AY = 0.27;
const HERO_AX = 0.21;
const MARK_H  = 9;   // character rows for the Ξ mark

// Amber palette (24-bit ANSI, matches the theme)
const A  = "\x1b[0m";
const am = (s: string) => `\x1b[38;2;251;191;36m${s}${A}`;   // amber #fbbf24
const ab = (s: string) => `\x1b[1;38;2;252;211;77m${s}${A}`; // bright amber #fcd34d
const dm = (s: string) => `\x1b[38;2;120;90;40m${s}${A}`;    // dim bronze
const wh = (s: string) => `\x1b[1;97m${s}${A}`;              // white bold
const cy = (s: string) => `\x1b[38;2;253;230;138m${s}${A}`;  // soft gold

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui, _theme) => {
      let cachedWidth = -1;
      let cachedLines: string[] = [];

      return {
        render(width: number): string[] {
          // Re-render only when width changes (the mark is CPU-intensive).
          if (width === cachedWidth) return cachedLines;
          cachedWidth = width;

          const gw = Math.min(38, Math.max(20, width - 4));
          const markLines = render3D(HERO_AY, HERO_AX, gw, MARK_H);

          // Center the mark in the available width.
          const pad = Math.max(0, Math.floor((width - gw) / 2));
          const indent = " ".repeat(pad);
          const centeredMark = markLines.map((l) => indent + l);

          // Info lines below the mark.
          const modelId  = ctx.model?.id ?? "no model";
          const provider = ctx.model?.provider ?? "";
          const cwd      = process.cwd().replace(process.env.HOME ?? "", "~");

          // Split modelId nicely: "openai-codex/gpt-5.5" → "gpt-5.5  openai-codex"
          const [prov2, mod2] = modelId.includes("/")
            ? modelId.split("/").reverse()
            : [provider, modelId];

          const sep       = am("─".repeat(Math.min(width, 40)));
          const modelLine = `  ${ab(mod2 || modelId)}  ${dm(prov2 || provider)}`;
          const cwdLine   = `  ${dm(cwd)}`;

          const tips = [
            `  ${am("/")} commands  ${am("?")} keybindings  ${am("!")} bash  ${am("$")} python`,
            `  ${cy("/skill:epistemic")} ${dm("→ start research session")}`,
            `  ${cy("/skill:huggingface-papers")} ${dm("→ read arXiv papers")}`,
            `  ${cy("/monitor")} ${dm("→ experiment dashboard")}`,
          ];

          cachedLines = [
            "",
            ...centeredMark,
            "",
            `  ${wh("Ξ epistemic")}`,
            modelLine,
            cwdLine,
            "",
            sep,
            ...tips,
            sep,
            "",
          ];
          return cachedLines;
        },
        invalidate() { cachedWidth = -1; },
      };
    });
  });

  // /reset-header restores the default pi header (useful for debugging).
  pi.registerCommand("reset-header", {
    description: "Restore the default pi header",
    handler: async (_args, ctx) => {
      ctx.ui.setHeader(undefined);
      ctx.ui.notify("Default header restored", "info");
    },
  });
}
