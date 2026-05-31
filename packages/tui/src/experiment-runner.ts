import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { ComputeTarget } from "./model/types.js";

interface LiveRun {
  proc: ChildProcess;
  killed: boolean;
  done: Promise<void>;
}

/** Build the launch argv for a given compute target. */
export function commandFor(cwd: string, id: string, target: ComputeTarget): string[] {
  const expDir = join(cwd, "experiments", id);
  switch (target) {
    case "docker":
      return ["docker", "run", "--rm", "-v", `${expDir}:/work`, `epistemic-${id}`];
    case "modal":
      return ["modal", "run", join(expDir, "modal-app.py")];
    case "local":
    default:
      return ["bash", join(expDir, "run.sh")];
  }
}

export class ExperimentRunner {
  private runs = new Map<string, LiveRun>();

  constructor(private cwd: string) {}

  spawn(id: string, target: ComputeTarget): Promise<void> {
    return this.spawnWith(id, commandFor(this.cwd, id, target));
  }

  /** Lower-level: spawn an explicit argv (used by tests). */
  async spawnWith(id: string, argv: string[]): Promise<void> {
    const smokes = join(this.cwd, "experiments", id, "smokes");
    await mkdir(smokes, { recursive: true });
    await writeFile(join(smokes, "telemetry.jsonl"), "", "utf8");
    await writeFile(join(smokes, "run-status.json"), JSON.stringify({ status: "running" }), "utf8");

    const [cmd, ...args] = argv;
    const proc = spawn(cmd, args, { cwd: this.cwd });

    let buf = "";
    let trial = 0, total = 0, cost = 0;
    let acc: number | undefined;
    let t = 0;

    let writeChain = Promise.resolve();

    const flush = (point: object) => {
      writeChain = writeChain.then(() =>
        appendFile(join(smokes, "telemetry.jsonl"), JSON.stringify(point) + "\n", "utf8")
      );
    };

    proc.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const mt = line.match(/^TRIAL (\d+)\/(\d+)/);
        const mc = line.match(/^COST ([\d.]+)/);
        const ma = line.match(/^ACC ([\d.]+)/);
        if (mt) { trial = +mt[1]; total = +mt[2]; }
        else if (mc) { cost = +mc[1]; }
        else if (ma) { acc = +ma[1]; flush({ trial, total, cost, acc, t: ++t }); }
      }
    });

    const done = new Promise<void>((resolve) => {
      proc.on("close", async (code) => {
        await writeChain; // drain any pending appends
        const live = this.runs.get(id);
        const status = live?.killed ? "killed" : code === 0 ? "done" : "failed";
        await writeFile(
          join(smokes, "run-status.json"),
          JSON.stringify({ status, exit: code ?? undefined }),
          "utf8",
        );
        resolve();
      });
    });

    this.runs.set(id, { proc, killed: false, done });
  }

  kill(id: string): void {
    const live = this.runs.get(id);
    if (live && !live.killed) {
      live.killed = true;
      live.proc.kill("SIGKILL");
    }
  }

  waitFor(id: string): Promise<void> {
    return this.runs.get(id)?.done ?? Promise.resolve();
  }

  isRunning(id: string): boolean {
    const live = this.runs.get(id);
    return !!live && live.proc.exitCode === null && !live.killed;
  }
}
