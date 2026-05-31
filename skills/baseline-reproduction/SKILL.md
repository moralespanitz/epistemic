---
name: baseline-reproduction
description: Use when a claim, result, or draft compares your system against an external baseline, published paper number, or competitor result and you need a sourced local reproduction before quoting it.
---

> **Related skills:** `/skill:research-question`, `/skill:preregistration`, `/skill:experiment-execution`, `/skill:falsification-review`, `/skill:verification-before-publication`

# Baseline Reproduction

## Overview
A baseline is not a number you remember.
It is a chain of evidence you can inspect.

This skill has two hard steps, in order:
1. extract the competitor claim from the source paper or official artifact
2. reproduce that baseline yourself under the active hypothesis and locked judge

Skip step 1 and you compare against a paraphrase.
Skip step 2 and you compare against hearsay.
Either way, the claim is not fit to quote.

In this repo, baseline work should leave two artifacts:
- `baselines/{name}.md` — source note with the paper URL, extracted claim, dataset provenance, Hugging Face validation, and pinned revisions
- `experiments/{id}/baselines/{name}.md` — reproduction note with the exact run you executed under the active hypothesis and locked judge

Use the state helpers in `src/state/repo.ts` to stay honest:
`loadHypotheses(cwd)`, `getActiveHypothesis(entries)`, `getJudgeLock(cwd, id)`, `computeJudgeHash(judgeRef, id)`, `loadBaselines(cwd)`, `getBaselineAgeDays(entry)`, and `fileExists(path)`.

Core principle: the only baseline you may quote is the one whose source claim you extracted yourself and whose score you reproduced yourself.

## Quick Reference
| Need | Tool or file | Rule |
| --- | --- | --- |
| Active experiment | `loadHypotheses(cwd)` + `getActiveHypothesis(entries)` | No active hypothesis, no baseline claim |
| Competitor paper | AlphaXiv `alpha` CLI | Find the actual paper before touching the number |
| Long paper | `alpha get paper --section results` | Read the results section first, then the full paper only if needed |
| Source note | `baselines/{name}.md` | Save the paper URL and extracted claim before reproduction |
| Judge integrity | `getJudgeLock(cwd, id)` + `computeJudgeHash(judgeRef, id)` | Missing or drifted lock blocks the run |
| HF dataset metadata | `hf_dataset_info` | Verify existence, splits, features, access status, and `sha` |
| HF dataset tree | `hf_repo_files` | Inspect repo structure before assuming files or configs |
| HF access gate | `HF_TOKEN` | Gated dataset without `HF_TOKEN` means stop |
| Drift detection | pinned dataset revision | Record commit SHA or revision tag, never floating `main` |
| Local evidence | `experiments/{id}/baselines/{name}.md` | Only the reproduced number is quoteable |

## The Iron Law

```text
NO COMPETITOR NUMBER WITHOUT SOURCE EXTRACTION AND LOCAL REPRODUCTION
```

A paper number is context until you extract it from the source.
A source-extracted number is still context until you reproduce it.
Only the reproduced score under your locked contract is a baseline.

## When to Use
Use this skill before you write any sentence shaped like:
- "We beat X."
- "We outperform Y."
- "We match the published baseline."
- "Our score closes the gap to Z."
- "This is competitive with the paper result."

Use it when `HypothesisEntry.baselineRef` in `HYPOTHESES.md` points at a paper, competitor repo, benchmark card, leaderboard number, or public checkpoint.
Use it before writing comparison language into `experiments/{id}/RESULTS.md`, a draft, a PR description, or a decision memo.
Use it when you inherit an old reproduction and need to know whether it is still quoteable.
Use it again whenever the source note or reproduction note is older than 30 days.
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
A reproduced baseline means all of this is true:
- you identified the active hypothesis and the exact comparison target
- you extracted the reported figure directly from the competitor paper or official source
- that extraction is written to `baselines/{name}.md`
- if the source used a Hugging Face dataset, you validated it with `hf_dataset_info` and `hf_repo_files`
- if the source used a Hugging Face dataset, you pinned the dataset commit SHA or revision tag
- you verified `experiments/{id}/judge.lock` instead of assuming it was fine
- you executed the competitor system or a faithful implementation yourself
- the score was produced under the locked judge for the active hypothesis
- you can point to the exact code, version, dataset split, metric, dataset revision, and command that produced the number
- the local run is written to `experiments/{id}/baselines/{name}.md`
- any mismatch between the paper score and your reproduced score is preserved, not hidden

