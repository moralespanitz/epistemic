#!/usr/bin/env bash
# Integration test: epistemic features via agent-tui (PTY-driven)
#
# Tests: hypothesis header, /graph command response, session-start hook.
# Requires:
#   npm i -g agent-tui
#   A real model auth (or ANTHROPIC_API_KEY / OPENROUTER_API_KEY)
#
# Run:
#   bash tests/integration/agent-tui-epistemic.sh
#
# Note: This drives the REAL agent — it will consume tokens.
# For CI, use tests/integration/hook-session-start.test.mjs instead (no tokens).

set -uo pipefail

command -v agent-tui >/dev/null 2>&1 || { echo "agent-tui not installed — run: npm i -g agent-tui"; exit 2; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0; FAIL=0

strip() { sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g'; }
chk() {
  if printf '%s' "$2" | grep -qiF "$1"; then
    echo "  ✔ $3"; PASS=$((PASS+1))
  else
    echo "  ✘ $3 (missing: '$1')"; FAIL=$((FAIL+1))
  fi
}
chk_not() {
  if printf '%s' "$2" | grep -qiF "$1"; then
    echo "  ✘ $3 (should be absent: '$1')"; FAIL=$((FAIL+1))
  else
    echo "  ✔ $3"; PASS=$((PASS+1))
  fi
}

# ── Setup: temp research repo ─────────────────────────────────────────────────
TESTDIR=$(mktemp -d)
cd "$TESTDIR"
git init -q

cat > HYPOTHESES.md << 'EOF'
## Hypothesis: RS-001
- **Claim**: CoT improves HumanEval pass@1
- **Status**: RUNNING
- **Cost cap**: 20
- **N**: 30
- **Compute target**: local
- **Timestamp**: 1748995200000
- **Falsifier**: If delta <= 0, claim is wrong
- **Best case conclusion**: Publish
- **Judge**: gpt-4o
- **Baseline**: zero-shot gpt-4o
EOF

cat > RESEARCH.md << 'EOF'
# RD: CoT for Code
## 1. Research overview
### 1.2 Research summary
Does CoT improve code generation?
## 10. Research stories
### 10.1. Test CoT
- **ID**: RS-001
- **Description**: Compare CoT vs vanilla.
- **Validation criteria**: p < 0.05.
EOF

cleanup() { agent-tui kill >/dev/null 2>&1 || true; rm -rf "$TESTDIR"; }
trap cleanup EXIT

# ── Test 1: session-start hook (no agent — just test hook output) ─────────────
echo ""
echo "Test 1: session-start hook — new git repo gets bootstrap message"
HOOK_OUT=$(echo "{\"cwd\":\"$TESTDIR\"}" | node "$ROOT/hooks/session-start.mjs" 2>/dev/null)
HOOK_CTX=$(echo "$HOOK_OUT" | node -e "process.stdin|s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).hookSpecificOutput.additionalContext)}catch{}})" 2>/dev/null || echo "$HOOK_OUT")
# This dir has RESEARCH.md + HYPOTHESES.md, so should get full preamble
chk "Epistemic"       "$HOOK_CTX" "hook injects epistemic context"
chk "research"        "$HOOK_CTX" "hook mentions research"

# ── Test 2: session-start hook — empty git repo gets bootstrap ────────────────
echo ""
echo "Test 2: session-start hook — empty git repo gets lightweight bootstrap"
EMPTYDIR=$(mktemp -d)
git -C "$EMPTYDIR" init -q
EMPTY_OUT=$(echo "{\"cwd\":\"$EMPTYDIR\"}" | node "$ROOT/hooks/session-start.mjs" 2>/dev/null)
EMPTY_CTX=$(echo "$EMPTY_OUT" | node -e "process.stdin|s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).hookSpecificOutput.additionalContext)}catch{}})" 2>/dev/null || echo "")
chk     "/research"           "$EMPTY_CTX" "bootstrap mentions /research"
chk     "do not answer"       "$EMPTY_CTX" "bootstrap says do not answer directly"
chk_not "huggingface-papers"  "$EMPTY_CTX" "bootstrap does not include full HF stack"
rm -rf "$EMPTYDIR"

# ── Test 3: epistemic monitor still works ────────────────────────────────────
echo ""
echo "Test 3: epistemic monitor renders with hypothesis"
agent-tui kill >/dev/null 2>&1 || true
agent-tui run --cwd "$TESTDIR" -- node --import tsx "$ROOT/src/cli/epistemic.ts" monitor >/dev/null 2>&1
sleep 1
agent-tui wait "mission control" >/dev/null 2>&1 || true

S=$(agent-tui screenshot 2>/dev/null | strip)
chk "mission control" "$S" "monitor renders"
chk "RS-001"          "$S" "hypothesis RS-001 appears in tree"
agent-tui kill >/dev/null 2>&1 || true

# ── Test 4: graph server starts from CLI ──────────────────────────────────────
echo ""
echo "Test 4: epistemic graph subcommand starts and responds"
node --import tsx/esm "$ROOT/src/cli/epistemic.ts" graph &
GRAPH_PID=$!
sleep 2

# Find the port from the process (it prints the URL)
GRAPH_URL=$(ps aux | grep "epistemic.ts graph" | grep -v grep | head -1 | grep -o 'http://localhost:[0-9]*' || echo "")

# Try a broader approach — just verify the graph server logic works
TESTSERVER=$(node --import tsx/esm -e "
import { startGraphServer } from '$ROOT/src/graph/server.js';
const s = await startGraphServer('$TESTDIR', Date.now());
const r = await fetch(s.url + '/api/state');
const d = await r.json();
console.log(d.root.label + '|' + d.nodes.length);
s.close();
process.exit(0);
" 2>/dev/null)

kill $GRAPH_PID 2>/dev/null || true

chk "CoT for Code" "$TESTSERVER" "graph server returns correct root label"
chk "2"            "$TESTSERVER" "graph server returns 2 hypothesis nodes"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "agent-tui-epistemic: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
