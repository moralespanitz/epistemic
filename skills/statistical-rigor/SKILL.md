---
name: statistical-rigor
description: Use when completed experiment outputs exist in `experiments/{id}/smokes/` and the agent must decide whether an inferential claim is statistically defensible before falsification review or promotion.
---

> **Related skills:** `/skill:experiment-execution`, `/skill:baseline-reproduction`, `/skill:falsification-review`, `/skill:verification-before-publication`

# Statistical Rigor

## Overview
Execution produced numbers. This phase decides whether those numbers justify an inferential
sentence. A promising mean is not enough. A dramatic chart is not enough. A small p-value with no
assumption checks, no effect size, and no multiplicity accounting is not enough.
This skill sits after `/skill:experiment-execution` and before `/skill:falsification-review`.
Execution measures. Statistical rigor decides whether interpretation is allowed. Falsification
review then attacks the surviving claim. If you skip this phase, you hand the next reviewer a weak
sentence and call the later pain a surprise.

## The Iron Law
```text
No result leaves smokes/ without statistical justification
```
If the result has not survived this gate, it stays in `smokes/`. It does not move into
`experiments/{id}/RESULTS.md`. It does not move into root `RESULTS.md`. It does not become a
sentence containing `significant`, `difference`, `improves`, `beats`, or `correlates`.

## When to Use
- `experiments/{id}/smokes/` contains completed runs and you are about to interpret them
- the draft claim uses inferential language like `significant`, `difference`, `beats`, `improves`, `correlates`, or `relationship`
- the preregistered sample size `n` has been collected and summary statistics now exist
- you must choose between parametric and non-parametric tests
- multiple metrics, slices, ablations, or post-hoc comparisons exist
- you need to decide whether the result is statistically detectable, practically important, both, or neither
- you are tempted to move a number out of `smokes/`
- you are preparing a claim for `/skill:falsification-review`

## When NOT to Use
- the idea is still vague; use `/skill:research-question`
- the protocol is still being locked; use `/skill:preregistration`
- the experiment is still running; use `/skill:experiment-execution`
- the baseline itself has not been reproduced; use `/skill:baseline-reproduction`
- the result is purely descriptive and you are explicitly avoiding inferential language
- the work is already blocked by missing preregistration, judge drift, or execution contamination
- the data structure calls for a model not covered here and you are about to force it into a t-test anyway
- you are packaging a final publication claim; use `/skill:verification-before-publication`

## Working Surface
Use the real repo state from `src/state/repo.ts`. Do not reconstruct the experiment from memory. Do
not invent side bookkeeping.
| Need | API or file | Rule |
| --- | --- | --- |
| Quick repo snapshot | `loadRepoState(cwd)` | Start from current repo state, not memory |
| Resolve the live hypothesis | `loadHypotheses(cwd)` + `getActiveHypothesis(entries)` | Start from an exact `id`, `claim`, `n`, `judgeRef`, and `baselineRef` |
| Recover canonical entries | `parseHypotheses(content)` | Use when `HYPOTHESES.md` was edited manually and you need the parser result |
| Check required artifacts | `fileExists(path)` | Missing prereg or smoke artifacts block interpretation |
| Verify judge continuity | `getJudgeLock(cwd, id)` + `computeJudgeHash(judgeRef, id)` | Judge drift can invalidate comparisons before statistics even begin |
| Read baseline context | `loadBaselines(cwd)` + `getBaselineAgeDays(entry)` | Find the named comparator and check freshness |
| Read spend | `getHypothesisSpend(cwd, id)`, `getHypothesisSpendByCategory(cwd, id)`, `getAllHypothesisSpends(cwd)` | Distinguish underpowered evidence from finished evidence |
| Normalize registry text | `hypothesisToMarkdown(h)` + `saveHypotheses(cwd, entries)` | Only for honest cleanup, never to rewrite the claim around observed data |
| Guard status changes | `updateHypothesisStatus(cwd, id, status)` | Do not call `CONFIRMED` here; statistical significance is not confirmation |

Read these artifacts before interpreting a result:
- `HYPOTHESES.md`
- `BASELINES.md`
- `experiments/{id}/prereg.md`
- `experiments/{id}/judge.lock`
- `experiments/{id}/smokes/aggregate.md`
- raw run artifacts under `experiments/{id}/smokes/`
- any draft `experiments/{id}/RESULTS.md`

