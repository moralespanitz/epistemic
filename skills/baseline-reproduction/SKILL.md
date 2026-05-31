---
name: baseline-reproduction
description: Use when a claim, result, or draft compares your system against an external baseline or published number.
---

> **Related skills:** `/skill:research-question`, `/skill:preregistration`, `/skill:judge-lock`, `/skill:experiment-execution`, `/skill:falsification-review`

# Baseline Reproduction

## Overview
Most fake wins are not fabricated numbers.
They are contract mismatches wrapped in confident prose.
The usual move is simple:
you run your system live,
then compare it to a number you did not produce.
Now your side is evidence and their side is hearsay.
That is not a comparison.
In this repo, baseline work is anchored to `HYPOTHESES.md`, `experiments/{id}/prereg.md`, `experiments/{id}/judge.lock`, and `experiments/{id}/baselines/{name}.md`.
Use the state helpers in `src/state/repo.ts` to stay honest:
`loadHypotheses(cwd)`,
`getActiveHypothesis(entries)`,
`getJudgeLock(cwd, hypothesisId)`,
`computeJudgeHash(judgeRef, hypothesisId)`,
`loadBaselines(cwd)`,
`getBaselineAgeDays(b)`,
and `fileExists(path)`.
Core principle: the only baseline you may quote is the one you ran yourself under the locked judge on the registered split.

## The Iron Law

```text
You cannot claim to beat X until you've run X yourself.
```

If the number came from a paper, a README, a leaderboard, or memory, treat it as a lead.
Do not treat it as your baseline.

## When to Use
Use this skill before you write any sentence shaped like:
- "We beat X."
- "We outperform Y."
- "We are competitive with Z."
- "Our score closes the gap to X."
- "This matches the published baseline."
Use it when `HypothesisEntry.baselineRef` in `HYPOTHESES.md` points at a competitor, paper, or public number.
Use it before writing comparison language into `experiments/{id}/RESULTS.md`, a draft, a PR description, or an internal decision memo.
Use it when you inherited an old reproduction and need to know whether it is still quoteable.
Use it when a baseline result influences go/no-go, ship/no-ship, or model selection.
Use it even when the competitor provides open weights or a clean repo.
Open code reduces friction.
It does not remove the need to run the baseline under your own judge.
Use it again whenever the baseline is older than 30 days.
Freshness is part of validity here.

## When NOT to Use
Do not use this skill while the question is still vague.
Use `/skill:research-question` first.
Do not use this skill before `experiments/{id}/prereg.md` exists.
Use `/skill:preregistration` first.
Do not use this skill for internal ablations already scored under the same locked judge in the same run family.
Do not use this skill to rescue a comparison claim after you already wrote it.
Delete the unsupported claim first.
Then reproduce the baseline.
Do not use this skill as a paper-reading substitute.
Reading is input gathering.
Baseline reproduction is evidence generation.

## What Counts as a Reproduced Baseline
A reproduced baseline means you executed the competitor system or a faithful implementation yourself.
It means the score was produced under the locked judge for the active hypothesis.
It means you can point to the exact code, version, split, metric, and command that produced the number.
It means the evidence lives in `experiments/{id}/baselines/{name}.md`.
It means you verified `experiments/{id}/judge.lock` instead of assuming it was fine.
It means a stale note older than 30 days gets refreshed before you quote it.
It means you preserve mismatches between the source score and your reproduced score instead of hiding them.
If you cannot do all of that, you do not have a reproduced baseline yet.

## The Process

### 1. Anchor the work to the active hypothesis
1. Call `loadHypotheses(cwd)`.
2. Call `getActiveHypothesis(entries)`.
3. If it returns nothing, stop.
4. No active hypothesis means no legitimate place to attach a baseline comparison.
5. Read the active `HypothesisEntry` carefully: `id`, `claim`, `judgeRef`, `baselineRef`, `costCap`, and `status`.
6. Treat `baselineRef` as a lead, not proof.
7. Read `HYPOTHESES.md` and `experiments/{id}/prereg.md`.
8. Confirm the preregistered claim actually depends on the baseline you are about to reproduce.
9. If the prereg names baseline X and you switch to Y because Y is easier to run, stop.
10. That is already drift.
11. Create a stable `{name}` for `experiments/{id}/baselines/{name}.md`.
12. Keep the name boring and specific.
13. You are building an audit trail, not a brand.

