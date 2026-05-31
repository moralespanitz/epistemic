import { spawn } from "node:child_process";

export interface NodeContext {
  id: string;
  claim: string;
  status: string;
}

export interface AgentBridgeOptions {
  bin?: string;        // default "omp"
  baseArgs?: string[]; // default ["-p", "--continue"]
}

/** Prepend the selected hypothesis context so the agent answers in context. */
export function buildPrompt(question: string, ctx: NodeContext | undefined): string {
  if (!ctx) return question;
  return [
    `[Context: hypothesis ${ctx.id} — "${ctx.claim}" — status ${ctx.status}]`,
    question,
  ].join("\n");
}

export class AgentBridge {
  private bin: string;
  private baseArgs: string[];

  constructor(private cwd: string, opts: AgentBridgeOptions = {}) {
    this.bin = opts.bin ?? "omp";
    this.baseArgs = opts.baseArgs ?? ["-p", "--continue"];
  }

  /** Run one non-interactive agent turn. Streams stdout via onChunk; resolves with full text. */
  ask(
    question: string,
    ctx: NodeContext | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const prompt = buildPrompt(question, ctx);
    return new Promise((resolve) => {
      let resolved = false;
      const done = (result: string) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      let proc;
      try {
        proc = spawn(this.bin, [...this.baseArgs, prompt], { cwd: this.cwd });
      } catch {
        done("agent unavailable (failed to spawn)");
        return;
      }

      let out = "";
      proc.on("error", () => done("agent unavailable (binary not found)"));
      proc.stdout?.on("data", (c: Buffer) => {
        const s = c.toString();
        out += s;
        onChunk(s);
      });
      proc.on("close", () => done(out || "agent unavailable (no output)"));
    });
  }
}