## The Gate Function
```text
IDENTIFY -> CHECK ASSUMPTIONS -> SELECT TEST -> COMPUTE EFFECT SIZE
-> CORRECT MULTIPLICITY -> REPORT EXACTLY -> ONLY THEN INTERPRET
```
Skip one step and you do not have statistical justification. Run both a parametric and non-
parametric test and keep the prettier answer and you do not have statistical justification. Report
only a p-value and you do not have statistical justification. Count only the comparisons that
survived and you do not have statistical justification.

## Before Phase 1: Pin the statistical unit
Most fake rigor starts before the test. It starts when prompts, retries, judges, or slices are
counted as independent observations when the real unit is user, task, seed family, or document.
1. Load the current entries with `loadHypotheses(cwd)`.
2. Recover the target with `getActiveHypothesis(entries)` or select the exact `id` explicitly.
3. Read `experiments/{id}/prereg.md`.
4. Confirm what one observation actually is.
5. Confirm what `n` meant in the preregistration.
6. Confirm whether the design is independent-groups, paired, multi-group, or relational.
7. Confirm the comparator named in `baselineRef` is the one now under analysis.
8. Verify `getJudgeLock(cwd, id)` still matches `computeJudgeHash(judgeRef, id)` before trusting the numbers.
9. If the unit of analysis drifted after seeing the data, stop.
10. Statistical cleanup does not legalize execution drift.

## Phase 1: Assumption checking
Before interpreting results, verify normality, homogeneity of variance, independence of
observations, and the absence of ceiling or floor distortion. Parametric tests are not defaults.
They are contracts with assumptions.

### 1.1 Normality
Use this rule exactly:
- if `n < 50`, check normality with **Shapiro-Wilk**
- if `n ≥ 50`, inspect **Q-Q plots**
Apply the check to the quantity that actually enters the test:
- group values for simple group comparisons
- paired differences for paired designs
- residual-style comparison quantities when the method needs them
What to do:
1. State the sample size actually entering the test.
2. For `n < 50`, record the Shapiro-Wilk statistic and exact p-value.
3. For `n ≥ 50`, inspect the Q-Q plot for systematic bends, heavy tails, or strong outliers.
4. If the Q-Q plot shows major structure inconsistent with the parametric model, do not wave it away because the sample is large.
5. If normality is doubtful, take the non-parametric branch in Phase 2 or justify a robust alternative explicitly.
6. Do not run both branches and keep the friendlier result.

### 1.2 Homogeneity of variance
If you are comparing independent groups with mean-based tests, variance matters. Different spreads
can make pooled summaries lie. Use **Levene's test**.
What to do:
1. Apply Levene's test to the groups under the intended comparison.
2. Record the exact p-value.
3. If variance homogeneity holds, the ordinary parametric path stays eligible.
4. If it fails, do not pretend the classic pooled test was still fine.
5. Use the variance-robust version of the relevant parametric test or move to the non-parametric branch when that is the cleaner fit.
6. Name the decision in the write-up.

### 1.3 Independence of observations
Independence is usually a design fact, not a software checkbox. No p-value rescues non-independent
data treated as independent.
Check directly from the protocol:
- did the same user, document, or seed family contribute multiple rows?
- did the same unit appear in both conditions?
- did repeated prompts share hidden context that makes them paired rather than independent?
- did one baseline output get judged multiple times and then counted as multiple observations?
Rules:
1. If the same unit appears in both conditions, the design is paired.
2. If observations are clustered by subject, prompt family, or shard, simple independent tests are suspect.
3. If collection introduced serial dependence, say so.
4. If independence is broken and you do not have the right model, keep the result descriptive or redesign the analysis.
5. Do not launder pseudo-replication into a bigger `n`.

### 1.4 Ceiling and floor effects
If the metric piles up at the maximum or minimum possible value, ordinary mean comparisons can
mislead. The absence of movement may be a property of the scale, not of the underlying system.
Check:
- whether a large fraction of observations sit at the minimum or maximum
- whether one condition is compressed against the ceiling while the other still has room to move
- whether the metric has so little dynamic range that differences cannot express cleanly
Rules:
1. Inspect the raw values, not just the summary.
2. If most values are at 0 or at the cap, report the compression plainly.
3. If ceiling or floor effects dominate, inferential claims weaken even if a p-value appears small.
4. Do not call a non-significant result proof of no effect when the metric could barely move.

