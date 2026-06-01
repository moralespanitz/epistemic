import { spawn } from "node:child_process";

const HEADER_TOKENS = new Set(["canonical", "selected", "variants", "context", "max-out"]);

/**
 * Parse `omp --list-models` output into the list of canonical model ids
 * (the first column — the value `--model` accepts).
 */
export function parseModels(text: string): string[] {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (/models$/i.test(line.trim())) continue; // section titles like "Canonical models"
    const m = line.match(/^(\S+)\s+\S/); // first token followed by another column
    const id = m?.[1];
    if (!id || HEADER_TOKENS.has(id.toLowerCase())) continue;
    if (seen.has(id)) continue; // dedupe — the catalog repeats some ids across sections
    seen.add(id);
    models.push(id);
  }
  return models;
}

/**
 * Load available model ids by running `omp --list-models`. Resolves to an empty
 * list if omp is unavailable, so the picker degrades gracefully.
 */
export function listModels(query = "", bin = "omp"): Promise<string[]> {
  return new Promise((resolve) => {
    let out = "";
    let resolved = false;
    const done = (v: string[]) => { if (!resolved) { resolved = true; resolve(v); } };

    let proc;
    try {
      proc = spawn(bin, ["--list-models", query], {});
    } catch {
      done([]);
      return;
    }
    proc.on("error", () => done([]));
    proc.stdout?.on("data", (c: Buffer) => { out += c.toString(); });
    proc.on("close", () => done(parseModels(out)));
  });
}