If any one of those is false, you do not have a reproduced baseline yet.

## The Process

### 1. Anchor the work to the active hypothesis
1. Call `loadHypotheses(cwd)`.
2. Call `getActiveHypothesis(entries)`.
3. If it returns nothing, stop.
4. Read the active `HypothesisEntry` carefully: `id`, `claim`, `judgeRef`, `baselineRef`, `costCap`, and `status`.
5. Treat `baselineRef` as a lead, not proof.
6. Read `HYPOTHESES.md` and `experiments/{id}/prereg.md`.
7. Confirm the preregistered claim actually depends on the baseline you are about to reproduce.
8. If the prereg names baseline X and you switch to Y because Y is easier to run, stop.
9. Create one stable `{name}`.
10. Use that same name for both `baselines/{name}.md` and `experiments/{id}/baselines/{name}.md`.
11. Keep the name boring and specific.
12. You are building an audit trail, not a brand.

### 2. Extract the source claim before touching code
1. Use the AlphaXiv `alpha` CLI to search for the competitor paper.
2. Prefer the paper itself, the appendix, or the official evaluation artifact over blogs, recaps, or copied leaderboard rows.
3. Capture the exact paper URL you will rely on.
4. If the paper is long, start with `alpha get paper --section results`.
5. Read the results section first and extract the reported figure directly from it.
6. Record the exact claim, not your paraphrase of the claim.
7. Extract the metric, dataset, split, table or figure reference, and any caveat attached to that number.
8. If the results section is ambiguous, incomplete, or points somewhere else for the crucial setup detail, then read the full paper.
9. Do not read the full paper first out of habit when the results section already answers the question.
10. Save the paper URL and extracted claim immediately to `baselines/{name}.md`.
11. If you cannot point to the exact sentence, table, or figure that reports the number, you do not yet know what you are reproducing.
12. A copied citation is not source extraction.

### 3. Verify the locked judge before touching numbers
1. Call `getJudgeLock(cwd, active.id)`.
2. If it returns `null`, stop.
3. A missing lock means your evaluator is not stabilized yet.
4. Compute the expected hash with `computeJudgeHash(active.judgeRef, active.id)`.
5. Compare that hash against the contents of `experiments/{id}/judge.lock`.
6. They must match exactly.
7. If they do not match, stop immediately.
8. Do not run a quick baseline under a drifted evaluator just to unblock yourself.
9. Record `active.judgeRef` in the reproduction note.
10. Record the verified lock hash in the reproduction note.
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
12. Best-of-n versus single-shot can manufacture gains.
13. Match preprocessing and failure handling.
14. If one side drops refusals, timeouts, or malformed outputs and the other side does not, the score is contaminated.
15. If you cannot align the contracts honestly, write `not comparable` and stop pretending it is head-to-head.

### 5. Validate Hugging Face datasets before you rely on them
1. If the baseline references a Hugging Face dataset, call `hf_dataset_info` before you run anything.
2. Verify the dataset exists.
3. Verify it is not disabled.
4. Inspect splits, features, access status, and sibling metadata.
5. Treat missing split or feature information as unverified, not as "probably standard."
6. Capture the returned `url` and `sha`.
7. If the dataset is gated and `HF_TOKEN` is not set, stop.
8. Gated-without-token is not a minor inconvenience.
9. It means you cannot verify the dataset contract honestly.
10. Call `hf_repo_files` to inspect the repo structure before assuming config names, file layout, or split assets.
11. If the paper or dataset card specifies a revision tag, record that exact revision.
12. Otherwise use the dataset `sha` returned by `hf_dataset_info` as the pin.
13. Never use floating `main`, `latest`, or "current" as the dataset version.
14. Record the pinned commit SHA or revision tag in `baselines/{name}.md`.
15. Record the same pin in `experiments/{id}/baselines/{name}.md`.
16. Future diffs depend on that pin to detect dataset drift.
17. If the HF dataset splits or schema do not match the paper claim, downgrade the comparison or block it.