### 1.5 Phase-1 decision table
| Condition | Consequence |
| --- | --- |
| Normality acceptable, variance acceptable, independence acceptable, no serious ceiling/floor distortion | Parametric path remains eligible |
| Normality doubtful | Use the non-parametric path or justify a robust alternative |
| Variances unequal in an independent-groups design | Use the variance-robust branch or leave the pooled test |
| Independence broken | Block simple inferential claims; redesign or stay descriptive |
| Severe ceiling/floor effects | Interpret cautiously; the metric may not support the claim |
No assumption memo, no interpretation.

## Phase 2: Test selection
Pick the test from the data-generating structure, not from field habit. The first question is not
"Which test do I know?" The first question is "What design did we actually run?"

### 2.1 Selection table
| Design | Assumption state | Use this test | Effect size to report |
| --- | --- | --- | --- |
| Two independent groups | Normal | t-test | Cohen's `d` |
| Two independent groups | Non-normal | Mann-Whitney U | rank-based magnitude or a clearly justified alternative |
| Paired data | Normal | paired t-test | Cohen's `d` for paired differences |
| Paired data | Non-normal | Wilcoxon signed-rank | rank-based magnitude or a clearly justified alternative |
| 3+ groups | Normal | ANOVA + post-hoc | eta-squared |
| 3+ groups | Non-normal | Kruskal-Wallis | rank-based magnitude or a clearly justified alternative |
| Continuous relationship | approximately linear / normal-friendly | Pearson correlation | `R^2` or an equivalent variance-explained statement |
| Continuous relationship | monotonic / non-normal | Spearman correlation | report the coefficient plus a disciplined magnitude interpretation |
If the design is outside this table, stop and choose the right model deliberately. Do not coerce
count data, bounded proportions, or clustered measurements into a t-test because the table feels
close enough.

### 2.2 Selection rules
1. Two independent groups, normal -> t-test.
2. Two independent groups, non-normal -> Mann-Whitney U.
3. Paired data, normal -> paired t-test.
4. Paired data, non-normal -> Wilcoxon signed-rank.
5. 3+ groups, normal -> ANOVA first, then post-hoc tests.
6. 3+ groups, non-normal -> Kruskal-Wallis.
7. Continuous relationship, approximately linear -> Pearson correlation.
8. Continuous relationship, monotonic or non-normal -> Spearman correlation.

### 2.3 What not to do in Phase 2
- decide the test after seeing which one gives `p < .05`
- swap between paired and independent forms because one is significant
- split one planned family into many unplanned families to rescue a claim
- call a directional post-hoc hypothesis obvious after seeing the data
- treat normality failure as irrelevant because everyone uses t-tests
- call a non-significant test proof of equivalence unless equivalence was actually designed and tested

## Phase 3: Effect sizes
Always report effect sizes alongside p-values. A p-value addresses compatibility with a null model
under the chosen test. It does not tell you how large the effect is. It does not tell you whether
the effect matters.
Use these defaults unless the design demands a better-matched magnitude metric:
- **Cohen's d** for two-group mean differences
- **eta-squared** for ANOVA-family group differences
- **R-squared** for continuous relationships or variance explained
If you used Mann-Whitney, Wilcoxon, or Kruskal-Wallis, still report a magnitude measure. Do not hide
behind "non-parametric tests do not need effect sizes." They do.
Keep these questions separate:
1. Is the effect statistically distinguishable from the null under the chosen model?
2. Is the effect large enough to matter for the hypothesis, product, or scientific claim?
A tiny effect can be statistically significant in a large sample. A large-looking effect can miss
significance in a tiny sample. Neither case gives you permission to collapse magnitude and evidence
into one sentence.
Practical significance comes from preregistered context, not from mood:
- Does the observed effect clear the falsifier threshold?
- Does it exceed a benchmark that matters operationally?
- Does it survive comparison with the baseline named in `baselineRef`?
- Is it large enough to justify the cost it consumed relative to `costCap` and current spend from `getHypothesisSpend(...)`?
If the honest answer is "statistically yes, practically maybe not," say exactly that. Whenever the
toolchain allows it, report confidence intervals around the effect size or mean difference.
Never call:
```ts
await updateHypothesisStatus(cwd, id, "CONFIRMED");
```
just because `p` crossed a threshold. This phase only decides whether inferential language is
statistically supportable.

