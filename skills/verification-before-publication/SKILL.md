---
name: verification-before-publication
description: Use when about to state, circulate, merge, or publish any research result, comparison claim, or confirmed conclusion.
---

> **Related skills:** `/skill:research-question`, `/skill:preregistration`, `/skill:baseline-reproduction`, `/skill:experiment-execution`, `/skill:falsification-review`, `/skill:surprise-triage`, `/skill:kill-or-ship`

# Verification Before Publication

## Overview

Publication is where local sloppiness becomes durable falsehood.

A result becomes publishable only when the entire evidence chain is fresh, current, and repo-backed.
The headline number is the last link.
Do not inspect the last link and assume the chain holds.

**Core principle:** if the repository cannot prove the claim now, the claim is not ready now.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```text
NO PUBLICATION CLAIMS WITHOUT FRESH, REPO-BACKED VERIFICATION EVIDENCE
```

Fresh means the current hypothesis entry, the current preregistration, the current judge lock, the current environment lock when compute is containerized, the current dataset revisions, the current baselines, the current falsifier verdicts, the current cost ledger, the current surprise-triage state, the current results files, and the current cross-run lessons.

If you did not run the publication gate in this work session, you do not have publication evidence.
You have recollection.
Recollection is not verification.

## When to Use

Use this skill when you are about to:
- edit `RESULTS.md`
- edit `experiments/{id}/RESULTS.md`
- promote a number out of `smokes/` or `experiments/{id}/smokes/`
- call a hypothesis `CONFIRMED`
- call `updateHypothesisStatus(cwd, id, "CONFIRMED")`
- write `beats`, `outperforms`, `matches`, `regresses`, or `fails to beat`
- quote a baseline comparison in a draft, PR, commit message, paper, memo, or status update
- repeat a result as if it were settled fact
- merge a change that presents a result as final
- declare the hypothesis ready for publication

## When NOT to Use

Do not use this skill:
- during question formation; use `/skill:research-question`
- during prereg drafting; use `/skill:preregistration`
- during baseline reproduction; use `/skill:baseline-reproduction`
- during experiment execution; use `/skill:experiment-execution`
- during adversarial review; use `/skill:falsification-review`
- during anomaly handling; use `/skill:surprise-triage`
- when the correct outcome is to kill or recommit the hypothesis; use `/skill:kill-or-ship`
- as a ritual after you already made the claim
- as a substitute for earlier rigor

## The Gate Function

```text
BEFORE any publication claim:

1. IDENTIFY the exact hypothesis and exact sentence.
2. LOAD the authoritative repo state.
3. VERIFY every dependency under the claim.
4. READ the actual files and outputs.
5. DECIDE: publishable or blocked.
6. ONLY THEN make the claim.

Skip any step = not verified.
Run a comfortable subset = not verified.
Reuse old output = not verified.
```

## Quick Reference

| Need | API or file | Rule |
| --- | --- | --- |
| Repo scaffold | `loadRepoState(cwd)` | Start from current repo state, not memory |
| Hypothesis registry | `loadHypotheses(cwd)`, `parseHypotheses(content)`, `getActiveHypothesis(entries)` | Identify the exact live record |
| Hypothesis persistence | `hypothesisToMarkdown(h)`, `saveHypotheses(cwd, entries)`, `updateHypothesisStatus(cwd, id, status)` | Status follows evidence, never aspiration |
| Baseline metadata | `loadBaselines(cwd)`, `getBaselineAgeDays(b)` | Stale baselines cannot support publication comparisons |
| Spend totals | `getHypothesisSpend(cwd, id)`, `getHypothesisSpendByCategory(cwd, id)`, `getAllHypothesisSpends(cwd)` | Compare total and category spend against the cap before claiming success |
| Ledger repair | `appendCostRecord(cwd, record)` | Only for real omitted events, never fiction |
| Judge lock | `computeJudgeHash(judgeRef, id)`, `getJudgeLock(cwd, id)`, `writeJudgeLock(cwd, id, judgeRef)` | Recompute and compare; existence alone proves nothing |
| Environment lock | `getEnvironmentLock(cwd, id)`, `computeEnvironmentHash(...)` | Required when `computeTarget` is `docker` or `modal` |
| Cross-run lessons | `loadLessons(cwd)`, `summarizeLessons(lessons)` | Review prior killed or pivoted patterns before finalizing |
| Artifact checks | `fileExists(path)` | Missing files block publication when they are required evidence |
| Adversarial review | `runFalsificationAdversary({ claim, cwd, hypothesisId })` | Missing or stale verdicts must be refreshed before publication |
| Canonical files | `HYPOTHESES.md`, `BASELINES.md`, `RESULTS.md`, `OVERRIDES.md`, `.epistemic/cost-ledger.jsonl`, `alternatives/`, `experiments/{id}/...` | Publication is a repo-level decision, not a headline-only decision |

