---
name: surprise-triage
description: Quarantine and explain any result that diverges from the most recent prior result on the same benchmark by more than 15% before it leaves `smokes/`.
---

> **Related skills:** /skill:experiment-execution, /skill:falsification-review, /skill:kill-or-ship

# Surprise Triage

## Overview

A surprising number is not a win.
It is an incident.

A result that jumps or drops by more than 15% against the most recent prior result on the same benchmark can mean progress.
It can also mean seed drift, judge drift, leakage, a silent model change, or a broken harness.
Those possibilities are not interchangeable.

Treat every such divergence as untrusted until you find the root cause.
Do not argue from vibes.
Do not quote the number because it feels directionally right.
Do not bury the regression because it is inconvenient.

Your job here is simple.
Quarantine the number.
Explain the divergence.
Run the cheapest tests that separate real signal from garbage.
Then either promote the number because it reproduced under controlled conditions, or downgrade it to an anomaly because it did not.

This skill sits between execution and decision.
Use it after a new run lands and before any surprising result is allowed into `experiments/{id}/RESULTS.md`, `HYPOTHESES.md`, a summary, or a publication draft.

The smoke gate already assumes provisional numbers do not belong in headline files.
This manual tells you how to earn the right to move a number out of `experiments/{id}/smokes/`.

## The Iron Law

```text
No quoting surprising numbers until root cause is found
```

Read that literally.

A surprising number may exist in raw logs.
A surprising number may exist in `experiments/{id}/smokes/`.
A surprising number may exist in a triage note.

A surprising number does not belong in:

- `experiments/{id}/RESULTS.md`
- `HYPOTHESES.md`
- `experiments/{id}/KILLED.md` unless the root cause is part of the kill rationale
- a PR summary
- a commit message
- an issue comment that reads like a claim
- any narrative file that a reader will mistake for confirmed evidence

"Root cause found" does not mean "best guess chosen."
It means you ran the cheapest disambiguating tests, you know why the divergence happened, and you can defend that explanation from the artifacts.

If you cannot explain the divergence, you do not have a result.
You have smoke.

If a human insists on bypassing the quarantine, write the override and the reason in `OVERRIDES.md`.
An override changes the gate outcome.
It does not change the evidence.

## When to Use

Use this skill when a new result diverges from the most recent prior result on the same benchmark by more than 15%.

Use it for positive surprises.
A sudden gain is where leakage and drift hide.

Use it for negative surprises.
A sudden regression is where silent judge or model changes hide.

Use it when the benchmark name looks the same but any of the following may have changed:

- sample order
- random seed
- stratification policy
- judge model
- judge prompt
- judge temperature
- judge seed
- task prompt
- provider model alias
- harness implementation

Use it when the prior reference is a reproduced baseline from `experiments/{id}/baselines/{name}.md`.

Use it when the prior reference is the latest confirmed value in `experiments/{id}/RESULTS.md`.

Use it when a smoke run looks too good to be true even before exact math is done.
If the delta is visibly large, quarantine first and compute second.

Use it before quoting a surprising number anywhere outside `experiments/{id}/smokes/`.
That includes internal writeups.
Internal sloppiness becomes external sloppiness fast.

Use it when a provider silently changes behavior and the benchmark suddenly moves.
This skill exists precisely because infrastructure drift often looks like research progress.

## When NOT to Use

Do not use this skill when there is no prior result on the same benchmark.
That is not a divergence.
That is first measurement.

Do not use this skill when the benchmark definition changed on purpose.
If you changed the dataset, the scoring rubric, or the task instructions, record a new benchmark lineage instead of pretending old and new are directly comparable.

Do not use this skill for tiny movement under the threshold when repeated runs already show normal variance.
Document the noise band and move on.

Do not use this skill to excuse away a failed experiment.
Triage is for finding causes, not for protecting a preferred story.

