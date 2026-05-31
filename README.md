# Ξ epistemic

**Research-discipline runtime for Pi coding agents.**

Epistemic turns your coding agent into a rigorous research assistant. Instead of letting you run experiments, make claims, and move on — it forces you to pre-register hypotheses, reproduce baselines, subject claims to adversarial review, investigate surprising results, and kill failing ideas before they drain your budget.

Inspired by the norms of good ML research (Carlini, Bengio, Kaggle competition discipline) and the superpowers workflow format from [pi-superpowers](https://github.com/coctostan/pi-superpowers).

## How It Works

Your coding agent loads a **skill** and follows it step by step. The skill is a detailed manual that teaches the agent what to do in each phase. Behind the scenes, **gates** in the Pi extension enforce the rules automatically — blocking experiments without pre-registration, drift without judge-lock, and stale baselines without refresh.

| Layer | What it does |
|-------|-------------|
| **Skills** | Detailed manuals the agent follows step by step. The primary UX. |
| **Gates** | Invisible enforcement inside the Pi extension. Block violations automatically. |
| **State** | File-based ledger: `HYPOTHESES.md`, `.epistemic/cost-ledger.jsonl`, `experiments/{id}/`. |

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

The agent asks one question at a time — like Socratic brainstorming — until a claim is falsifiable, a falsifier is concrete, and a budget is realistic. By the end, you have a draft hypothesis with all 7 fields:

| Field | Required? | What it is |
|-------|-----------|------------|
| Claim | Yes | "X outperforms Y by Z on benchmark W" |
| Falsifier | Yes | "If we see A under conditions B, the claim is wrong" |
| Sample size (n) | Yes | Number of runs (default 30) |
| Judge config | Yes | Model, prompt, temperature, seed |
| Baseline reference | Yes | Competitor name + source URL + score + version + date |
| Cost cap | Yes | USD budget (default $50) |
| Best-case conclusion | Yes | What success actually looks like (low expectations prevent over-investment) |

The agent writes the draft to `HYPOTHESES.md`.

**If the falsifier is not empirically testable** ("it won't work because God doesn't exist"): the agent rejects it and asks you to reframe.

### 2. `/skill:preregistration`

Lock everything before a single experiment runs.

The agent validates all 7 fields, then:
- Creates `experiments/{id}/prereg.md` with the full pre-registration
- Computes a SHA-256 hash of the judge config (model, prompt, temperature, seed)
- Writes the hash to `experiments/{id}/judge.lock`
- Git commits the registration

**After this point**, the prereg gate in the extension blocks any `bun`, `python`, `pytest`, `eval`, or `benchmark` command if `prereg.md` is missing. And the judge-lock gate blocks any scoring call if the current judge config doesn't match the locked hash.

**If you change the judge mid-experiment**: you must use an override with a ≥50 character reason in `OVERRIDES.md`. Results produced under a drifted judge are tagged "unreliable".

### 3. `/skill:baseline-reproduction`

You cannot claim to beat X until you've run X yourself.

The agent:
1. Locates the competitor's code, paper, or published numbers
2. Reproduces the result under your **locked** judge (not the competitor's judge)
3. Records: exact score, version, retrieval date, reproduction command
4. Writes to `experiments/{id}/baselines/{name}.md`

**If the baseline is >30 days old**: it must be refreshed before you can quote it. The baseline-staleness gate (once enabled) blocks stale references.

**If you can't reproduce the competitor's number**: that's normal. Document the discrepancy. Your claim is relative to what you *can* reproduce, not what the paper *claims*.

### 4. `/skill:experiment-execution`

Run the experiment with discipline.

Before running:
- Confirms `prereg.md` exists (gate will enforce this anyway)
- Confirms `judge.lock` matches current judge config

During the run:
- Every API call is logged to `.epistemic/cost-ledger.jsonl`
- All results go to `experiments/{id}/smokes/` — **provisional only**
- The full sample size (n from prereg) is executed
- No mid-run methodology changes

After the run:
- Compute summary statistics
- **Do NOT write to `RESULTS.md` yet** — that requires falsification review first

### 5. `/skill:falsification-review`

Your claim is guilty until proven defensible.

The agent:
1. Extracts the exact claim from `RESULTS.md` or your statement
2. Verifies the baseline was reproduced (`experiments/repro_{name}/prereg.md`)
3. Dispatches the claim to `runFalsificationAdversary()` with ≥2 models (different from the drafter model)
4. Each model returns a `{experiment, costEstimate, verdict, reasoning}` — the cheapest experiment that would disprove the claim

| Result | What happens |
|--------|-------------|
| All defensible | Claim promoted from `smokes/` to `RESULTS.md` — ALLOW |
| Any falsified | BLOCK — the claim cannot ship |
| Mixed | ALLOW WITH CAVEAT — the claim is tagged |

**If the cheapest disconfirming experiment is <$1 and hasn't been run**: the agent blocks and insists on running it first.

### 6. `/skill:surprise-triage`

When results diverge >15%, stop and investigate.

Triggered when a new result differs from prior results on the same benchmark by more than 15%.

The agent produces ranked explanations (most likely first):

1. Sampling differences (seed, order, stratification)
2. Judge mismatch (different model, prompt, temperature)
3. Data leakage or test contamination
4. Ceiling effects (benchmark near saturation)
5. Prompt drift across runs
6. Model version change (provider silently deprecated)
7. Implementation bug in test harness

For each explanation, the agent produces the cheapest disambiguating test. It executes tests in cost order. If the surprising number reproduces, it's promoted. If not, it's tagged `anomaly`.

**Surprising numbers are blocked** from being written outside `smokes/` until triage completes or is overridden.

### 7. `/skill:kill-or-ship`

Decide: KILL, RECOMMIT, or SHIP.

| Option | When | What happens |
|--------|------|-------------|
| **KILL** | Spend > 1.5× cost cap, or >21 days stale | Write `KILLED.md` with id, cost, time, reason. Hypothesis is dead. |
| **RECOMMIT** | You want to continue past kill criteria | Set new cost cap, ≥50 char override in `OVERRIDES.md`. |
| **SHIP** | All gates pass, falsification clean | Tag and publish. |

**Sunk cost rule**: killed hypotheses cannot be silently revived. A new `HYPOTHESES.md` entry must be created.

**Expected kill-to-ship ratio**: 5:1. This is normal. It means you're finding bad ideas cheaply instead of investing in them.

### 8. `/skill:verification-before-publication`

Evidence before claims, always.

Before any claim of completion or publication, the agent must:
1. Identify the verification commands
2. Run the full suite
3. Read the output
4. Confirm or report actual status
5. Only then make a claim

Verification checklist:
- [ ] `prereg.md` exists for the hypothesis
- [ ] `judge.lock` hash matches current judge config
- [ ] All baselines are fresh (<30 days) and reproduced
- [ ] All falsifier verdicts are written and evaluated
- [ ] Cost ledger is up to date
- [ ] No surprising numbers pending triage
- [ ] `RESULTS.md` only contains confirmed, falsification-passed results

## Gates (Invisible Enforcement)

These run in the Pi extension. You don't interact with them directly — they block violations automatically.

| Gate | Blocks |
|------|--------|
| **Prereg** | Running experiments without `prereg.md` |
| **Judge Lock** | Judge config drift mid-experiment |
| **Smoke** | Provisional numbers in headline files |
| **Cost Ledger** | (transparent — logs every call) |
| **Claim Intercept** | Comparison claims referencing unreproduced baselines |
| **Kill Criteria** | Spend > 1.5× cost cap, stale >21 days |
| **Baseline Staleness** | Baselines >30 days old without refresh |

## File Layout

```
.epistemic/cost-ledger.jsonl     # Every tool call, with cost
HYPOTHESES.md                    # All hypotheses (markdown table)
BASELINES.md                     # Known baseline references
RESULTS.md                       # Confirmed results (only falsification-passed)
OVERRIDES.md                     # Gate overrides with mandatory reasons
experiments/
  {hypothesis-id}/
    prereg.md                    # Pre-registration (written by preregistration skill)
    judge.lock                   # SHA-256 hash of judge config
    smokes/                      # Provisional results (cannot be quoted)
    RESULTS.md                   # This hypothesis's confirmed results
    KILLED.md                    # Kill rationale (if killed)
    baselines/{name}.md          # Reproduced baseline records
    falsifiers/{model}.md        # Adversary verdict reports
```

## Getting Started

```bash
pi install .                # Or use the git URI
pi -p "/skill:research-question"  # Start with your research idea
```

The agent will prompt you one question at a time. You don't need to know the full pipeline — each skill cross-references the next.

## Relation to Gates

The skills are the **manual**. The gates are the **enforcement**.

If the skills are well-written, the gates should never fire — the agent will follow the rules because the manual tells it to. The gates are a safety net: they catch the cases where an agent skips a step or a human tries to shortcut.

## File Reference

| Path | What it's for |
|------|---------------|
| `skills/*/SKILL.md` | Agent-facing manual for each pipeline step |
| `src/index.ts` | Pi extension entry point: gates, state injection |
| `src/gates/prereg.ts` | Gate implementation: block unprereg'd experiments |
| `src/state/repo.ts` | State persistence: hypotheses, baselines, cost ledger, judge locks |
| `src/adversary/dispatch.ts` | Multi-model falsification adversary |