## Publication Checklist

Before any publication claim, every box below MUST be checked:

- [ ] `experiments/{id}/prereg.md` exists and still matches the claim being published.
- [ ] `computeJudgeHash(judgeRef, id)` matches `getJudgeLock(cwd, id)` and `experiments/{id}/judge.lock` exists.
- [ ] `environment.lock` matches the current `Dockerfile` + `requirements.txt` when `computeTarget` is `docker` or `modal`.
- [ ] HF dataset revisions are pinned and verified; no `main`, `latest`, or implied moving snapshot survives into the claim.
- [ ] All required baselines from `BASELINES.md` are fresh, reproduced, and younger than 30 days.
- [ ] Competing hypotheses from the research-question phase are documented in `alternatives/`.
- [ ] All falsifier verdicts are written to `experiments/{id}/falsifiers/{model}.md` and actually evaluated.
- [ ] No surprising number remains pending triage in `smokes/` or `experiments/{id}/smokes/`.
- [ ] `.epistemic/cost-ledger.jsonl` is current and the spend still fits the governing decision.
- [ ] Compute costs are tracked in the ledger with `category: "compute"` whenever compute was used.
- [ ] Total spend has been compared against `costCap`; if total spend is above 80% of the cap without confirmed results, that warning has been surfaced explicitly.
- [ ] Cross-run lessons have been reviewed for relevant patterns.
- [ ] If `summarizeLessons()` shows similar prior failure patterns, explicit justification explains why this hypothesis is materially different.
- [ ] Statistical rigor checks are complete: assumptions, effect sizes, and multiple-comparison corrections when applicable.
- [ ] `RESULTS.md` and `experiments/{id}/RESULTS.md` contain confirmed, falsification-passed results only.
- [ ] Nothing provisional, killed, unreproduced, or overridden without written reason is being presented as final.

## The Process

### 1. Identify the exact publication unit

1. Call `loadHypotheses(cwd)`.
2. If one active hypothesis exists, use `getActiveHypothesis(entries)`.
3. If several records could match, select the exact `id` explicitly.
4. Read the selected `HypothesisEntry` and capture `claim`, `falsifier`, `bestCaseConclusion`, `judgeRef`, `baselineRef`, `costCap`, `computeTarget`, and `status`.
5. Name the exact sentence you are about to publish.
6. Name the exact file or communication channel that will carry it.
7. If you cannot identify the exact publication unit, stop.
8. Vague targets produce vague verification, and vague verification ships false claims.

### 2. Load the authoritative repo state

1. Call `loadRepoState(cwd)`.
2. Read `HYPOTHESES.md`, `BASELINES.md`, and root `RESULTS.md`.
3. Read `experiments/{id}/RESULTS.md` when it exists.
4. Read `OVERRIDES.md` when any gate was bypassed.
5. Read `experiments/{id}/KILLED.md` when the hypothesis ever looked terminal.
6. Read `alternatives/` and confirm the competing explanations from question formation were preserved instead of silently forgotten.
7. If `HYPOTHESES.md` looks manually edited or suspicious, rerun `parseHypotheses(content)` on the raw markdown.
8. Publication review starts from current repo state, not memory and not the cleanest-looking artifact.

### 3. Verify preregistration and the locked evaluation contract

1. Compute `experiments/{id}/prereg.md`.
2. Use `fileExists(path)`.
3. If the prereg file is missing, publication is blocked.
4. Read the prereg file.
5. Confirm the prereg claim still matches the publication claim.
6. Confirm the prereg falsifier still matches the failure condition being claimed against.
7. Confirm the result stays inside prereg scope.
8. Take the current `judgeRef` from the hypothesis entry.
9. Read the lock with `getJudgeLock(cwd, id)`.
10. Recompute `computeJudgeHash(judgeRef, id)`.
11. If the lock is missing or mismatched, you have judge drift and publication is blocked.
12. If `computeTarget` is `docker` or `modal`, read `getEnvironmentLock(cwd, id)` and compare it against the current environment hash derived from the active `Dockerfile` and `requirements.txt`.
13. If the environment lock is missing or mismatched, publication is blocked.
14. Same claim under a different judge, different container, or different dependency set is a different experiment.