Do not use this skill as a replacement for baseline reproduction.
If your comparison anchor is stale, reproduce the baseline first.
Use `loadBaselines(cwd)` and `getBaselineAgeDays(b)` to detect that condition.
A baseline older than 30 days is already suspect.

Do not use this skill as a replacement for falsification review.
If the core claim changed, use surprise triage to explain the number first, then revisit the claim with `/skill:falsification-review` if needed.

Do not use this skill as a replacement for final publication checks.
That belongs to `/skill:verification-before-publication`.

Do not use this skill to justify skipping pre-registration gates, judge locks, or cost controls.
Those controls exist precisely because surprising numbers are expensive to misread.

## Files and State Surface

Use the repo state before you tell yourself a story.

`HYPOTHESES.md` is the control plane for live work.
Use `loadHypotheses(cwd)` to parse it.
Use `parseHypotheses(content)` if you already have the raw markdown and need structured `HypothesisEntry` values.
Use `getActiveHypothesis(entries)` only when exactly one active hypothesis is in play.
If more than one candidate exists, resolve the experiment ID explicitly.

A `HypothesisEntry` carries the fields that matter during triage:

- `id`
- `claim`
- `falsifier`
- `n`
- `judgeRef`
- `baselineRef`
- `costCap`
- `status`
- `timestamp`

`experiments/{id}/prereg.md` tells you what was supposed to happen.
If the run diverged from preregistered conditions, note that before you interpret the metric.

`experiments/{id}/judge.lock` is the hard anchor for evaluation identity.
Use `getJudgeLock(cwd, hypothesisId)` to read it.
Use `computeJudgeHash(judgeRef, hypothesisId)` to compute what the lock should be for the current `judgeRef`.
If you intentionally change the judge for a new branch of work, use `writeJudgeLock(cwd, hypothesisId, judgeRef)` and treat that as a new condition, not as confirmation of the old one.

`experiments/{id}/baselines/{name}.md` holds reproduced baseline detail.
Use `loadBaselines(cwd)` to inspect summarized baseline entries.
A `BaselineEntry` exposes `name`, `url`, `score`, `judge`, `version`, and `retrieved`.
Use `getBaselineAgeDays(b)` before you trust an old anchor.

`experiments/{id}/smokes/` is the quarantine zone.
Put provisional numbers there.
Put triage notes there.
Put reproduction attempts there.
If a number is still under explanation, it stays there.

`experiments/{id}/RESULTS.md` is for confirmed numbers only.
Do not treat it like a scratchpad.

`experiments/{id}/KILLED.md` is for explicit kill rationales.
If surprise triage proves the result is invalid and the hypothesis should die, that conclusion lands here later.
Do not jump there before you know why the number moved.

`.epistemic/cost-ledger.jsonl` is the cost memory.
Use `getHypothesisSpend(cwd, hypothesisId)` or `getAllHypothesisSpends(cwd)` before you launch more paid checks.
Use `appendCostRecord(cwd, record)` so triage cost stays visible.
Debugging is not free just because it feels like hygiene.

Use `fileExists(path)` before you assume an artifact exists.
Missing evidence is evidence.
Do not silently substitute a guess.

Use `runFalsificationAdversary({ claim, context, cwd })` only after triage isolates the number and you need to pressure-test the surviving claim.
Do not replace root-cause analysis with an adversary call.
That is a category error.

## The Process

### 1. Phase 1 — Detect divergence

1. Resolve the hypothesis you are actually evaluating.
   Load `HYPOTHESES.md` with `loadHypotheses(cwd)`.
   If only one entry is `OPEN` or `RUNNING`, `getActiveHypothesis(entries)` is acceptable.
   If several are live, identify the experiment by `id` and stop guessing.

2. Capture the new result from its provisional artifact.
   Read the score from the current smoke output under `experiments/{id}/smokes/`.
   Record the benchmark name, the raw score, the sample count, the judge configuration, the task prompt version, the provider model identifier, and the timestamp.
   If any of that metadata is missing, write down that the run is already suspect.