### 6. Locate the executable competitor source
1. Start from the strongest source you can execute.
2. Prefer official code with a pinned release, tag, or commit.
3. If code is absent or broken, fall back to the paper appendix, benchmark card, or exact evaluation table.
4. Record the system name and exact version.
5. Version means tag, commit hash, checkpoint name, API snapshot, or release identifier.
6. `latest`, `main`, and `current` are not versions.
7. If the source does not disclose versioning, write `unknown` and say why.
8. Find any original judge, rubric, or grading procedure the source used.
9. Find preprocessing, filtering, retry, or decoding behavior that could change scoring.
10. If you cannot identify split, metric, or runnable source, you do not have enough for a strong comparison claim.

### 7. Check prior notes and freshness
1. Look for an existing source note at `baselines/{name}.md`.
2. Look for an existing reproduction note at `experiments/{id}/baselines/{name}.md`.
3. Use `fileExists(path)` if you need a direct existence check.
4. If either note exists, read it fully.
5. Existing is not the same as valid.
6. Confirm the source note records the paper URL, extracted claim, metric, dataset, split, and any HF revision pin.
7. Confirm the reproduction note records the version, retrieved date, source URL, split, metric, judge, dataset revision, and full reproduction command.
8. If any of that is missing, refresh it.
9. If the repo also maintains `BASELINES.md`, call `loadBaselines(cwd)`.
10. Find the matching `BaselineEntry`.
11. Call `getBaselineAgeDays(entry)`.
12. If the age is greater than 30, the baseline is stale.
13. Stale means you must refresh before quoting it.
14. Not "probably still fine."
15. Papers do not drift, but repos, checkpoints, and datasets do.
16. That is why both source extraction and revision pinning exist.

### 8. Run the competitor baseline under your contract
1. Use the official implementation when you can inspect and pin it.
2. If you must port or reimplement it, keep the port faithful and boring.
3. Do not optimize the baseline.
4. Do not quietly fix its prompts, swap in a friendlier judge, or tune its settings until it loses less gracefully.
5. Capture the exact reproduction command.
6. Include flags, model IDs, seeds, config files, dataset selectors, and environment variables that materially affect the result.
7. If a Hugging Face dataset is involved, make sure the command or config resolves the pinned dataset revision you recorded.
8. Record package versions, commit hashes, model snapshots, and dataset revisions that affect reproducibility.
9. If the run fails, record the failure.
10. Do not fall back to the paper number.
11. Failure to reproduce is still a result.
12. If the reproduced score differs from the source score, preserve both.
13. The only number you may use for a claim is the reproduced score under your locked judge.

### 9. Write both baseline artifacts immediately
1. Update `baselines/{name}.md` as soon as source extraction is complete and again if reproduction clarifies provenance.
2. Write `experiments/{id}/baselines/{name}.md` as soon as the run ends.
3. Do not wait until after you run your own system.
4. Memory is where provenance goes to die.
5. In the source note, keep the paper URL, extracted claim, metric, dataset, split, HF validation results, and pinned revisions.
6. In the reproduction note, record the exact score, exact version you ran, date retrieved, source URL, extracted claim, dataset and split, metric, `active.judgeRef`, verified `judge.lock` hash, full reproduction command, and any material contract differences.
7. Unknown fields must be written as `unknown`, not omitted.
8. If the baseline is not quoteable, say so in plain language.

### 10. Quote the reproduced number, not the flattering one
1. Compare against the score you produced, not the prettiest number in the literature.
2. If your reproduction is stronger than the paper number, use the stronger reproduced number.
3. If your reproduction is weaker than the paper number, use the weaker reproduced number.
4. If the contracts are not comparable, write `not comparable`.
5. If the baseline kills your win, accept that outcome.
6. Update the claim in `HYPOTHESES.md` or downstream result drafts if the reproduced baseline changes the story.
7. When adversarial review attacks your claim, it should find evidence instead of folklore.
8. Move on only when the source note and reproduction note can survive hostile reading.

