import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { worktreePath } from "./worktree.js";

export function buildLogPath(cwd: string, id: string): string {
  return join(worktreePath(cwd, id), "fleet.log");
}

export function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function spawnAgent(agentCwd: string, prompt: string, logPath: string): number {
  const fd = openSync(logPath, "a");
  const child = spawn("claude", ["-p", prompt, "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep"], {
    cwd: agentCwd,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  closeSync(fd);
  if (!child.pid) throw new Error("Failed to spawn claude — is it installed and on PATH?");
  return child.pid;
}

export function killAgent(pid: number): void {
  try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
}