### 4. Verify reproducibility substrate: datasets, baselines, and alternatives

1. Read the experiment artifacts closely enough to identify the exact dataset source, split, and revision.
2. HF datasets must be pinned to a concrete revision, commit, snapshot, or equivalent immutable identifier.
3. Reject `main`, `latest`, and implicit current-state pulls.
4. Confirm the reported result was actually produced against the pinned revision, not just described that way afterward.
5. Load baselines with `loadBaselines(cwd)`.
6. Find every baseline the claim depends on.
7. Compute age with `getBaselineAgeDays(entry)`.
8. If any required baseline is 30 days old or older, it is stale and cannot support publication comparisons.
9. Read `experiments/{id}/baselines/{name}.md` when present.
10. If the claim says `beats X`, verify `X` was reproduced, not merely cited.
11. Read `alternatives/` and confirm the competing hypotheses from the research-question phase are documented there.
12. If the alternatives are missing, publication is blocked for any claim that talks as though rival explanations were already ruled out.

### 5. Verify falsifier coverage and surprise handling

1. Inspect `experiments/{id}/falsifiers/`.
2. Read every `experiments/{id}/falsifiers/{model}.md` file.
3. If a required verdict file is missing or stale, run `runFalsificationAdversary({ claim, cwd, hypothesisId: id })`.
4. Persist the returned `AdversaryVerdict` records before relying on them.
5. Read the persisted verdicts back.
6. If any verdict is `falsified-or-unreproducible`, publication is blocked.
7. If any verdict is `cannot-audit`, publication is blocked until the audit gap is fixed or explicitly overridden.
8. If any verdict is `caveat-required`, the caveat must travel with the claim.
9. Inspect `smokes/` and `experiments/{id}/smokes/`.
10. Any number living only there is provisional.
11. Provisional numbers do not belong in headline files, drafts, PRs, or confident status updates.
12. If the delta is surprising, route through `/skill:surprise-triage` first.
13. If surprise triage is incomplete, publication is blocked.

### 6. Verify ledger integrity and budget pressure

1. Read `.epistemic/cost-ledger.jsonl`.
2. Call `getHypothesisSpend(cwd, id)` for the total.
3. Call `getHypothesisSpendByCategory(cwd, id)` for the split between `llm` and `compute`.
4. If shared portfolio context matters, also call `getAllHypothesisSpends(cwd)`.
5. Confirm the ledger reflects all current work.
6. Confirm compute-backed work produced ledger rows with `category: "compute"`.
7. If compute was used but compute spend is absent, publication is blocked.
8. Compare `totalSpend = llm + compute` against `costCap`.
9. If total spend is above 80% of the cap and there is still no confirmed result in `experiments/{id}/RESULTS.md`, surface the warning explicitly.
10. Use plain language. Example: `This hypothesis has already consumed more than 80% of its cap without confirmed results. Are you resolving uncertainty, or defending sunk cost?`
11. If spend is above the cap, publication review must account for the overrun directly; do not hide behind a flattering number.
12. If ledger history is incomplete, the claim is not auditable.
13. Use `appendCostRecord(...)` only to record a real omitted event.
14. Do not backfill fiction to make publication easier.

### 7. Run the cross-run lessons check before finalizing

1. Before finalizing, call `loadLessons(cwd)` from `src/state/repo.ts`.
2. If lessons exist, call `summarizeLessons(lessons)`.
3. Read the recent failures as decision support, not as decoration.
4. Surface relevant patterns directly to the researcher before publication.
5. If recent killed or pivoted hypotheses rhyme with the current one, say it out loud.
6. Example: `Your last 3 hypotheses failed at cost overrun — are you confident this one is different?`
7. Treat repeated outcomes such as `COST_OVERRUN`, `UNREPRODUCIBLE_BASELINE`, judge drift, stale environment, or clearly similar root causes as a pattern match.
8. If `summarizeLessons()` shows similar failure patterns, require explicit justification before finalizing.
9. No justification, no publication.
10. The point is not to shame the current run. The point is to stop the same failure from earning a new headline.

### 8. Verify statistical rigor before wording hardens into a claim