3. Find the most recent prior result on the same benchmark.
   Prefer the latest confirmed value in `experiments/{id}/RESULTS.md`.
   If the benchmark is anchored to a reproduced baseline, inspect `experiments/{id}/baselines/{name}.md` and confirm it refers to the same benchmark definition.
   Use the most recent prior result, not the most flattering one.

4. Validate that the comparison is legitimate.
   Same benchmark means same task definition, same scoring semantics, and same interpretation of success.
   If the benchmark definition changed, stop calling it a divergence and open a new lineage instead.
   If the prior reference is stale, reproduce it before continuing.

5. Compute the divergence against the most recent prior result.
   Use relative change: `abs(new - prior) / abs(prior)`.
   If that value is greater than `0.15`, surprise triage fires.
   If the prior value is zero or near zero, percent math becomes unstable.
   In that case, treat any material non-zero jump as a surprise and document the absolute delta explicitly.

6. Quarantine immediately.
   Keep the number in `experiments/{id}/smokes/`.
   Open or update a triage note such as `experiments/{id}/smokes/triage.md`.
   Do not write the number into `experiments/{id}/RESULTS.md`, `HYPOTHESES.md`, or any file a reader will read as confirmed evidence.

7. If the number already leaked into a headline file, fix the file before doing anything else.
   Remove the provisional number or replace it with a plain statement that the result is under triage.
   If a human explicitly overrode the quarantine, record the reason in `OVERRIDES.md`.

8. Snapshot the control variables.
   Write down `n`, `judgeRef`, `baselineRef`, current model version, prompt identifier, seed, dataset split identifier, commit hash, and any run flags that could matter.
   This becomes the input to explanation ranking.

9. Check the obvious gate surfaces.
   Confirm `experiments/{id}/prereg.md` exists.
   Confirm `experiments/{id}/judge.lock` exists.
   Confirm any referenced baseline file exists.
   Use `fileExists(path)` for each check instead of assuming the repository is complete.

10. Check budget before you start spending.
    Read current cost with `getHypothesisSpend(cwd, hypothesisId)`.
    Compare it against `costCap` from the active `HypothesisEntry`.
    Triage should start cheap and stay cheap.

11. If the comparison anchor is a baseline, inspect its freshness now.
    Load baseline entries with `loadBaselines(cwd)`.
    Compute age with `getBaselineAgeDays(b)`.
    If the anchor is stale, note that baseline reproduction is required before this divergence can be interpreted confidently.

12. End Phase 1 with a plain statement.
    Example: "Benchmark X moved from 0.42 to 0.51 against the most recent prior result, a 21.4% relative increase, and is now quarantined in `experiments/alpha-17/smokes/`."
    If you cannot write that sentence cleanly, you have not defined the incident yet.

### 2. Phase 2 — Produce ranked explanations

Use the ranked list below as the default order.
Do not freestyle a clever theory before you check the boring explanations.
You may move an item upward only when you already have concrete evidence.
Absent evidence, preserve the order.

1. **Sampling differences**
   Start here because mismatched seeds, order, or stratification can create fake movement cheaply.
   Compare seed values.
   Compare sampling order.
   Compare any class-balancing or stratification logic.
   Compare `n` from the current run against the prior run.
   If one run used a curated subset and the other did not, you are not looking at the same measurement.

2. **Judge mismatch**
   Compare `judgeRef` in the current hypothesis against the lock and prior run.
   Compute the expected hash with `computeJudgeHash(judgeRef, hypothesisId)`.
   Read the actual lock with `getJudgeLock(cwd, hypothesisId)`.
   Then compare model name, prompt text, temperature, seed, and any system-message changes.
   A different judge is a different instrument.

3. **Data leakage or test contamination**
   Look for overlaps between training material, prompt exemplars, cached hints, and the evaluation set.
   Look for contamination introduced by manual inspection.
   Look for prompt text that accidentally exposes labels, rationales, or answer format cues that were not present before.
   Unexpected gains deserve active suspicion here.

