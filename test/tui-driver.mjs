/**
 * "agent-browser for TUI" — pipe edition. Drives a TUI via plain child_process
 * pipes (no pty/tmux), so it runs anywhere child_process works: write keystrokes
 * to stdin, read the rendered screen from stdout, wait reactively, assert.
 */
import { spawn } from "node:child_process";

export const KEYS = {
  up: "\x1b[A", down: "\x1b[B", right: "\x1b[C", left: "\x1b[D",
  enter: "\r", esc: "\x1b", tab: "\t", ctrlC: "\x03",
};

const strip = (s) =>
  s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, "")
    .replace(/\x1b[=>]/g, "");

export function launch(command, args, { cwd = process.cwd(), env = process.env } = {}) {
  const p = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  let buf = "";
  p.stdout.on("data", (d) => { buf += d.toString(); });
  p.stderr.on("data", (d) => { buf += d.toString(); });

  const api = {
    screen: () => strip(buf),
    send: (...keys) => { for (const k of keys) p.stdin.write(KEYS[k] ?? k); return api; },
    waitFor: (text, timeoutMs = 10000) =>
      new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          if (strip(buf).includes(text)) return resolve(true);
          if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting for ${JSON.stringify(text)}\n--- screen ---\n${strip(buf).slice(-1400)}`));
          setTimeout(tick, 40);
        };
        tick();
      }),
    clear: () => { buf = ""; return api; },
    exited: () => new Promise((res) => p.on("exit", res)),
    kill: () => { try { p.kill(); } catch { /* ignore */ } },
  };
  return api;
}