### 2. Locate the competitor source you are actually reproducing
1. Start from the strongest source you can execute.
2. Prefer official code with a pinned release, tag, or commit.
3. If code is absent or broken, fall back to the paper appendix, benchmark card, or exact evaluation table.
4. Capture the exact source URL you used, not a home page.
5. Record the reported score from that source.
6. Record the metric.
7. Record the dataset and split.
8. Record the system name and exact version.
9. Version means tag, commit hash, checkpoint name, API model snapshot, or release identifier.
10. `latest`, `main`, and `current` are not versions.
11. If the source does not disclose versioning, write `unknown` and say why.
12. Find any original judge, rubric, or grading procedure the source used.
13. Find preprocessing, filtering, or retry behavior that could change scoring.
14. If you cannot identify split or metric, you do not have enough for a strong comparison claim.

### 3. Verify the locked judge before touching numbers
1. Call `getJudgeLock(cwd, active.id)`.
2. If it returns `null`, stop.
3. A missing lock means your evaluator is not stabilized yet.
4. Compute the expected hash with `computeJudgeHash(active.judgeRef, active.id)`.
5. Compare that hash against the contents of `experiments/{id}/judge.lock`.
6. They must match exactly.
7. If they do not match, stop immediately.
8. Do not run a quick baseline under a drifted evaluator just to unblock yourself.
9. Record `active.judgeRef` in your baseline note.
10. Record the verified lock hash in your baseline note.
11. If the source used a different original judge, note it as context.
12. Your quoteable baseline is still the score you reproduce under your lock.
13. Never call `writeJudgeLock(...)` here just to paper over drift.
14. Missing or mismatched locks are methodology failures, not clerical issues.

### 4. Normalize the evaluation contract
1. Write down the full contract before you run anything.
2. Include task, dataset, split, metric, judge, prompt, temperature, seed, version, and filtering rules.
3. Match the split first.
4. Dev is not test.
5. Validation is not held-out.
6. Match the metric second.
7. Accuracy, pass rate, pairwise preference, and win rate are different claims.
8. Match the judge third.
9. `active.judgeRef` is the contract you are trying to preserve.
10. Match prompt and rubric if model-as-judge scoring is involved.
11. Match sampling settings.
12. Best-of-n vs single-shot can manufacture gains.
13. Match preprocessing and failure handling.
14. If one side drops refusals, timeouts, or malformed outputs and the other side does not, the score is contaminated.
15. If you cannot align the contracts honestly, write `not comparable` and stop pretending it is head-to-head.

### 5. Check for prior reproductions and freshness
1. Look for an existing artifact at `experiments/{id}/baselines/{name}.md`.
2. Use `fileExists(path)` if you need a direct existence check.
3. If the note exists, read it fully.
4. Existing is not the same as valid.
5. Confirm it records score, version, retrieved date, source URL, split, metric, judge, and the full reproduction command.
6. If any of that is missing, refresh it.
7. If the repo also maintains `BASELINES.md`, call `loadBaselines(cwd)`.
8. Find the matching `BaselineEntry`.
9. Call `getBaselineAgeDays(entry)`.
10. If the age is greater than 30, the baseline is stale.
11. Stale means you must refresh before quoting it.
12. Not "probably still fine."
13. Providers drift silently.
14. Dataset revisions drift silently.
15. That is why freshness is enforced.

### 6. Run the competitor baseline under your contract
1. Use the official implementation when you can inspect and pin it.
2. If you must port or reimplement it, keep the port faithful and boring.
3. Do not optimize the baseline.
4. Do not quietly fix its prompts, swap in a friendlier judge, or tune its settings until it loses less gracefully.
5. Capture the exact reproduction command.
6. Include flags, model IDs, seeds, config files, dataset selectors, and environment variables that materially affect the result.
7. Record package versions, commit hashes, model snapshots, and dataset revisions that affect reproducibility.
8. If the run fails, record the failure.
9. Do not fall back to the paper number.
10. Failure to reproduce is still a result.
11. If the reproduced score differs from the source score, preserve both.
12. The only number you may use for a claim is the reproduced score under your locked judge.