1. Read the analysis outputs, not just the conclusion sentence.
2. Confirm the statistical assumptions behind the reported summary still hold well enough to support the claim.
3. Confirm effect sizes are reported and interpreted, not replaced by binary `won/lost` language.
4. Confirm uncertainty is visible where it matters: intervals, dispersion, variance, or other appropriate uncertainty summaries.
5. If multiple hypotheses, metrics, slices, or subgroup comparisons were tested, confirm the correction policy was applied or explain why it was unnecessary.
6. If the preregistered analysis changed, publication is blocked until the drift is reconciled.
7. If the only thing supporting the headline is a fragile significance result with no effect-size discipline, publication is blocked.
8. Statistical rigor is part of verification, not optional polish.

### 9. Verify the results files and decide from evidence

1. Read root `RESULTS.md`.
2. Read `experiments/{id}/RESULTS.md` when it exists.
3. Confirm every published number is within prereg scope.
4. Confirm every published number used the locked judge.
5. Confirm every published number used the locked environment when compute is containerized.
6. Confirm every published comparison uses fresh reproduced baselines and pinned datasets.
7. Confirm every published headline survived falsifier review.
8. Confirm no smoke-only number was copied into a final file.
9. Confirm no killed, provisional, or overruled result is being presented as confirmed.
10. If every check passed, the result is eligible for publication.
11. Only then may `updateHypothesisStatus(cwd, id, "CONFIRMED")` be called when warranted.
12. If any check failed, block the claim plainly.
13. If the hypothesis is dead, route to `/skill:kill-or-ship` and write `experiments/{id}/KILLED.md`.
14. Publication review ends in one of two states: publishable or blocked.

## Full Verification Suite

Run the whole suite every time.
Do not skip the checks that feel administrative.
Those are the checks that stop embarrassing claims.

```text
1. loadHypotheses(cwd)
2. getActiveHypothesis(entries) or select explicit id
3. loadRepoState(cwd)
4. read HYPOTHESES.md, BASELINES.md, RESULTS.md, OVERRIDES.md when relevant
5. inspect alternatives/
6. fileExists(`experiments/${id}/prereg.md`)
7. read `experiments/${id}/prereg.md`
8. getJudgeLock(cwd, id)
9. computeJudgeHash(judgeRef, id)
10. if docker/modal: getEnvironmentLock(cwd, id) + compare against current Dockerfile/requirements hash
11. verify HF dataset revisions are pinned and match the run artifacts
12. loadBaselines(cwd)
13. getBaselineAgeDays(b) for each required baseline
14. read `experiments/${id}/baselines/{name}.md` when present
15. read `experiments/${id}/falsifiers/{model}.md`
16. runFalsificationAdversary(...) if verdicts are missing or stale
17. inspect `smokes/` and `experiments/${id}/smokes/`
18. read `.epistemic/cost-ledger.jsonl`
19. getHypothesisSpend(cwd, id)
20. getHypothesisSpendByCategory(cwd, id)
21. call loadLessons(cwd)
22. call summarizeLessons(lessons) when lessons exist
23. verify statistical rigor checks
24. read `experiments/${id}/RESULTS.md` when present
25. update status only after the full suite passes
26. only then make the claim
```

## Common Failures

| Failure | What actually happened | Correct response |
| --- | --- | --- |
| Claimed from `RESULTS.md` alone | Verified the headline, not the chain | Run the full suite |
| Verified `judge.lock` and stopped | Checked one lock and ignored the rest of the contract | Continue through environment, datasets, baselines, costs, and falsifiers |
| Environment drifted under Docker or Modal | Same code ran in a different dependency world | Recompute the environment lock and block publication |
| Used an unpinned HF dataset revision | Compared against a moving target | Pin and verify the exact dataset revision |
| Used a cited baseline as a reproduced baseline | Collapsed sourcing into reproduction | Reproduce or drop the comparison |
| Logged only LLM spend | Hid the real bill by ignoring compute | Record compute rows with `category: "compute"` |
| Burned >80% of cap with no confirmed result and kept pushing | Let sunk cost masquerade as confidence | Surface the warning and reassess the claim |
| Ignored cross-run lessons | Repeated an old failure with cleaner prose | Review `loadLessons()` and require justification |
| Wrote no competing hypotheses to `alternatives/` | Pretended the winning story had no rivals | Document the rivals or narrow the claim |
| Reported significance without effect sizes or corrections | Turned statistics into decoration | Repair the analysis before publication |
| Copied a smoke number into a final file | Promoted provisional evidence | Triage first |
| Marked status `CONFIRMED` early | Used state as aspiration | Let evidence determine status |

## Rationalization Prevention

