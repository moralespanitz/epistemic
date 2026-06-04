#!/usr/bin/env bash
set -euo pipefail

run_claude() {
  local prompt="$1"
  local timeout_seconds="${2:-120}"
  local cwd="${3:-$PWD}"
  local output_file
  output_file="$(mktemp)"

  if timeout "$timeout_seconds" claude -p "$prompt" > "$output_file" 2>&1; then
    cat "$output_file"
    rm -f "$output_file"
    return 0
  fi

  local exit_code=$?
  cat "$output_file" >&2
  rm -f "$output_file"
  return "$exit_code"
}

assert_contains() {
  local output="$1"
  local pattern="$2"
  local name="${3:-contains check}"

  if printf '%s\n' "$output" | grep -Eiq "$pattern"; then
    printf '  [PASS] %s\n' "$name"
  else
    printf '  [FAIL] %s\n' "$name"
    printf '  Expected pattern: %s\n' "$pattern"
    printf '  Output:\n'
    printf '%s\n' "$output" | sed 's/^/    /'
    return 1
  fi
}

assert_not_contains() {
  local output="$1"
  local pattern="$2"
  local name="${3:-not contains check}"

  if printf '%s\n' "$output" | grep -Eiq "$pattern"; then
    printf '  [FAIL] %s\n' "$name"
    printf '  Unexpected pattern: %s\n' "$pattern"
    printf '  Output:\n'
    printf '%s\n' "$output" | sed 's/^/    /'
    return 1
  fi
  printf '  [PASS] %s\n' "$name"
}

create_research_repo() {
  local dir
  dir="$(mktemp -d)"
  mkdir -p "$dir/experiments"
  printf '# Hypotheses\n\n' > "$dir/HYPOTHESES.md"
  printf '%s\n' "$dir"
}

cleanup_research_repo() {
  local dir="$1"
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    rm -rf "$dir"
  fi
}
