# Ξ epistemic

**Research-discipline runtime for Pi coding agents.**

Epistemic turns your coding agent into a rigorous research assistant. Instead of letting you run experiments, make claims, and move on — it forces you to pre-register hypotheses, reproduce baselines, subject claims to adversarial review, investigate surprising results, and kill failing ideas before they drain your budget.

Inspired by the norms of good ML research, the superpowers workflow format from [pi-superpowers](https://github.com/coctostan/pi-superpowers), and the execution model from [Feynman](https://github.com/companion-inc/feynman) and [AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw).

## How It Works

Epistemic is **pi.dev (omp) + extensions — not a replacement.** You run the real
omp agent (its real chat, model, tools, MCP, memory), and epistemic loads as an
extension that adds research discipline and spatial views on top.

Your coding agent loads a **skill** and follows it step by step. Behind the
scenes, **gates** in the extension enforce the rules automatically, and **research
commands** add a decision-tree view and a hypothesis action menu inside omp.
Execution can run locally, in Docker, or on Modal.

| Layer | What it does |
|-------|-------------|
| **Skills** | Detailed manuals the agent follows step by step. The primary UX. |
| **Gates** | Invisible enforcement inside the extension. Block violations automatically. |
| **Views** | `/tree` (decision tree of the research program) and `/hypothesis` (pick → approve/reject/modify/chat), rendered inside omp. |
| **State** | File-based ledger: `HYPOTHESES.md`, `.epistemic/cost-ledger.jsonl`, `experiments/{id}/`. |
| **Tools** | HF dataset metadata, AlphaXiv paper search, cross-run lessons. |

### Research views (inside omp)

Author hypotheses in `HYPOTHESES.md` with optional `- **Parent:** <id>` and
`- **Decision:** <cond> → <ifTrue> | else → <ifFalse>` fields, then:

```
/tree          # show the decision tree below the editor (stays live; /tree off to hide)
/hypothesis    # pick a hypothesis → chat / approve (ship) / reject (kill) / modify (refine|pivot)
```

The tree renders top-down with decision forks:

```
● ✓ H-001  LoRA fine-tuning improves code-gen…
│
├─▶ ▶ H-004  Scaling LoRA to 7B…
│   ◇ if acc ≥ 0.80
│   ├─ yes → ship
│   └─ no  → H-006 pivot
└─▶ ☓ H-002  High learning rate…
```

## The Pipeline

```
research-question
    ↓
preregistration
    ↓
baseline-reproduction
    ↓
experiment-execution
    ↓
statistical-rigor
    ↓
falsification-review
    ↓
surprise-triage (if needed)
    ↓
kill-or-ship
    ↓
verification-before-publication
```

### 1. `/skill:research-question`

Turn a vague idea into a testable hypothesis.

The agent asks one question at a time — like Socratic brainstorming — until a claim is falsifiable, a falsifier is concrete, and a budget is realistic. **Before settling on one hypothesis**, the agent generates 2-3 competing explanations for the same observation, each with a unique disconfirming prediction. The researcher picks one; the others are archived in `experiments/{id}/alternatives/`.

| Field | Required? | What it is |
|-------|-----------|------------|
| Claim | Yes | "X outperforms Y by Z on benchmark W" |
| Falsifier | Yes | "If we see A under conditions B, the claim is wrong" |
| Best-case conclusion | Yes | What success actually looks like (low expectations prevent over-investment) |
| Sample size (n) | Yes | Number of runs (default 30) |
| Judge config | Yes | Model, prompt, temperature, seed |
| Baseline reference | Yes | Competitor name + source URL + score + version + date |
| Cost cap | Yes | USD budget (default $50) |
| Compute target | Yes | Where experiments run: `local`, `docker`, or `modal` |

The agent writes the draft to `HYPOTHESES.md`.

**If the falsifier is not empirically testable**: the agent rejects it and asks you to reframe.

### 2. `/skill:preregistration`

Lock everything before a single experiment runs.

The agent validates all fields, then:
- Creates `experiments/{id}/prereg.md` with the full pre-registration
- Computes SHA-256 hash of the judge config → writes `judge.lock`
- Generates execution scaffold based on `computeTarget`:
  - **docker**: `Dockerfile` + `requirements.txt` + `environment.lock` (SHA-256 of both)
  - **modal**: `modal-app.py` stub with `@modal.app()` decorator + `environment.lock`
  - **local**: just the `environment.lock` for reproducibility
- Git commits the registration

**After this point**, the prereg gate blocks experiments without `prereg.md`. Judge lock blocks drift. Environment lock blocks execution if Dockerfile/requirements changed.

### 3. `/skill:baseline-reproduction`

You cannot claim to beat X until you've run X yourself.

The agent:
1. Uses AlphaXiv (`alpha` CLI) to find and read the competitor paper — extracts the reported figure from the results section
2. Validates any HuggingFace datasets via `hf_dataset_info` and `hf_repo_files` — blocks if gated without `HF_TOKEN`
3. Reproduces the result under your **locked** judge
4. Records: exact score, pinned HF revision, version, retrieval date, reproduction command
5. Writes to `experiments/{id}/baselines/{name}.md`

**If the baseline is >30 days old**: it must be refreshed. **If you can't reproduce the number**: document the discrepancy — your claim is relative to what you *can* reproduce.

### 4. `/skill:experiment-execution`

Run the experiment with discipline.

Before running:
- Confirms `prereg.md` exists
- Confirms `judge.lock` and `environment.lock` match current config
- Routes execution by `computeTarget`:
  - **local**: subprocess in venv as before
  - **docker**: `docker run --rm -v experiments/{id}/:/work` from the Dockerfile
  - **modal**: `modal run experiments/{id}/modal-app.py`

During the run:
- Every API call + compute cost is logged to `.epistemic/cost-ledger.jsonl` (with `category: "llm"` or `"compute"`)
- All results go to `experiments/{id}/smokes/` — **provisional only**
- Full sample size (n from prereg) is executed
- No mid-run methodology changes

### 5. `/skill:statistical-rigor`

No result leaves `smokes/` without statistical justification.

The agent runs five phases before any result is quoted:
1. **Assumption checking** — normality (Shapiro-Wilk or Q-Q plots), homogeneity of variance (Levene's), independence, ceiling/floor effects
2. **Test selection** — match test to data type (t-test, Mann-Whitney U, ANOVA, Kruskal-Wallis, Pearson/Spearman)
3. **Effect sizes** — Cohen's d, eta-squared, R-squared alongside p-values. Distinguish statistical from practical significance.
4. **Multiple comparisons** — Bonferroni or FDR correction when running many tests
5. **APA reporting** — `t(df)=X.XX, p=.XXX, d=X.XX` with exact p-values

### 6. `/skill:falsification-review`

Your claim is guilty until proven defensible.

The agent dispatches the claim to `runFalsificationAdversary()` with ≥2 models. Each model returns the cheapest experiment that would disprove the claim.

| Result | What happens |
|--------|-------------|
| All defensible | Claim promoted from `smokes/` to `RESULTS.md` — ALLOW |
| Any falsified | BLOCK — the claim cannot ship |
| Mixed | ALLOW WITH CAVEAT — the claim is tagged |

**If the cheapest disconfirming experiment is <$1 and hasn't been run**: the agent blocks and insists on running it first.

### 7. `/skill:surprise-triage`

When results diverge >15%, stop and investigate.

The agent produces ranked explanations (sampling differences, judge mismatch, data leakage, ceiling effects, prompt drift, model version change, implementation bugs) and the cheapest disambiguating test for each. Surprising numbers are blocked from `RESULTS.md` until triage completes.

### 8. `/skill:kill-or-ship`

Decide: KILL, PIVOT, REFINE, RECOMMIT, or SHIP.

| Option | When | What happens |
|--------|------|-------------|
| **KILL** | Spend > 1.5× cost cap, or >21 days stale | Write `KILLED.md`. Record lesson in `.epistemic/lessons.jsonl`. |
| **PIVOT** | Hypothesis failed but suggests a new direction | Kill old, create new hypothesis entry. Record what was learned. |
| **REFINE** | Same claim, adjusted methodology | Increment refinement counter. Requires ≥50 char override. Re-run from experiment-execution. |
| **RECOMMIT** | Continue past kill criteria | Set new cost cap, ≥50 char override. |
| **SHIP** | All gates pass, falsification clean | Tag and publish. |

**Sunk cost rule**: killed hypotheses cannot be silently revived. **Expected kill-to-ship ratio**: 5:1. **Cross-run lessons**: every kill/pivot/cost-overrun is recorded and surfaced in future runs.

### 9. `/skill:verification-before-publication`

Evidence before claims, always.

Before any claim of completion, the agent runs the full verification suite:
- [ ] `prereg.md`, `judge.lock`, `environment.lock` all present and matching
- [ ] All baselines fresh (<30 days) and reproduced
- [ ] HF dataset revisions pinned and verified
- [ ] All falsifier verdicts written and evaluated
- [ ] Cost ledger up to date with LLM and compute categories
- [ ] Cross-run lessons reviewed for relevant patterns
- [ ] Statistical rigor checks completed
- [ ] Competing hypotheses documented in `alternatives/`
- [ ] `RESULTS.md` only contains confirmed, falsification-passed results

## Gates (Invisible Enforcement)

| Gate | Blocks |
|------|--------|
| **Prereg** | Running experiments without `prereg.md` |
| **Judge Lock** | Judge config drift mid-experiment |
| **Environment Lock** | Dockerfile/requirements drift mid-experiment |
| **Smoke** | Provisional numbers in headline files |
| **Cost Ledger** | (transparent — logs every call with category) |
| **Claim Intercept** | Comparison claims referencing unreproduced baselines |
| **Kill Criteria** | Spend > 1.5× cost cap, stale >21 days |
| **Baseline Staleness** | Baselines >30 days old without refresh |

## File Layout

```
.epistemic/
  cost-ledger.jsonl              # Every tool call, with cost and category
  lessons.jsonl                  # Cross-run lesson entries
HYPOTHESES.md                    # All hypotheses (markdown table)
BASELINES.md                     # Known baseline references
RESULTS.md                       # Confirmed results (only falsification-passed)
OVERRIDES.md                     # Gate overrides with mandatory reasons
experiments/
  {hypothesis-id}/
    prereg.md                    # Pre-registration
    judge.lock                   # SHA-256 hash of judge config
    environment.lock             # SHA-256 hash of Dockerfile + requirements
    Dockerfile                   # Docker container (if computeTarget: docker)
    requirements.txt             # Pinned dependencies
    modal-app.py                 # Modal entrypoint (if computeTarget: modal)
    smokes/                      # Provisional results (cannot be quoted)
    RESULTS.md                   # This hypothesis's confirmed results
    KILLED.md                    # Kill rationale (if killed)
    alternatives/                # Non-chosen competing hypotheses
    baselines/{name}.md          # Reproduced baseline records
    falsifiers/{model}.md        # Adversary verdict reports
```

## Getting Started

```bash
pi install .                       # Or use the git URI
pi -p "/skill:research-question"   # Start with your research idea
```

The agent will prompt you one question at a time. You don't need to know the full pipeline — each skill cross-references the next.

## Relation to Gates

The skills are the **manual**. The gates are the **enforcement**.

If the skills are well-written, the gates should never fire — the agent will follow the rules because the manual tells it to. The gates are a safety net.

## File Reference

| Path | What it's for |
|------|---------------|
| `skills/*/SKILL.md` | 9 agent-facing manuals for each pipeline step |
| `src/index.ts` | Pi extension entry point: gates, HF tools, state injection |
| `src/gates/prereg.ts` | Gate implementation: block unprereg'd experiments |
| `src/extensions/huggingface.ts` | HF Hub tools: dataset metadata, file listing, file reading |
| `src/state/repo.ts` | State persistence: hypotheses, baselines, cost ledger, judge/env locks, lessons |
| `src/adversary/dispatch.ts` | Multi-model falsification adversary |