## Phase 4: Multiple comparisons
If you test enough things, one of them will flatter you. Multiplicity correction exists because
researchers are predictable.
This phase is mandatory when you ran many tests across:
- multiple metrics
- multiple dataset slices
- multiple prompts or model variants
- multiple baselines
- multiple time windows
- multiple post-hoc pairwise contrasts
- multiple correlations
- exploratory subgroup analyses
One hypothesis does not automatically mean one comparison. Count the p-values that could have
produced a win sentence.
Count the actual number of comparisons, not just the survivors. Count each pairwise post-hoc test, each metric supporting the claim, each subgroup or slice inspected for a win, each timepoint compared, each alternative baseline framed as a possible success, and each exploratory analysis you are tempted to quote.
Use one of these defaults:
- **Bonferroni** when the family is small and you want strong control over false positives
- **FDR** when the family is larger or exploratory and you want to control expected false discoveries
1. Define the comparison family before applying the correction.
2. Apply the correction to the whole family, not the winners only.
3. Report both the family size and the correction method.
4. If the corrected result no longer survives, the confirmatory claim does not survive.
If preregistration named one primary outcome and several exploratory analyses, keep those families
separate. If correcting for multiple comparisons makes nothing significant, the correct conclusion
is not "correction is too strict." The correct conclusion is "nothing survived multiplicity
control."

## Phase 5: Reporting
This phase turns arithmetic into repo language. Write so another agent can audit the sentence line
by line.
Use APA-style reporting. The base pattern is:
- `t(df)=X.XX, p=.XXX, d=X.XX`
- `F(df1, df2)=X.XX, p=.XXX, η²=X.XX`
- `r(df)=.XX, p=.XXX, R²=0.XX`
Always report exact p-values. Do not write `p < .05`. Do not round `p` down to zero. If software
gives `0.0004`, report `p=.0004`.
Use leading zeros for values that can exceed 1:
- `d = 0.74`
- `η² = 0.18`
- `R² = 0.27`
- `M = 1.42`
- `SD = 0.91`
Do not write `d = .74` in this repo. Careless reporting breeds careless review.
Always include:
- the test name or statistic family
- the relevant degrees of freedom when the test has them
- the exact p-value
- the effect size
- the sample size or group sample sizes
- the correction method when multiple comparisons were involved
- the direction of the observed effect
Do not include:
- `ns`
- `trend`
- `marginally significant`
- `approached significance`
- `p < .05`
- `basically significant`
Write the statistical sentence before the headline sentence:
1. State the assumption checks.
2. State the chosen test and why.
3. State the exact result in APA form.
4. State the effect size and practical meaning.
5. State the multiplicity correction when relevant.
6. Only then write the interpretation.
If you cannot write the statistical sentence cleanly, you are not ready for the headline sentence.
Keep the full statistical justification in `experiments/{id}/smokes/` until the claim survives. A
good local note includes the hypothesis id, exact claim, unit of analysis, sample sizes, assumption
checks, chosen test and why, exact test output, effect size, multiplicity family size and
correction, final APA-form sentence, and anything that blocked promotion.

## Common failure modes
| Failure | What actually happened | Correct response |
| --- | --- | --- |
| Chose a t-test by habit | Test selection came from field custom, not design | Re-run Phase 2 from the actual design |
| Counted repeated prompts as independent rows | Inflated `n` through pseudo-replication | Rebuild the analysis at the correct unit |
| Used Shapiro-Wilk at large `n` and panicked at a tiny deviation | Mistook detectability for materiality | Use Q-Q plots for `n ≥ 50` |
| Ignored Levene's test because the means looked clean | Treated variance as cosmetic | Use the variance-robust branch or a different test |
| Ran pairwise tests after ANOVA and forgot multiplicity | Manufactured significance by repetition | Count the full family and correct it |
| Reported only `p` | Hid magnitude | Add the matched effect size |
| Reported only the effect size | Hid uncertainty about distinguishability | Add the test statistic and exact p-value |
| Used `p < .05` | Replaced evidence with a threshold slogan | Report the exact p-value |
| Declared "no effect" from a non-significant pilot | Confused absence of evidence with evidence of absence | Report uncertainty honestly |

## Good vs Bad
### Good: start from canonical repo state
```ts
const entries = await loadHypotheses(cwd);
const h = getActiveHypothesis(entries);
if (!h) throw new Error("No OPEN or RUNNING hypothesis.");
```
Good because statistical review begins from the registered hypothesis, not from the newest folder or
your memory.
### Bad: let one test mutate repo state
```ts
await updateHypothesisStatus(cwd, h.id, "CONFIRMED");
```
Bad because confirmation requires more than one threshold crossing.

