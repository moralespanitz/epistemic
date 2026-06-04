#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: Epistemic trigger in research repo ==="

project_dir="$(create_research_repo)"
trap 'cleanup_research_repo "$project_dir"' EXIT

prompt='I want to run a benchmark to see whether my new prompt beats the baseline. What should I do first?'
output="$(cd "$project_dir" && run_claude "$prompt" 180 "$project_dir")"

assert_contains "$output" 'epistemic|research[- ]question|preregistration' "routes through Epistemic skills"
assert_contains "$output" 'hypothesis|falsifiable|claim' "asks for a falsifiable claim"
assert_contains "$output" 'prereg|pre-register|pre register' "requires preregistration before running"
assert_not_contains "$output" 'npm run|python .*benchmark|run the benchmark first' "does not jump straight to execution"

echo "=== All checks passed ==="
