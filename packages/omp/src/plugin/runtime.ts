import type { EpistemicAPI, GateHandler } from "./api.js";

/**
 * Wrap pi's raw any-typed API in the typed EpistemicAPI surface.
 * This is the only place in the codebase that crosses the any-boundary
 * to pi's underlying methods.
 */
export function createEpistemicAPI(pi: any): EpistemicAPI {
  return {
    registerCommand(name, opts) {
      pi.registerCommand?.(name, opts);
    },
    on(event, handler) {
      pi.on(event, handler);
    },
    gate(handler: GateHandler) {
      pi.on("tool_call", handler);
    },
  };
}
