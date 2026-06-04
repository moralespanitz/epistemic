import { readFile } from "node:fs/promises";
import { loadHypotheses, updateHypothesisStatus } from "../state/repo.js";
import { loadFleet } from "../monitor/fleet.js";
import { createWorktree, removeWorktree, worktreePath, writePid, readPid } from "./worktree.js";
import { spawnAgent, killAgent, isAlive, buildLogPath } from "./spawner.js";
import { buildStagePrompt } from "./prompt.js";
import type { HypothesisEntry } from "../state/repo.js";

async function tailLog(logPath: string, n: number): Promise<string[]> {
  try {
    const text = await readFile(logPath, "utf8");
    const lines = text.split("\n").filter(Boolean);
    return lines.slice(-n);
  } catch { return []; }
}

export interface LaneState {
  id: string;
  claim: string;
  status: string;
  stage: string;
  pid: number | null;
  agentAlive: boolean;
  spent: number;
  costCap: number;
  hasPrereg: boolean;
  hasBaseline: boolean;
  hasSmokes: boolean;
  logLines: string[]; // last N lines from fleet.log
}

export interface FleetState {
  lanes: LaneState[];
}

export class FleetController {
  async start(cwd: string): Promise<void> {
    const entries = await loadHypotheses(cwd);
    const active = entries.filter(e => e.status === "OPEN" || e.status === "RUNNING");
    for (const h of active) {
      const pid = await readPid(cwd, h.id);
      if (pid && isAlive(pid)) continue;
      const wt = await createWorktree(cwd, h.id);
      const stage = this._stage(h);
      const prompt = buildStagePrompt(h, wt, stage);
      const logPath = buildLogPath(cwd, h.id);
      const newPid = spawnAgent(wt, prompt, logPath);
      await writePid(cwd, h.id, newPid);
    }
  }

  async reconnect(_cwd: string): Promise<void> {
    // PIDs are read by poll() — nothing extra needed on reconnect
  }

  async kill(cwd: string, id: string): Promise<void> {
    const pid = await readPid(cwd, id);
    if (pid) killAgent(pid);
    await updateHypothesisStatus(cwd, id, "KILLED");
    await removeWorktree(cwd, id);
  }

  async poll(cwd: string): Promise<FleetState> {
    const entries = await loadHypotheses(cwd);
    const active = entries.filter(e => e.status === "OPEN" || e.status === "RUNNING" || e.status === "KILLED");
    if (active.length === 0) return { lanes: [] };

    const fleet = await loadFleet(cwd);
    const lanes: LaneState[] = await Promise.all(active.map(async (h) => {
      const pid = await readPid(cwd, h.id);
      const stat = fleet.stats.find(s => s.id === h.id);
      const logPath = buildLogPath(cwd, h.id);
      const logLines = await tailLog(logPath, 20);
      return {
        id: h.id,
        claim: h.claim,
        status: h.status,
        stage: this._stage(h),
        pid: pid ?? null,
        agentAlive: pid ? isAlive(pid) : false,
        spent: stat?.spent ?? 0,
        costCap: h.costCap,
        hasPrereg: stat?.hasPrereg ?? false,
        hasBaseline: stat?.hasBaseline ?? false,
        hasSmokes: stat?.hasSmokes ?? false,
        logLines,
      };
    }));

    return { lanes };
  }

  private _stage(h: HypothesisEntry): string {
    if (h.status === "CONFIRMED" || h.status === "FALSIFIED") return "verification-before-publication";
    if (h.status === "KILLED") return "kill-or-ship";
    return "experiment-execution";
  }
}
