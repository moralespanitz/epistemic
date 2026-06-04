---
name: using-epistemic
description: Use when starting a research, eval, benchmark, or empirical comparison session - explains how to activate Epistemic skills, choose stage skills, and enforce research gates before any experiment work.
---

# Using Epistemic

Epistemic is a research-discipline layer for coding agents. It exists to stop
empirical work from turning into cherry-picked runs, stale baselines, or
headline claims with no paper trail.

## The Rule

If the task involves empirical research, evals, benchmarks, model comparisons,
ablation studies, "is X better than Y?", or publishing a result, invoke the
`epistemic` skill before answering or acting.

If a stage-specific skill applies, invoke it next:

1. `research-question`
2. `preregistration`
3. `baseline-reproduction`
4. `experiment-execution`
5. `statistical-rigor`
6. `falsification-review`
7. `surprise-triage`
8. `kill-or-ship`
9. `verification-before-publication`

Do not skip ahead because a run looks cheap, obvious, or exploratory. A cheap
unregistered run can still contaminate the evidence chain.

## Instruction Priority

Follow explicit user and repository instructions first. Epistemic skills define
how to do research work, but they do not override direct user constraints,
repository policy, or safety requirements.

## Research Repo Detection

Treat a repo as Epistemic-active when it contains any of:

- `HYPOTHESES.md`
- `experiments/`
- `RESULTS.md`

If none exists but the user asks to start empirical work, use
`research-question` to create the first falsifiable hypothesis before running
benchmarks, evals, training, or judge-backed scripts.

## Gates To Self-Enforce

In the OMP agent, several gates are runtime-enforced. In portable harnesses such
as Claude Code, you must enforce them yourself:

- No experiment-shaped command before `experiments/<id>/prereg.md`.
- No comparison to an unreproduced baseline.
- No judge, prompt, seed, model, dataset, or environment drift without an
  `OVERRIDES.md` entry explaining why.
- No `smokes/` number in `README.md`, `RESULTS.md`, a paper, or a claim summary.
- Run `surprise-triage` when a result diverges by more than 15%.
- Run `kill-or-ship` when cost exceeds 1.5x cap or a hypothesis goes stale.

Overrides are allowed only when recorded with a concrete reason. If the reason
would embarrass you in a methods section, do not override.

## Harness Adaptation

Claude Code should use the `Skill` tool for full skill content. Other harnesses
may expose skills differently; use their native skill mechanism when available.
The method is portable even when runtime gates, dashboards, or OMP-specific
widgets are not.

## First Response Pattern

When Epistemic applies, start with a short announcement:

```text
Using the epistemic mechanism.
```

Then load the umbrella `epistemic` skill and the current stage skill before
continuing. Ask one clarifying question at a time when defining a hypothesis.