4. **Ceiling effects**
   Ask whether the benchmark is already near saturation.
   If the task is almost solved, small item-level changes can look dramatic in a thin slice.
   High mean accuracy with low remaining error count often produces unstable percent narratives.
   Do not claim a breakthrough from a metric that has no room left to separate models cleanly.

5. **Prompt drift across runs**
   Compare the exact task prompt used in the current run to the prior run.
   A small wording change is still a change.
   A formatting tweak that alters answer length, chain-of-thought exposure, or tool hints can move the score.
   "Basically the same prompt" is not the same prompt.

6. **Model version change**
   Compare the provider-returned model identifier, not just the alias you asked for.
   Providers silently move aliases.
   Deprecated versions vanish.
   What looks like a research delta may be the platform serving a new model under an old name.

7. **Implementation bug in the test harness**
   Check aggregation, parsing, caching, retry behavior, concurrency, mutation across examples, benchmark routing, and score normalization.
   Harness bugs are real.
   They are simply not the first thing to assume when cheaper checks exist.
   If the code changed recently, move this explanation up with evidence.

Do not add a custom explanation until you have checked these seven.
Most "special cases" are just ordinary cases wearing a dramatic hat.

At the end of Phase 2, write the ranked list into the triage note.
For each explanation, add one sentence on why it is plausible in this specific incident.
If you cannot make a concrete case for plausibility, the explanation does not belong on the list yet.

### 3. Phase 3 — Design the cheapest disambiguating test for each explanation

For each ranked explanation, design one test that would change your mind.
Not three tests.
Not a shopping list.
One cheapest test that cleanly separates the explanation from at least one competing explanation.

Your test design must answer four questions:

1. What exactly will you do?
2. What result would support this explanation?
3. What result would weaken this explanation?
4. What will it cost?

Write the test plan before you run anything paid.
That discipline prevents "just one more rerun" from becoming unbounded spend.

Prefer zero-cost and near-zero-cost tests first:

- file existence checks
- hash comparisons
- metadata diffs
- prompt diffs
- run config diffs
- model identifier inspection
- hand-audited fixture checks

Only after those are exhausted should you spend on reruns.

A strong Phase 3 plan looks like this:

| Explanation | Cheapest disambiguating test | Supports explanation if | Weakens explanation if | Cost estimate |
| --- | --- | --- | --- | --- |
| Sampling differences | Re-run the exact same harness on the same benchmark with prior seed, current seed, and one additional seed while holding everything else fixed | Score clusters by seed or order and reproduces prior/current split | All seeds land near the same value | Low; usually one to three reruns |
| Judge mismatch | Compare `computeJudgeHash(judgeRef, hypothesisId)` against `getJudgeLock(cwd, hypothesisId)` and diff judge prompt, temperature, and seed | Lock mismatch or config drift appears | Lock and config are identical | Zero unless a locked rerun is needed |
| Data leakage or test contamination | Audit a small stratified sample of items and prompt context for overlap or leaked labels, then rerun on the clean slice | Contaminated items explain the gain | Clean slice preserves the gain | Low to medium |
| Ceiling effects | Inspect item-level error count and rerun on a harder or expanded slice without changing the task definition | Gain disappears when saturation pressure is removed | Gain survives on a harder slice | Low to medium |
| Prompt drift across runs | Diff the exact task prompt text and run a paired mini-eval with old vs new prompt under the same model and judge | Prompt version alone reproduces the delta | Prompt version does not matter | Low |
| Model version change | Compare provider-returned version identifiers and rerun on a pinned prior version if available | Pinned prior version restores the old score | Pinned version still shows the new score | Low to medium |
| Harness bug | Run a tiny hand-labeled fixture through the harness and inspect raw traces, parsed outputs, and aggregation | Trace reveals parsing or routing error | Fixture behaves correctly | Zero to low |

A few hard rules:

