#!/usr/bin/env bash
# Visual-regression test for the epistemic TUI via agent-tui.
# Captures deterministic screens (ANSI stripped, trailing space trimmed) and
# diffs them against saved baselines. Any unintended layout change fails.
#
#   npm run test:snapshot              # compare against baselines
#   UPDATE_SNAPSHOTS=1 npm run test:snapshot   # (re)record baselines
set -uo pipefail

command -v agent-tui >/dev/null 2>&1 || { echo "agent-tui not installed — run: npm i -g agent-tui"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP_DIR="$ROOT/test/snapshots"
COLS=100; ROWS=40
mkdir -p "$SNAP_DIR"
PASS=0; FAIL=0; UPDATED=0

# Normalize a screen: strip ANSI, mask volatile values ($ amounts, %), trim
# trailing whitespace, and drop trailing blank lines (BSD/macOS-sed safe via awk).
norm() {
  sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g; s/\x1b[=>]//g' \
    | sed '/^Screenshot:/d' \
    | sed -E 's/\$[0-9]+\.[0-9]+/\$N/g; s/[0-9]+%/N%/g' \
    | sed 's/[[:space:]]*$//' \
    | awk '{ a[NR]=$0 } END { last=NR; while (last>0 && a[last]=="") last--; for (i=1;i<=last;i++) print a[i] }'
}

snapshot() { # snapshot <name>
  local name="$1" file="$SNAP_DIR/$1.txt"
  local cur; cur=$(agent-tui screenshot 2>/dev/null | norm)
  if [ "${UPDATE_SNAPSHOTS:-0}" = "1" ] || [ ! -f "$file" ]; then
    printf '%s\n' "$cur" > "$file"; echo "  ⟳ recorded $name"; UPDATED=$((UPDATED+1)); return
  fi
  if diff -q <(printf '%s\n' "$cur") "$file" >/dev/null; then
    echo "  ✔ $name matches baseline"; PASS=$((PASS+1))
  else
    echo "  ✘ $name differs from baseline:"; diff "$file" <(printf '%s\n' "$cur") | sed 's/^/      /' | head -20; FAIL=$((FAIL+1))
  fi
}

agent-tui kill >/dev/null 2>&1 || true
agent-tui run --cwd "$ROOT" -- node --import tsx src/cli/epistemic.ts monitor >/dev/null 2>&1
agent-tui resize --cols $COLS --rows $ROWS >/dev/null 2>&1
agent-tui wait "mission control" >/dev/null 2>&1; sleep 0.6

echo "▸ snapshots"
snapshot "monitor-tree"
agent-tui press ArrowRight >/dev/null 2>&1; sleep 0.5
snapshot "monitor-detail"
agent-tui press Enter >/dev/null 2>&1; sleep 0.4
snapshot "monitor-actions"

agent-tui kill >/dev/null 2>&1 || true
echo
echo "════════════════════════════════════"
echo "snapshots: $PASS matched, $FAIL changed, $UPDATED recorded"
[ "$FAIL" -eq 0 ]
