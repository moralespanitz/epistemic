/**
 * epistemic dash — a split-terminal "cockpit": the REAL pi/omp chat on the left,
 * the live epistemic monitor on the right. Uses tmux (ubiquitous) so the chat
 * stays exactly pi.dev while you watch experiments alongside it.
 *
 * Spawn extra chat panes any time with tmux's own split keys (Ctrl-b " / %),
 * giving you parallel agent sessions + live monitoring — the game-cockpit feel,
 * without replacing the chat.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function has(cmd: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

export async function runDash(cwd: string): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = join(here, "epistemic.ts");
  const chatCmd = `npx tsx ${entry}`;          // the branded agent
  const monitorCmd = `npx tsx ${entry} monitor`; // the live dashboard

  if (!has("tmux")) {
    console.error(
      "epistemic dash needs tmux for the split layout.\n" +
        "  • install: brew install tmux  (or your package manager)\n" +
        "  • or run the two panes yourself: `epistemic` and `epistemic monitor`",
    );
    process.exit(1);
  }

  const session = "epistemic";
  // Fresh session: left = chat (60%), right = monitor (40%).
  const script = [
    `tmux kill-session -t ${session} 2>/dev/null`,
    `tmux new-session -d -s ${session} -c "${cwd}" "${chatCmd}"`,
    `tmux split-window -h -p 40 -t ${session} -c "${cwd}" "${monitorCmd}"`,
    `tmux select-pane -t ${session}.0`,
    `tmux attach -t ${session}`,
  ].join("\n");

  const result = spawnSync("sh", ["-c", script], { stdio: "inherit", cwd });
  process.exit(result.status ?? 0);
}
