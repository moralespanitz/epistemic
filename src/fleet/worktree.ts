import { mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export function worktreePath(cwd: string, id: string): string {
  return join(cwd, ".worktrees", id);
}

export async function createWorktree(cwd: string, id: string): Promise<string> {
  const path = worktreePath(cwd, id);
  if (existsSync(path)) return path;
  await mkdir(join(cwd, ".worktrees"), { recursive: true });
  try {
    await exec("git", ["worktree", "add", "--detach", path], { cwd });
  } catch (e: any) {
    if (String(e.message).includes("already")) {
      await exec("git", ["worktree", "prune"], { cwd });
      await exec("git", ["worktree", "add", "--detach", path], { cwd });
    } else throw e;
  }
  return path;
}

export async function removeWorktree(cwd: string, id: string): Promise<void> {
  const path = worktreePath(cwd, id);
  try {
    await exec("git", ["worktree", "remove", "--force", path], { cwd });
  } catch { /* already gone */ }
  await rm(path, { recursive: true, force: true });
  await exec("git", ["worktree", "prune"], { cwd });
}

export interface WorktreeInfo { id: string; path: string; pid: number | null; }

export async function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  const base = join(cwd, ".worktrees");
  if (!existsSync(base)) return [];
  const entries = await readdir(base, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  return Promise.all(dirs.map(async d => ({
    id: d.name,
    path: join(base, d.name),
    pid: await readPid(cwd, d.name),
  })));
}

export async function writePid(cwd: string, id: string, pid: number): Promise<void> {
  await writeFile(join(worktreePath(cwd, id), "fleet.pid"), String(pid), "utf8");
}

export async function readPid(cwd: string, id: string): Promise<number | null> {
  try {
    const raw = await readFile(join(worktreePath(cwd, id), "fleet.pid"), "utf8");
    const n = parseInt(raw.trim(), 10);
    return isNaN(n) ? null : n;
  } catch { return null; }
}