- The cheapest test is not always a rerun.
- A rerun without matched conditions is usually a waste.
- If a test cannot change your mind, it is not a disambiguating test.
- If you cannot estimate cost, you are not ready to run it.
- If a test spends meaningful money, record the expected spend before execution and append the actual spend after execution with `appendCostRecord(cwd, record)`.

Use `getHypothesisSpend(cwd, hypothesisId)` or `getAllHypothesisSpends(cwd)` to keep the plan inside the live budget.
If triage itself threatens the cost cap, that fact belongs in the decision.

### 4. Phase 4 — Execute tests in order of cost

Now execute the designed tests by ascending cost, not by ego.
The ranking from Phase 2 determines what explanations must be considered.
The run order here is cost-first because cheap evidence beats expensive speculation.

1. Run the zero-cost checks first.
   Compare hashes.
   Compare prompt text.
   Compare seeds.
   Compare model identifiers.
   Compare sample counts.
   Compare dataset slice metadata.
   A mismatch found here often closes the incident without a single paid call.

2. Update the triage note after each check.
   Record what you tested.
   Record what you found.
   Record whether the explanation moved up, down, or closed.
   Triage without written state turns into folklore.

3. Execute the cheapest paid rerun only after the free checks are exhausted or strongly narrowed.
   Hold every non-target variable constant.
   If you are testing sampling, do not change the judge.
   If you are testing judge mismatch, do not also change the prompt.
   One variable per discriminating test.

4. Keep provisional outputs in `experiments/{id}/smokes/` during the entire phase.
   Even a rerun that looks stable is still provisional until the explanation is settled.
   Do not let enthusiasm outrun discipline.

5. Log costs as you go.
   Triage calls are still calls.
   If a paid check uses model APIs or tool calls with real spend, append the record to `.epistemic/cost-ledger.jsonl` through `appendCostRecord(cwd, record)`.
   You are not exempt from the ledger because the purpose is debugging.

6. Stop early when the root cause is established.
   You do not need to complete the full matrix once a cheap test cleanly explains the divergence and the matched rerun behavior agrees.
   Finish the explanation.
   Do not keep spending to decorate it.

7. Escalate only when the cheap path fails.
   If the first wave of low-cost tests does not separate the top explanations, then run the next cheapest discriminating test.
   Make the escalation explicit in the note.
   "Nothing obvious worked" is not a test plan.

8. Watch the kill surface while you debug.
   If spend approaches or exceeds the hypothesis `costCap`, stop pretending triage is free.
   Read current spend with `getHypothesisSpend(cwd, hypothesisId)`.
   If the only remaining explanations require expensive audits or long reruns, you may already be in `/skill:kill-or-ship` territory.

9. If you discover data leakage, contamination, or a harness bug, quarantine harder, not softer.
   Do not quote the number even if it is flattering.
   Mark the affected run invalid inside the smoke note.
   Preserve traces so the failure mode is reproducible.

10. If you discover judge or model drift, separate instrument change from model change.
    Re-run with the locked judge or pinned model if possible.
    If the old instrument is unavailable, document that limitation and treat the surprising number as non-comparable, not as confirmed progress.

11. If you discover prompt drift, reproduce both prompt versions under the same model and judge.
    This turns a vague suspicion into an actual attribution.
    Without the paired rerun, you still only have drift, not effect size.

12. If you discover ceiling effects, stop speaking in breakthrough language.
    Move to harder slices or better discriminators before you claim substantive improvement.
    A saturated benchmark is a weak measuring device.

13. If all tests fail to reproduce the surprise, downgrade it.
    Do not invent a heroic explanation.
    An unexplained, unreproduced jump stays an anomaly.

### 5. Phase 5 — Promote or downgrade

End triage with a decision.
Not a mood.
Not a paragraph that smuggles uncertainty into bold claims.
A decision.

1. **Promote the number** only if all of the following are true:
   - the divergence was explained
   - the explanation is supported by artifacts or matched reruns
   - the number reproduced under controlled conditions
   - the surviving run uses a legitimate benchmark definition
   - the judge and model conditions are either matched to the prior run or intentionally re-locked as a new condition