| Excuse | Reality |
| --- | --- |
| `The result is already written down.` | Files can be wrong. Verify the evidence chain. |
| `The judge only changed a little.` | Small drift is still drift. |
| `The container only changed a little.` | Different dependencies are different method conditions. |
| `The dataset revision is probably the same.` | `Probably` is not reproducibility. Pin it. |
| `The baseline is famous.` | Fame is not reproduction. |
| `Compute is infrastructure, not experiment cost.` | If it burned money to produce evidence, it is experiment cost. |
| `We are still under cap, technically.` | 81% burned with no confirmed result is already a warning sign. |
| `The old failures were about different wording.` | Pattern repetition matters more than wording repetition. |
| `Those lessons do not really apply.` | Then write the explicit justification for why this run is different. |
| `The alternatives were obvious.` | If they are not in `alternatives/`, they are not part of the record. |
| `The p-value is enough.` | Without effect size discipline and correction policy, it is not enough. |
| `The smoke run looks stable.` | Smoke evidence is still provisional. |
| `This is just an internal summary.` | Internal falsehood becomes external fast. |
| `I only changed wording.` | Wording can widen the claim faster than evidence can support it. |

## Red Flags - STOP

Stop immediately if any of these thoughts show up:
- `Probably ready.`
- `Good enough.`
- `Close enough.`
- `The environment drift is cosmetic.`
- `The dataset pin can wait until release.`
- `Compute spend does not need to be itemized.`
- `We have enough left in the cap, probably.`
- `The old lessons are not relevant this time.`
- `I do not need to show the alternatives.`
- `The p-value is all anyone will ask for.`
- `The smoke number is basically confirmed.`
- `I can fix the ledger afterward.`
- `Nobody will ask how this was verified.`
- `I need the conclusion now.`

All of these mean the same thing:
you are trying to publish faster than you are verifying.

## Good vs Bad

### Good: compare lock, environment, and budget pressure before the claim

```ts
const entries = await loadHypotheses(cwd);
const h = getActiveHypothesis(entries);
if (!h) throw new Error("No active hypothesis");

const judgeLock = await getJudgeLock(cwd, h.id);
const expectedJudge = computeJudgeHash(h.judgeRef, h.id);
if (!judgeLock || judgeLock !== expectedJudge) {
  throw new Error(`Judge drift for ${h.id}`);
}

if (h.computeTarget === "docker" || h.computeTarget === "modal") {
  const envLock = await getEnvironmentLock(cwd, h.id);
  if (!envLock) throw new Error(`Missing environment.lock for ${h.id}`);
}

const spend = await getHypothesisSpendByCategory(cwd, h.id);
const total = spend.llm + spend.compute;
if (total > h.costCap * 0.8) {
  console.warn("High budget pressure before publication review.");
}
```

### Bad: treat existence and vibes as verification

```ts
if (await getJudgeLock(cwd, id)) console.log("lock exists");
console.log("budget should still be fine");
console.log("the dataset is probably unchanged");
```

### Good: run the cross-run lessons check before finalizing

```ts
const lessons = await loadLessons(cwd);
const lessonSummary = summarizeLessons(lessons);
console.log(lessonSummary);
// If the pattern rhymes with this run, require explicit justification before publishing.
```

**Good because:** publication is being tested against prior repo memory, not just the current run's optimism.

### Bad: ignore the repo's own memory

```text
This result looks stronger than the last few, so I do not need to review prior failures.
```

**Bad because:** that is how repeated failure patterns get renamed into progress.

## Why This Matters

Publication failures rarely start with a giant bug.
They start with one skipped check, then another, then a sentence that sounded safe because the number looked clean.

A judge mismatch turns the result into a different experiment.
An environment mismatch turns reproducibility into theater.
A drifting dataset revision turns a benchmark into a moving target.
A stale baseline turns comparison into fiction.
An ignored falsifier turns review into ceremony.
A missing compute row turns cost governance into storytelling.
An unreviewed lesson log turns recurring failure into institutional amnesia.
An undocumented alternative turns one surviving story into an overclaimed conclusion.
Weak statistical discipline turns a number into decoration.

This gate exists to stop last-mile dishonesty.
Not dramatic dishonesty.
Ordinary rushed dishonesty.
The kind that says `we basically verified it`.
Do not do that.

## The Bottom Line

A claim is ready when it survives the full suite.
Not when it feels ready.
Not when the graph looks nice.
Not when the cap is almost gone.
Not when the previous failures are inconvenient.

Read the repo.
Run the gate.
Surface the warnings.
Require the justification.
Then publish.
