#!/usr/bin/env bash
# End-to-end TUI test: drive the real interface in a headless tmux pane, send
# keystrokes, and assert on the captured screen. This is how you test a TUI with
# an agent — programmatic key injection + screen capture.
#
# Requires tmux:  brew install tmux   (or your package manager)
# Run:            npm run test:tui
set -uo pipefail

if ! command -v tmux >/dev/null 2>&1; then
  echo "tui-e2e: tmux not installed — run 'brew install tmux' to enable end-to-end TUI tests." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SESSION="epistemic-e2e"
PASS=0; FAIL=0

cap() { tmux capture-pane -t "$SESSION" -p; }
expect() { # expect <label> <substring>
  if cap | grep -qF "$2"; then echo "  ✔ $1"; PASS=$((PASS+1));
  else echo "  ✘ $1 — expected to see: $2"; FAIL=$((FAIL+1)); fi
}

tmux kill-session -t "$SESSION" 2>/dev/null
# Launch the agent (the extension auto-loads; /monitor opens the dashboard).
tmux new-session -d -s "$SESSION" -x 200 -y 50 -c "$ROOT" "epistemic"
sleep 4

# Open the monitor.
tmux send-keys -t "$SESSION" "/monitor" Enter; sleep 2
expect "monitor opens (tree interface)" "mission control"
expect "tree shows hypotheses" "H-001"

# Navigate: down selects next, right opens detail.
tmux send-keys -t "$SESSION" Down; sleep 1
tmux send-keys -t "$SESSION" Right; sleep 1
expect "right arrow → detail interface" "claim:"

# Left returns to the tree.
tmux send-keys -t "$SESSION" Left; sleep 1
expect "left arrow → back to tree" "experiments"

tmux kill-session -t "$SESSION" 2>/dev/null
echo "tui-e2e: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
