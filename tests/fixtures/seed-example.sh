#!/usr/bin/env bash
# Seed a research repo with a realistic multi-state example so the graph
# populates immediately — no brainstorm needed. Lets you test the full
# visual flow: proposed / running / confirmed nodes, gates, details cards.
#
# Usage:
#   bash tests/fixtures/seed-example.sh [target-dir]
#   (defaults to current directory)

set -euo pipefail
TARGET="${1:-$(pwd)}"
cd "$TARGET"

echo "Seeding epistemic example into: $TARGET"

# ── RESEARCH.md (the root node + research stories) ───────────────────────────
cat > RESEARCH.md << 'EOF'
# RD: CoT for Code Generation

## 1. Research overview
### 1.1 Document title and version
- RD: CoT for Code Generation
- Version: v0.1

### 1.2 Research summary
Chain-of-thought prompting asks the model to reason step by step before
producing code. This study measures whether CoT improves gpt-4o pass@1 on
HumanEval versus direct prompting, with proper statistics and a reproduced
baseline.

## 2. Research questions & hypotheses
### 2.1 Primary research questions
1. Does CoT prompting improve gpt-4o pass@1 on HumanEval by ≥2%?

### 2.2 Hypotheses
- **H1 (Alternative):** CoT pass@1 > vanilla pass@1 by ≥2% on HumanEval
- **H0 (Null):** CoT pass@1 ≤ vanilla pass@1

## 10. Research stories

### 10.1. Reproduce vanilla gpt-4o baseline
- **ID**: RS-001
- **Description**: Run gpt-4o vanilla on HumanEval-50, 30 runs, confirm published pass@1.
- **Validation criteria**: pass@1 matches 87.2% ±1%, averaged over 30 runs.

### 10.2. Test CoT vs vanilla
- **ID**: RS-002
- **Description**: Compare CoT prompting vs vanilla on 30 randomised runs.
- **Validation criteria**: Paired test p < 0.05, Cohen's d ≥ 0.2.

### 10.3. Ablate CoT style
- **ID**: RS-003
- **Description**: Compare explicit step-by-step CoT vs "think carefully" CoT.
- **Validation criteria**: Identify which CoT phrasing drives the effect.
EOF

# ── HYPOTHESES.md — three nodes in three different states ────────────────────
# RS-001: CONFIRMED (green)  · RS-002: RUNNING (pulsing amber)  · RS-003: not
# registered → stays a proposal (dashed) because it's absent from HYPOTHESES.md
cat > HYPOTHESES.md << 'EOF'
# Hypotheses

Registered hypotheses for this research project.

## Hypothesis: RS-001
- **Status:** CONFIRMED
- **Claim:** Reproduce gpt-4o HumanEval baseline at 87.2% pass@1
- **Falsifier:** If reproduced pass@1 < 85%, the baseline is not reproducible
- **Best case conclusion:** Baseline confirmed, ready as comparison point
- **N:** 30
- **Judge:** gpt-4o, temp 0.2, seed 42
- **Baseline:** zero-shot gpt-4o (OpenAI 2024-03, 87.2%)
- **Cost cap:** 15
- **Compute target:** local
- **Timestamp:** 1748995200000

## Hypothesis: RS-002
- **Status:** RUNNING
- **Claim:** CoT improves gpt-4o HumanEval pass@1 by at least 2%
- **Falsifier:** If CoT delta ≤ 0 over 30 runs, the claim is wrong
- **Best case conclusion:** CoT gives a measurable, significant lift
- **N:** 30
- **Judge:** gpt-4o, temp 0.2, seed 42
- **Baseline:** vanilla gpt-4o (RS-001 reproduced)
- **Cost cap:** 20
- **Compute target:** local
- **Timestamp:** 1748995300000
EOF

# ── Experiment artifacts for RS-001 (gates ✓) and RS-002 (partial) ───────────
mkdir -p experiments/RS-001/smokes experiments/RS-002/smokes

# RS-001 — fully gated (prereg + judge.lock + baseline)
cat > experiments/RS-001/prereg.md << 'EOF'
# Pre-registration: RS-001
Locked baseline reproduction. Judge: gpt-4o temp 0.2 seed 42. N=30.
EOF
echo "sha256:f1e2d3c4b5a6...baseline-locked" > experiments/RS-001/judge.lock
cat > experiments/RS-001/baseline.md << 'EOF'
# Baseline: RS-001
gpt-4o vanilla HumanEval-50 pass@1 = 0.872 (reproduced, 2024-06-04)
EOF

# RS-002 — prereg + judge locked, baseline pending, experiment running
cat > experiments/RS-002/prereg.md << 'EOF'
# Pre-registration: RS-002
CoT vs vanilla, 30 runs, paired t-test, Cohen's d. Locked.
EOF
echo "sha256:a1b2c3d4e5f6...cot-locked" > experiments/RS-002/judge.lock

# RS-002 telemetry — partial run (14/30) so the graph shows live progress
mkdir -p experiments/RS-002/smokes
: > experiments/RS-002/smokes/telemetry.jsonl
for i in $(seq 1 14); do
  acc=$(awk "BEGIN{printf \"%.3f\", 0.88 + ($i % 5) * 0.006}")
  echo "{\"trial\":$i,\"pass_at_1\":$acc,\"cost\":0.30}" >> experiments/RS-002/smokes/telemetry.jsonl
done

# ── RESULTS.md — RS-001 has shipped (makes it stage 9) ───────────────────────
cat > RESULTS.md << 'EOF'
# Results

## RS-001 — Baseline reproduced ✓
gpt-4o vanilla HumanEval-50 pass@1 = 0.872 ± 0.018 (n=30).
Falsification: 2/2 adversaries failed to falsify. Shipped 2024-06-04.
EOF

# ── Cost ledger — some spend logged per hypothesis ───────────────────────────
mkdir -p .epistemic
cat > .epistemic/cost-ledger.jsonl << 'EOF'
{"timestamp":"2024-06-04T10:00:00Z","hypothesisId":"RS-001","toolName":"openai","estimatedCost":11.40,"category":"llm","isError":false}
{"timestamp":"2024-06-04T11:00:00Z","hypothesisId":"RS-002","toolName":"openai","estimatedCost":6.80,"category":"llm","isError":false}
EOF

echo ""
echo "✓ Seeded. Expected graph state:"
echo "    Research Document: 'CoT for Code Generation'"
echo "    RS-001  CONFIRMED (green, ✓ shipped, all gates ✓)"
echo "    RS-002  RUNNING   (amber pulse, 14/30, prereg+judge ✓, baseline ✗)"
echo "    RS-003  proposed  (dashed — in RESEARCH.md but not registered)"
echo ""
echo "Now run:  epistemic graph     (graph-only, no agent, no tokens)"
echo "    or:   epistemic           (full agent + graph)"
