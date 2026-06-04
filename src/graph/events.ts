import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../state/repo.js";

export type GraphEventType = "open-hypothesis" | "new-research" | "dismiss-proposal";

export interface GraphEvent {
  type: GraphEventType;
  id?: string;
  timestamp: number;
}

const ALLOWED_TYPES = new Set<GraphEventType>(["open-hypothesis", "new-research", "dismiss-proposal"]);

export interface EventReader {
  read(): Promise<GraphEvent[]>;
}

/** Create a stateful reader that tracks cursor position in-memory. */
export function makeEventReader(cwd: string, serverStartTime: number): EventReader {
  let cursor = 0;
  const eventsPath = join(cwd, ".epistemic/graph-events.jsonl");

  return {
    async read(): Promise<GraphEvent[]> {
      if (!await fileExists(eventsPath)) return [];

      const content = await readFile(eventsPath, "utf8");
      const lines = content.split("\n").filter(Boolean);
      const newLines = lines.slice(cursor);
      cursor = Math.max(cursor, lines.length);

      return newLines
        .map(l => { try { return JSON.parse(l) as GraphEvent; } catch { return null; } })
        .filter((e): e is GraphEvent =>
          e !== null &&
          typeof e === "object" &&
          !Array.isArray(e) &&
          ALLOWED_TYPES.has((e as any).type as GraphEventType) &&
          typeof (e as any).timestamp === "number" &&
          (e as any).timestamp >= serverStartTime
        );
    }
  };
}