### 7. Write the baseline artifact immediately
1. Write `experiments/{id}/baselines/{name}.md` as soon as the run ends.
2. Do not wait until after you run your own system.
3. Memory is where provenance goes to die.
4. Record the exact score.
5. Record the exact version you ran.
6. Record the date retrieved.
7. Record the source URL.
8. Record the dataset and split.
9. Record the metric.
10. Record `active.judgeRef`.
11. Record the verified `judge.lock` hash.
12. Record the full reproduction command.
13. Record any material contract differences from the source.
14. Record whether the baseline is quoteable right now.
15. If it is not quoteable, say why in plain language.
16. Unknown fields must be written as `unknown`, not omitted.

### 8. Quote the reproduced number, not the flattering one
1. Compare against the score you produced, not the prettiest number in the literature.
2. If your reproduction is stronger than the paper number, use the stronger reproduced number.
3. If your reproduction is weaker than the paper number, use the weaker reproduced number.
4. If the contracts are not comparable, write `not comparable`.
5. If the baseline kills your win, accept that outcome.
6. Update the claim in `HYPOTHESES.md` or downstream result drafts if the reproduced baseline changes the story.
7. When `runFalsificationAdversary({ claim, cwd, hypothesisId })` from `src/adversary/dispatch.ts` attacks your claim, it should find evidence instead of folklore.
8. Move on only when the baseline artifact can survive hostile reading.

## What Must Be in `experiments/{id}/baselines/{name}.md`
Use a structure that makes missing provenance obvious.
Do not hide uncertainty in prose.
Make the unknowns explicit.

```md
# Baseline: <name>

- **Hypothesis ID:** <id>
- **Claim under test:** <claim>
- **Source URL:** <url>
- **Competitor version:** <tag|commit|checkpoint|snapshot|unknown>
- **Date retrieved:** <YYYY-MM-DD>
- **Task:** <task>
- **Dataset:** <dataset>
- **Split:** <split>
- **Metric:** <metric>
- **Judge ref:** <active.judgeRef>
- **Judge lock hash:** <contents of experiments/{id}/judge.lock>
- **Source score:** <reported number or not stated>
- **Reproduced score:** <measured number or failed to reproduce>
- **Reproduction command:** `<full command>`
- **Environment pins:** <versions, commit hashes, dataset revision>
- **Contract differences:** <none or exact differences>
- **Quoteable:** <yes|no>
- **Quoteability reason:** <why>

## Notes
<plain-language explanation of mismatches, failures, or caveats>
```

If you also mirror the baseline into a repo-level `BASELINES.md`, keep it parseable by `loadBaselines(cwd)`.
That means fields compatible with `BaselineEntry`: `name`, `url`, `score`, `judge`, `version`, and `retrieved`.
The durable per-experiment artifact is still `experiments/{id}/baselines/{name}.md`.
That file is the primary evidence.

## Common Failure Modes

### Version mismatch
If the source claims `v2.1` and you ran `latest`, you did not reproduce the baseline.
If the repo has no tags, record the commit hash you used.
If you cannot identify any stable version at all, write `unknown` and downgrade the claim.
Do not pretend an unversioned run is equivalent to the published number.

### Different judge
A different judge is a different experiment.
Human preference, a provider eval, and `active.judgeRef` are not interchangeable.
Re-score under your lock or drop the head-to-head claim.
This is why `getJudgeLock(...)` and `computeJudgeHash(...)` exist.

### Different test split
A dev-set number is not a test-set number.
A validation subset is not a preregistered held-out split.
If the competitor only reports dev and your claim is about test, say the comparison is not apples-to-apples.
Do not quietly treat them as equivalent.

### Metric drift
Top-1 accuracy is not best-of-n accuracy.
Binary pass rate is not pairwise preference.
Macro average is not micro average.
If the metric moved, the baseline moved.

### Prompt or rubric drift
For LLM-as-judge setups, prompt edits are evaluator changes.
So are rubric changes.
So are temperature and seed changes when they affect stochasticity.
A tiny prompt tweak can create a fake win larger than the model change you are studying.

