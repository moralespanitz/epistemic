#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: Claude Code CLI not found in PATH"
  exit 1
fi

SPECIFIC_TEST=""
TIMEOUT=300

while [[ $# -gt 0 ]]; do
  case "$1" in
    --test|-t)
      SPECIFIC_TEST="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--test test-file.sh] [--timeout seconds]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

tests=("test-epistemic-trigger.sh")
if [ -n "$SPECIFIC_TEST" ]; then
  tests=("$SPECIFIC_TEST")
fi

passed=0
failed=0

echo "Claude Code Epistemic skill tests"
echo "Claude: $(claude --version 2>/dev/null || echo unknown)"
echo ""

for test_file in "${tests[@]}"; do
  echo "Running: $test_file"
  if [ ! -f "$test_file" ]; then
    echo "  [FAIL] missing test file"
    failed=$((failed + 1))
    continue
  fi
  if timeout "$TIMEOUT" bash "$test_file"; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
  fi
  echo ""
done

echo "Passed: $passed"
echo "Failed: $failed"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