2. If you promote the number, move it out of quarantine deliberately.
   Copy the confirmed value and supporting context into `experiments/{id}/RESULTS.md`.
   Update `HYPOTHESES.md` only if the hypothesis status genuinely changes.
   Use `updateHypothesisStatus(cwd, id, status)` for status transitions rather than ad hoc edits when that helper fits the change.

3. Promotion is not the same as silence about the cause.
   Keep the triage note in `experiments/{id}/smokes/` so future runs can see why the number was trusted.
   The note is part of the chain of custody.

4. **Downgrade to anomaly** if the number does not reproduce, cannot be attributed cleanly, or depends on contamination, drift, or a harness bug.
   Leave the surprising value in the smoke artifact.
   Do not copy it into `experiments/{id}/RESULTS.md`.
   Do not rewrite history so the anomaly disappears.

5. If the anomaly invalidates a claim, reflect that explicitly.
   You may need to keep the hypothesis `RUNNING`, mark it `FALSIFIED`, or eventually kill it.
   Make that call from evidence, not embarrassment.
   If the investigation shows the line is dead, hand off to `/skill:kill-or-ship`.

6. If the root cause was judge drift and you intentionally accept a new judge for future work, create that as a new locked condition.
   Write the new lock with `writeJudgeLock(cwd, hypothesisId, judgeRef)`.
   Do not backfill old claims as though the instrument never changed.

7. If the root cause exposes a deeper claim problem, pressure-test the surviving claim separately.
   That is when `runFalsificationAdversary({ claim, context, cwd })` becomes useful.
   It is a follow-on step after triage, not the triage itself.

8. If a human forces publication or summary of an unresolved surprise, write the override and the exact reason in `OVERRIDES.md`.
   Keep the wording plain.
   "Leadership asked for it" is a reason.
   It is not evidence.

9. Close the incident with a one-line verdict in the triage note.
   Examples:
   - "Promoted: delta traced to sampling variance, reproduced at 0.50–0.51 under matched conditions."
   - "Anomaly: gain disappeared under locked judge and fixed prompt."
   - "Invalidated: contamination found between prompt exemplars and test items."

10. Only after the verdict is written should you move on.
    Surprise triage that never lands a verdict is just expensive suspense.

## Common Rationalizations

| Excuse | Reality |
| --- | --- |
| "It is only a smoke run, so I can mention it casually." | Casual mention is still quoting a number. Smoke stays in `experiments/{id}/smokes/` until triage closes. |
| "The jump is huge, which makes it obviously real." | Huge jumps are exactly where leakage, drift, and bugs hide. |
| "Same judge family, close enough." | A different model, prompt, seed, or temperature is a different instrument. |
| "The prompt only changed a little." | Small prompt edits can move results materially. Diff it or stop claiming comparability. |
| "Seed noise cannot explain this much movement." | That is a claim. Test it with matched reruns instead of asserting it. |
| "We can triage after the report draft is out." | Once a number enters narrative text, people anchor on it. Quarantine first. |
| "The baseline is old but probably fine." | Old anchors create fake surprises. Check freshness with `getBaselineAgeDays(b)`. |
| "The harness code did not change, so bugs are impossible." | Cached state, routing, parsing, or environment changes can still break a stable file. |
| "One rerun matched the surprise, so we are done." | One rerun can still be noise. You need explanation plus controlled reproduction. |
| "Provider aliases are stable enough." | Providers silently move aliases. Compare returned identifiers, not vibes. |
| "Debugging spend does not count against the hypothesis." | The ledger disagrees. Triage cost is still hypothesis cost. |
| "If the number helps the story, we can clean up provenance later." | That is how contaminated results become institutional memory. |
| "I already know the cause." | If you have not run the discriminating test, you have a hunch, not a cause. |

## Red Flags - STOP

Stop and resolve these before you claim anything:

