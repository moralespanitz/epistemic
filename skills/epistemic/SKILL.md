---
name: epistemic
description: Use when starting or continuing empirical/ML research, evals, benchmarks, or any "is X better than Y?" claim — the umbrella mechanism that enforces hypothesis → preregistration → baseline → experiment → statistical rigor → falsification → kill-or-ship → verification, with gates you self-enforce.
---

# Ξ Epistemic — the research-discipline mechanism

A coding agent will happily cherry-pick a number that confirms what you hoped.
Epistemic is the discipline that stops that: you commit to what would *disprove*
your idea **before** you run anything, reproduce the baseline you claim to beat,
and treat every result as guilty until it survives attack. Killing a bad idea
fast is a win, not a failure (target ~5 kills per ship).

**Announce at start:** "Using the epistemic mechanism."

This skill is the orchestrator. Each stage below is its own skill — invoke them
in order; don't skip ahead.

## The pipeline (do these in order)

1. **research-question** — turn the idea/observation into ONE falsifiable claim
   (intervention, comparator, metric, task, direction) + its falsifier.
2. **preregistration** — freeze the contract BEFORE any run: claim, falsifier,
   baseline, judge (model+prompt+temp+seed), sample size, cost cap, compute
   target, best-case conclusion. Write it to `experiments/<id>/prereg.md`.
3. **baseline-reproduction** — reproduce the number you claim to beat, under the
   *pinned judge*, before any comparison.
4. **experiment-execution** — run the pre-registered trials; provisional numbers
   live in `smokes/` only.
5. **statistical-rigor** — no headline number without n, variance, and a test;
   report effect size + uncertainty, not a single point.
6. **falsification-review** — actively try to break the result (≥2 independent
   adversarial passes / models). Guilty until proven defensible.
7. **surprise-triage** — if results diverge >15% from expectation, STOP and
   diagnose before believing them.
8. **kill-or-ship** — decide KILL / PIVOT / RECOMMIT / REFINE / SHIP from the
   repository evidence and the pre-registered falsifier.
9. **verification-before-publication** — evidence must exist in the repo before
   any claim reaches a headline file (README/RESULTS/paper).

## The gates — self-enforce these (no runtime in Claude Code)

In the epistemic agent these are hard-blocking. Here YOU enforce them:

- **Prereg gate** — refuse to run any experiment-shaped command before
  `prereg.md` exists. Non-zero spend before prereg = protocol breach.
- **Judge / environment lock** — never silently change the judge or environment
  mid-run; if it changes, record an override with a reason.
- **Smoke gate** — never quote a `smokes/` number in a headline file.
- **Claim interceptor** — never compare to a baseline you haven't reproduced.
- **Kill criteria** — spend > 1.5× the cost cap, or > 21 days stale → run
  kill-or-ship now.
- **Baseline staleness** — don't compare against a baseline > 30 days old without
  re-checking it.

Overrides are allowed but must be recorded in `OVERRIDES.md` with a reason
(≥50 chars). If you catch yourself rationalizing ("just one quick run first"),
that's the breach — stop and pre-register.

## Parallel by default

Don't serialize on one hypothesis. Run several lanes concurrently — each its own
`experiments/<id>/` with its own prereg — and kill the losers fast. Fan out
variants (a sweep) as parallel subagents where they don't share a judge/baseline
lock.

## Repo layout it expects

```
HYPOTHESES.md            # one ## Hypothesis: <id> block per lane
BASELINES.md             # reproduced baselines (name, score, judge, version)
RESULTS.md               # confirmed, verified results only
OVERRIDES.md             # gate overrides, each with a reason
experiments/<id>/
  prereg.md  judge.lock  smokes/   # provisional runs live in smokes/
```
