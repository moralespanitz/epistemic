import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import {
  loadHypotheses, getAllHypothesisSpends, loadLessons,
} from "./epistemic-state.js";
import { buildWorld } from "./model/build-world.js";
import type { ResearchWorld, RunStatus, TelemetryPoint, WorldInputs } from "./model/types.js";

async function safeRead(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch { return null; }
}

async function listDir(path: string): Promise<string[]> {
  try { return await readdir(path); } catch { return []; }
}

export class StateStore {
  private watcher: FSWatcher | null = null;
  private lastGood: ResearchWorld | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private cwd: string) {}

  async read(): Promise<ResearchWorld> {
    try {
      const entries = await loadHypotheses(this.cwd);
      const spends = await getAllHypothesisSpends(this.cwd);
      const lessons = await loadLessons(this.cwd);
      const hypothesesContent = (await safeRead(join(this.cwd, "HYPOTHESES.md"))) ?? "";

      const telemetry: Record<string, TelemetryPoint[]> = {};
      const runStatus: Record<string, { status: RunStatus; exit?: number }> = {};
      const alternatives: Record<string, string[]> = {};

      for (const e of entries) {
        const smokes = join(this.cwd, "experiments", e.id, "smokes");
        const tel = await safeRead(join(smokes, "telemetry.jsonl"));
        if (tel) {
          telemetry[e.id] = tel
            .split("\n")
            .filter(Boolean)
            .map((l) => { try { return JSON.parse(l) as TelemetryPoint; } catch { return null; } })
            .filter((p): p is TelemetryPoint => p !== null);
        }
        const rs = await safeRead(join(smokes, "run-status.json"));
        if (rs) { try { runStatus[e.id] = JSON.parse(rs); } catch { /* ignore */ } }
        alternatives[e.id] = await listDir(join(this.cwd, "experiments", e.id, "alternatives"));
      }

      const inputs: WorldInputs = {
        hypothesesContent, spends, lessons, telemetry, runStatus, alternatives,
      };
      this.lastGood = buildWorld(entries, inputs);
      return this.lastGood;
    } catch {
      if (this.lastGood) return this.lastGood;
      return { nodes: [], runs: [], lessons: [], totalSpent: 0, totalCap: 0 };
    }
  }

  async watch(onChange: (world: ResearchWorld) => void): Promise<void> {
    onChange(await this.read());
    this.watcher = chokidar.watch(
      [
        join(this.cwd, "HYPOTHESES.md"),
        join(this.cwd, "RESULTS.md"),
        join(this.cwd, "BASELINES.md"),
        join(this.cwd, ".epistemic"),
        join(this.cwd, "experiments"),
      ],
      { ignoreInitial: true },
    );
    const debounced = () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(async () => onChange(await this.read()), 150);
    };
    this.watcher.on("all", debounced);
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.watcher?.close();
  }
}
