#!/usr/bin/env bash
# UX/UI validation for the epistemic TUI via agent-tui (real PTY).
# Drives the monitor through navigation + edge cases and asserts both that the
# right things appear AND that failure markers (truncation, glitches, crashes,
# overflow) do NOT appear. Run: npm run test:agent-tui:ux
set -uo pipefail

command -v agent-tui >/dev/null 2>&1 || { echo "agent-tui not installed — run: npm i -g agent-tui"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COLS=100; ROWS=40
PASS=0; FAIL=0
strip() { sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g; s/\x1b\][^\a]*\a//g; s/\x1b[=>]//g'; }
shot() { agent-tui screenshot 2>/dev/null | strip; }
chk()    { if printf '%s' "$2" | grep -qiF -- "$1"; then echo "  ✔ $3"; PASS=$((PASS+1)); else echo "  ✘ $3 (missing: $1)"; FAIL=$((FAIL+1)); fi; }
chknot() { if printf '%s' "$2" | grep -qiF -- "$1"; then echo "  ✘ $3 (found failure marker: $1)"; FAIL=$((FAIL+1)); else echo "  ✔ $3"; PASS=$((PASS+1)); fi; }
section() { echo; echo "▸ $1"; }

agent-tui kill >/dev/null 2>&1 || true
agent-tui run --cwd "$ROOT" -- node --import tsx src/cli/epistemic.ts monitor >/dev/null 2>&1
agent-tui resize --cols $COLS --rows $ROWS >/dev/null 2>&1 || true
agent-tui wait "mission control" >/dev/null 2>&1
sleep 0.5

section "initial render"
S=$(shot)
chk "mission control" "$S" "header renders"
chk "running"         "$S" "fleet counts render"
chk "experiments"     "$S" "experiments section renders"
chk "▸"               "$S" "a row is selected"
chk "select"          "$S" "key hints render"

section "no failure/glitch markers"
chknot "truncated"  "$S" "no widget truncation"
chknot "undefined"  "$S" "no undefined values"
chknot "NaN"        "$S" "no NaN values"
chknot "Error"      "$S" "no error text"
chknot "ERR_"       "$S" "no module errors"

section "no line exceeds terminal width ($COLS)"
# Count display columns (code points), not UTF-8 bytes — box-drawing chars are multi-byte.
LONG=$(printf '%s' "$S" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(s.split('\n').filter(l=>[...l].length>$COLS).length))")
if [ "${LONG:-0}" -eq 0 ]; then echo "  ✔ all lines fit width"; PASS=$((PASS+1)); else echo "  ✘ $LONG line(s) overflow $COLS cols"; FAIL=$((FAIL+1)); fi

section "navigation: down past the end is clamped (no crash)"
for _ in 1 2 3 4 5 6; do agent-tui press ArrowDown >/dev/null 2>&1; done
sleep 0.4
S=$(shot)
chk "mission control" "$S" "still alive after over-scrolling down"
chk "▸"               "$S" "selection still valid"

section "navigation: up past the top is clamped"
for _ in 1 2 3 4 5 6; do agent-tui press ArrowUp >/dev/null 2>&1; done
sleep 0.4
S=$(shot)
chk "mission control" "$S" "still alive after over-scrolling up"

section "→ opens detail interface with full fields"
agent-tui press ArrowRight >/dev/null 2>&1; sleep 0.5
S=$(shot)
chk "claim:"     "$S" "detail shows claim"
chk "falsifier:" "$S" "detail shows falsifier"
chk "cost:"      "$S" "detail shows cost"

section "enter opens the action menu with all options"
agent-tui press Enter >/dev/null 2>&1; sleep 0.4
S=$(shot)
chk "approve" "$S" "action menu: approve"
chk "reject"  "$S" "action menu: reject"
chk "modify"  "$S" "action menu: modify"

section "esc closes the action menu"
agent-tui press Escape >/dev/null 2>&1; sleep 0.4
S=$(shot)
chknot "▸ approve" "$S" "menu closed (no highlighted action)"

section "← returns to the tree"
agent-tui press ArrowLeft >/dev/null 2>&1; sleep 0.4
S=$(shot)
chk "experiments" "$S" "back on the tree"

section "resize to 60x20 stays coherent"
agent-tui resize --cols 60 --rows 20 >/dev/null 2>&1; sleep 1.8
S=$(shot)
chk "mission control" "$S" "renders after resize"
chknot "Error" "$S" "no crash on resize"

agent-tui kill >/dev/null 2>&1 || true
echo
echo "════════════════════════════════════"
echo "agent-tui UX: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
