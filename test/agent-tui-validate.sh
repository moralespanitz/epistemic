#!/usr/bin/env bash
# Validate the epistemic TUI with agent-tui — the "agent-browser for TUI".
# Drives the real `epistemic monitor` through a PTY: screenshot → press → assert.
#   install: npm i -g agent-tui      run: npm run test:agent-tui
set -uo pipefail

command -v agent-tui >/dev/null 2>&1 || { echo "agent-tui not installed — run: npm i -g agent-tui"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
strip() { sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g'; }
chk() { if printf '%s' "$2" | grep -qiF "$1"; then echo "  ✔ $3"; PASS=$((PASS+1)); else echo "  ✘ $3 (missing: $1)"; FAIL=$((FAIL+1)); fi; }

agent-tui kill >/dev/null 2>&1 || true
agent-tui run --cwd "$ROOT" -- node --import tsx src/cli/epistemic.ts monitor >/dev/null 2>&1
agent-tui wait "mission control" >/dev/null 2>&1

S=$(agent-tui screenshot 2>/dev/null | strip)
chk "mission control" "$S" "monitor renders mission control"
chk "H-001"           "$S" "tree shows hypotheses"

agent-tui press ArrowDown  >/dev/null 2>&1; sleep 0.4
agent-tui press ArrowRight >/dev/null 2>&1; sleep 0.6
S=$(agent-tui screenshot 2>/dev/null | strip)
chk "claim:"     "$S" "→ opens the detail interface"
chk "falsifier:" "$S" "detail shows the falsifier"

agent-tui press ArrowLeft >/dev/null 2>&1; sleep 0.5
S=$(agent-tui screenshot 2>/dev/null | strip)
chk "↑↓ select" "$S" "← returns to the centered tree view"

agent-tui kill >/dev/null 2>&1 || true
echo "agent-tui: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