## What Must Be in `baselines/{name}.md`
Use a structure that makes source drift obvious.
Do not hide uncertainty in prose.
Make the unknowns explicit.

```md
# Baseline Source: <name>

- **Paper URL:** <exact paper url>
- **Date retrieved:** <YYYY-MM-DD>
- **Extraction path:** <alpha results section first | full paper required>
- **Extracted claim:** <verbatim or tightly quoted claim from the paper>
- **Table or figure:** <table 2 | figure 4 | unknown>
- **Metric:** <metric>
- **Dataset:** <dataset>
- **Split:** <split>
- **Competitor version:** <tag|commit|checkpoint|snapshot|unknown>
- **HF dataset repo:** <org/name|none>
- **HF access status:** <public|gated|private|unknown>
- **HF pinned revision:** <sha|tag|none|unknown>
- **HF splits verified:** <yes|no|unknown>
- **HF features verified:** <yes|no|unknown>
- **HF repo structure checked:** <yes|no>
- **Notes:** <caveats, ambiguities, or why full paper was needed>
```

This file exists so you can later prove what the competitor claimed before you touched their code.
If the source claim itself is muddy, the reproduction note should inherit that uncertainty instead of pretending it vanished.

## What Must Be in `experiments/{id}/baselines/{name}.md`
Use a structure that makes missing provenance obvious.