## Decision and handoff
At the end of this phase, make one decision only:
- **statistically supported** -> the claim may advance to `/skill:falsification-review`
- **not statistically supported** -> the result stays in `smokes/`
- **statistically ambiguous** -> narrow the claim or collect more evidence before promotion
Do not invent a fourth state called "basically significant." Do not move a result forward because
the next phase might catch it.
Before any result leaves `smokes/`, every item below must be true:
- the exact hypothesis id is known
- the exact unit of analysis is known
- the sample size matches preregistration or the deviation is explicitly explained
- normality was checked with Shapiro-Wilk for `n < 50` or Q-Q plots for `n ≥ 50`
- homogeneity of variance was checked with Levene's test when relevant
- independence of observations was verified by design, not assumed
- ceiling and floor effects were inspected
- the chosen test matches the design
- effect size is reported alongside the p-value
- the actual number of comparisons was counted
- Bonferroni or FDR correction was applied when needed
- the result is written in exact APA-style form
- no one has upgraded the hypothesis to `CONFIRMED` based on statistics alone

## Common rationalizations
| Excuse | Reality |
| --- | --- |
| `We have n=5 but the effect is huge.` | Huge-looking effects at tiny `n` are exactly where sampling error does its best work. |
| `Everyone in my field just uses t-tests.` | Field habit does not repair violated assumptions or mismatched designs. |
| `Correcting for multiple comparisons makes nothing significant.` | Then nothing survived multiplicity control. That is the result. |
| `Shapiro-Wilk did not reject, so normality is proven.` | Failure to reject is not proof; it is one small piece of evidence. |
| `At n=200, normality always fails, so diagnostics are pointless.` | Large `n` changes which diagnostic is informative; it does not abolish diagnostics. |
| `The same users appeared in both groups, but the prompts differed, so it is still independent.` | Shared units make the design paired or clustered. |
| `The p-value is .0497, so I can just say p<.05.` | Threshold slogans throw away the actual evidence. Report `p=.0497`. |
| `The effect size is small, but statistically significant is statistically significant.` | Statistical and practical significance are different questions. |
| `The corrected p-value only matters for the appendix.` | If correction governs the claim, it belongs in the main sentence. |
| `The metric is capped, but everybody scores near the top, so that is good news.` | Ceiling effects can erase the signal you think you are measuring. |
| `The groups look separated in the plot, so the test is obvious.` | Visual separation can be real, noisy, or misleading. Use the matched test. |
| `We only ran extra slices for intuition.` | If the slices could have produced a win sentence, they count in the family. |
| `Non-parametric tests are weaker, so I should stay parametric.` | "Weaker" is not an excuse to violate assumptions. |
| `It is just an internal result.` | Internal falsehood ages into external folklore fast. |

## Red Flags - STOP
Stop immediately if any of these thoughts show up:
- `The histogram looks normal enough.`
- `The variance difference is probably fine.`
- `I can count each slice as another sample.`
- `I'll try both tests and report the cleaner one.`
- `Pairing makes the analysis annoying.`
- `The post-hoc comparisons are obvious, so they do not count.`
- `The effect size is optional because the p-value is strong.`
- `The p-value is close enough to .05.`
- `The correction kills the story.`
- `No one will ask how many tests we ran.`
- `I can call this confirmed now.`
- `The ceiling effect is actually a success effect.`
Any one of these means the claim is still negotiating with the gate. Do not negotiate. Repair the
analysis.

## Why This Matters
Most statistical failures do not come from exotic mathematics. They come from ordinary shortcuts:
using the wrong test, ignoring assumptions, treating paired data as independent, hiding effect size,
forgetting how many shots at significance were taken, and reporting threshold slogans instead of the
actual evidence.
This phase matters because it keeps `smokes/` provisional until inferential language is earned,
blocks field customs from outranking the actual data structure, forces magnitude and uncertainty to
travel together, and prevents uncorrected p-hacking from becoming repo memory.
A result can fail here and still be valuable. It may teach you that the effect is too small, the
metric is saturated, the sample is underpowered, or the claim needs narrowing. That is not wasted
work. That is the point of rigor.

After this, use `/skill:falsification-review`.