- You cannot identify the most recent prior result on the same benchmark.
- The prior comparator is actually a different benchmark definition.
- `experiments/{id}/prereg.md` is missing.
- `experiments/{id}/judge.lock` is missing.
- The surprise number already appears in `experiments/{id}/RESULTS.md`.
- The run metadata does not include seed, prompt version, model identifier, or sample count.
- `n` changed and nobody documented why.
- The judge configuration differs from the lock and nobody called it out.
- The baseline is older than 30 days and has not been reproduced.
- The provider returned a different model version than the alias suggests.
- The test set was inspected, edited, or discussed in a way that could contaminate it.
- A paid rerun is being proposed before free checks are done.
- Costs are being incurred without ledger updates.
- More than one explanation is plausible and there is no written disambiguating test plan.
- Somebody is arguing to publish the number because it is directionally exciting.
- Somebody is arguing to hide the number because it is directionally embarrassing.

## Good vs Bad

### Example 1 — Judge mismatch

**Bad**

A smoke run shows a 19% gain.
You copy the number into `experiments/alpha-17/RESULTS.md` because the benchmark label matches.
Later you notice the run used a different judge prompt and a different temperature.
Now the headline file contains a claim from a different instrument.

**Good**

A smoke run shows a 19% gain.
You compare `computeJudgeHash(judgeRef, hypothesisId)` to `getJudgeLock(cwd, hypothesisId)`.
The hash does not match.
You diff the judge prompt and temperature.
You keep the number in `experiments/alpha-17/smokes/triage.md`.
You rerun with the locked judge.
The gain disappears.
You mark the surprise as an anomaly and leave `RESULTS.md` unchanged.

### Example 2 — Sampling differences

**Bad**

The prior confirmed run used `n = 200`.
The new smoke run used `n = 40` with a different seed.
You compare the raw means anyway and call it a breakthrough.
That is not comparison.
That is numerology.

**Good**

You notice the current `HypothesisEntry` has `n = 40` while the prior confirmed result summarized a 200-sample run.
You treat sampling differences as the top explanation.
You rerun with matched `n` and matched seed handling.
The score falls back near the old range.
You downgrade the spike to an anomaly caused by sampling variance.
No headline file changes.

### Example 3 — Data leakage

**Bad**

A benchmark near saturation suddenly improves again.
Because the number is flattering, you assume the model found a better strategy.
You never inspect whether the prompt now includes answer-pattern hints lifted from earlier error analysis.

**Good**

A near-saturated benchmark suddenly improves again.
You audit a stratified slice of examples and the current prompt context.
You find leaked label cues in a helper exemplar.
You invalidate the run, preserve the trace in `experiments/beta-04/smokes/`, and keep the surprising number out of `RESULTS.md`.
The benchmark stays trustworthy because you refused to cash a contaminated gain.

### Example 4 — Silent model version change

**Bad**

You requested the same provider alias as last week.
The score drops 22%.
You blame your prompt changes without checking what model actually served the request.

**Good**

You inspect the provider-returned model identifier and discover the alias now resolves to a new version.
You rerun the prior prompt against the pinned old version where available.
The old score returns.
You classify the incident as model version drift, not research regression, and you re-lock future runs intentionally instead of muddying the comparison set.

## Why This Matters

Most bad research decisions are not caused by lack of intelligence.
They are caused by unquarantined surprises.

A number that moves by more than 15% can trigger excitement, panic, sunk-cost reasoning, and deadline-driven storytelling.
This skill exists to keep those emotions from touching the evidence.

When you triage surprises correctly, you get three things:

- trustworthy headline files
- cheaper debugging because you test in cost order
- durable institutional memory about what actually moved the metric

When you triage badly, you get the opposite:

- contaminated `RESULTS.md`
- false regressions and false wins
- wasted budget on uncontrolled reruns
- claims that collapse the moment someone asks for reproduction

Quarantine is not bureaucracy.
It is how you protect the difference between evidence and theater.

After this, use `/skill:kill-or-ship`