```md
# Baseline: <name>

- **Hypothesis ID:** <id>
- **Claim under test:** <claim>
- **Source note:** `baselines/<name>.md`
- **Source URL:** <url>
- **Extracted claim:** <reported number and wording from source note>
- **Competitor version:** <tag|commit|checkpoint|snapshot|unknown>
- **Date retrieved:** <YYYY-MM-DD>
- **Task:** <task>
- **Dataset:** <dataset>
- **Split:** <split>
- **Metric:** <metric>
- **Dataset revision:** <sha|tag|unknown>
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
The durable run-specific artifact is still `experiments/{id}/baselines/{name}.md`.
That file is the local evidence for the quoted number.

## Common Failure Modes

### Paper paraphrase drift
Someone copied the number from a blog post, README, issue comment, or leaderboard row.
That is not source extraction.
Use the paper itself.
If the paper is long, start with `alpha get paper --section results`.
Only read the full paper when the results section does not settle the claim.

### Results-section avoidance
Reading the whole paper first feels thorough.
Often it is just undisciplined.
If the critical number lives in the results section, extract it there first so you do not let surrounding narrative rewrite the claim in your head.

### Hugging Face dataset fantasy
The dataset name appears in the paper, so somebody assumes the Hub repo still exists, still has the same splits, and is still public.
That is how silent dataset drift becomes fake progress.
Call `hf_dataset_info` and `hf_repo_files`.
Verify the actual repo, structure, and access state.

### Gated dataset without credentials
Public metadata is not public access.
If the dataset is gated and `HF_TOKEN` is not set, stop.
Do not build a comparison on a dataset you cannot honestly inspect or fetch.

### Floating dataset revisions
`main` is not a pin.
`latest` is not a pin.
If you did not record a commit SHA or revision tag, you created an invisible moving part in the baseline.

### Different judge
A different judge is a different experiment.
Human preference, a provider eval, and `active.judgeRef` are not interchangeable.
Re-score under your lock or drop the head-to-head claim.

### Different test split or metric
A dev-set number is not a test-set number.
Macro average is not micro average.
Pairwise win rate is not exact-match accuracy.
If the contract moved, the baseline moved.

### Paper-only evidence
A paper number without a local run is context, not a baseline.
You may cite it as published context.
You may not use it as the thing you beat.

## Common Rationalizations

| Excuse | Reality |
| --- | --- |
| "The paper already reports the number." | Reported is not extracted and extracted is not reproduced. |
| "I found the score on a leaderboard." | Leaderboards copy claims; they do not replace the source paper. |
| "The paper is short enough that I can just skim it." | Skimming is how table notes, split caveats, and metric qualifiers disappear. |
| "The results section probably says the same thing as the rest." | Then prove it quickly with `alpha get paper --section results` before spending more time. |
| "The HF dataset repo looks standard." | Standard-looking repos still drift, gate, rename configs, and change files. Verify it. |
| "The dataset is gated but the card is public." | Public metadata is not usable data. No `HF_TOKEN`, no honest validation. |
| "I can pin the dataset revision later." | Later means after the comparison already floated. Pin it now. |
| "Using the source score is more conservative." | No. Use the score you actually measured under your contract. |
| "The artifact already exists." | Existing and quoteable are different states. Check completeness, lock, freshness, and pins. |
| "I can reproduce it after I finish my own run." | Then you are incentivized to move the baseline to fit the story. |

## Red Flags - STOP
Stop immediately if any of these are true:
- `getActiveHypothesis(...)` returns nothing
- `experiments/{id}/prereg.md` is missing
- the prereg does not name the baseline you are trying to beat
- you cannot identify the paper URL you are relying on
- you cannot extract the reported figure directly from the paper or official source
- the paper is long, but you skipped `alpha get paper --section results` and are guessing from memory anyway
- `getJudgeLock(cwd, id)` returns `null`
- `computeJudgeHash(active.judgeRef, active.id)` does not match `experiments/{id}/judge.lock`
- the baseline uses a Hugging Face dataset and you did not call `hf_dataset_info`
- the baseline uses a Hugging Face dataset and you did not call `hf_repo_files`
- the dataset is gated and `HF_TOKEN` is not set
- you cannot state the pinned dataset revision
- you cannot state the competitor version you ran
- you cannot state the dataset split
- you cannot produce the exact reproduction command
- the only number you have is from the paper PDF
- the previous note is older than 30 days and you are about to quote it anyway
- you changed prompts, filters, or sampling because the original setup was inconvenient
- you are comparing your locked-judge score to their original human-judge number
- you are tempted to say "close enough"

All of these mean the comparison is not ready to quote.

## Good vs Bad

### Good: extract the paper claim first
Good:
"I found the competitor paper with the `alpha` CLI, used `alpha get paper --section results`, extracted the exact figure from Table 3, and saved the URL plus claim to `baselines/model-x.md`."
Bad:
"I remembered the paper was around 84 and copied the leaderboard number into the baseline note."

### Good: validate the dataset contract
Good:
"I called `hf_dataset_info` to verify the dataset exists, inspected splits and features, saw it returns `sha`, and used `hf_repo_files` to confirm the repo layout before pinning the dataset revision."
Bad:
"The paper says it uses `org/dataset`, so I assumed the Hub repo still matches the paper."

### Good: block on gated access
Good:
"`hf_dataset_info` showed `gated: true`, `HF_TOKEN` was unset, so I blocked the baseline instead of pretending the dataset was usable."
Bad:
"The metadata page loads in a browser, so I treated the gated dataset as effectively public."

### Good: use the reproduced score even when it hurts
Good:
"The source reports 84.1, but my locked-judge reproduction is 86.4, so the comparison uses 86.4."
Bad:
"The paper headline is lower, so I used that to stay consistent with the literature."

### Good: reject mismatched contracts
Good:
"The competitor reports dev-set human ratings, while this hypothesis is about test-set locked-judge win rate, so I recorded the source and marked the comparison `not comparable`."
Bad:
"The tasks are similar, so the comparison is directionally fair."

## Why This Matters
Most fake wins are not outright fabrication.
They are baseline discipline failures.
A paraphrased paper claim, a gated dataset you never really inspected, a floating dataset revision, a different judge, or a stale reproduction is enough to manufacture progress that is not real.

This skill forces the comparison onto one explicit contract.
It makes the source claim auditable.
It makes dataset drift visible.
It gives later review real evidence instead of folklore.
And it saves you from shipping a claim that only existed because nobody made you extract the paper number and run the baseline yourself.

After this, use `/skill:experiment-execution`