### Hidden filtering
If you drop timeouts, refusals, or malformed outputs differently across systems, the score is contaminated.
State the filtering rule explicitly.
Apply it symmetrically.
If you cannot, the baseline is not quoteable.

### Stale reproduction
A note that was valid 45 days ago is not automatically valid today.
If `getBaselineAgeDays(entry) > 30`, refresh it before quoting.
Do not guess that nothing changed upstream.
Silence is not stability.

### Paper-only evidence
A paper number without a local run is context, not a baseline.
You may cite it as published context.
You may not use it as the thing you beat.
That is the whole discipline.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "The paper already reports the number." | Reported is not reproduced. You still have not run X yourself. |
| "Their code is open, so citation is enough." | Open code helps execution. It does not replace execution. |
| "The judge difference is small." | Small evaluator drift routinely swamps claimed gains. |
| "I used the same dataset, close enough." | Same dataset with a different split, filter, or metric is not close enough. |
| "The old reproduction is probably still valid." | `getBaselineAgeDays(...) > 30` means refresh before quoting. |
| "I only need this for a slide." | A false claim is false before it reaches a paper. |
| "Their repo does not pin versions, so this is impossible." | Then record the ambiguity and refuse the strong claim. |
| "My system beats their paper number either way." | That is exactly when lazy baselines create fake wins. |
| "I can reproduce it after I finish my own run." | Then you are incentivized to move the baseline to fit the story. |
| "The artifact already exists." | Existing and quoteable are different states. Check completeness, lock, and freshness. |
| "Using the source score is more conservative." | No. Use the score you actually measured under your contract. |

## Red Flags - STOP
Stop if `getActiveHypothesis(...)` returns nothing.
Stop if `experiments/{id}/prereg.md` is missing.
Stop if the prereg does not name the baseline you are trying to beat.
Stop if `getJudgeLock(cwd, id)` returns `null`.
Stop if `computeJudgeHash(active.judgeRef, active.id)` does not match `experiments/{id}/judge.lock`.
Stop if you cannot state the competitor version you ran.
Stop if you cannot state the dataset split.
Stop if you cannot produce the exact reproduction command.
Stop if the only number you have is from a paper PDF.
Stop if the previous reproduction is older than 30 days and you are about to quote it anyway.
Stop if you changed prompts, filters, or sampling because the original setup was inconvenient.
Stop if you are comparing your locked-judge score to their original human-judge number.
Stop if you are tempted to say "close enough."
All of these mean the comparison is not ready to quote.

## Good vs Bad

### Good: verify the lock before you run
Good:
"I called `getJudgeLock(cwd, id)`, recomputed `computeJudgeHash(active.judgeRef, active.id)`, and only ran the baseline after the hashes matched."
Bad:
"The lock file probably has not changed, so I just ran it."

### Good: use the reproduced score even when it hurts
Good:
"The source reports 84.1, but my locked-judge reproduction is 86.4, so the comparison uses 86.4."
Bad:
"The paper headline is lower, so I used that to stay consistent with the literature."

### Good: refresh stale evidence
Good:
"`loadBaselines(cwd)` found a prior `BaselineEntry`, but `getBaselineAgeDays(entry)` returned 47, so I refreshed before quoting it."
Bad:
"We reproduced that last month. Good enough."

### Good: reject mismatched contracts
Good:
"The competitor reports dev-set human ratings, while this hypothesis is about test-set locked-judge win rate, so I recorded the source and marked the comparison `not comparable`."
Bad:
"The tasks are similar, so the comparison is directionally fair."

### Good: document failure to reproduce
Good:
"The official repo no longer resolves its pinned dependency set. I recorded the exact failure mode, version ambiguity, and why the baseline is currently unreproduced."
Bad:
"The repo is broken, but the paper number is probably fine."

## Why This Matters
Most bogus ML wins are not obvious fraud.
They are baseline discipline failures.
A different judge, a different split, a stale artifact, or a hand-waved version is enough to manufacture progress that is not real.
Baseline reproduction forces the comparison onto one contract.
It prevents you from optimizing your own system against folklore.
It gives later stages clean evidence.
It makes `runFalsificationAdversary(...)` work on real artifacts instead of vibes.
And it saves you from shipping a claim that only existed because nobody made you run X yourself.

After this, use `/skill:experiment-execution`
