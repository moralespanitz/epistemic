---
name: kill-or-ship
description: Use when an experiment has reached a real decision point and you must explicitly choose KILL, RECOMMIT, or SHIP from repository evidence.
---

> **Related skills:** `/skill:experiment-execution`, `/skill:falsification-review`, `/skill:surprise-triage`, `/skill:verification-before-publication`

# Kill or Ship
## Overview
This is the decision point.
Not the reflection point.
Not the feelings point.
Not the "one more run" point.

You must choose exactly one branch:
- `KILL`
- `RECOMMIT`
- `SHIP`

Anything softer is usually avoidance.
A healthy research pipeline kills aggressively, recommits rarely, and ships only what survives contact with the gates.
A sloppy pipeline keeps weak work alive because nobody wants to write the obituary.
Do not run the sloppy pipeline.
**Core principle:** kill most things early, recommit only with an explicit new contract, and ship only confirmed work.
Your source of truth is the repository.
Read `HYPOTHESES.md`, `.epistemic/cost-ledger.jsonl`, `BASELINES.md`, and the artifacts under `experiments/{id}/`.
Use the real helpers in `src/state/repo.ts`.
Use the real adversary entry point in `src/adversary/dispatch.ts`.
If the files do not support the story, the story loses.
The extension already enforces part of this automatically.
`src/index.ts` imports and registers `registerKillCriteria(pi as any)` from `./gates/kill-criteria.js`.
Treat that gate as enforcement, not advice.
A clean kill is success.
A recommit is a new contract.
A ship is earned only when the gates are clean and the results are confirmed.

## The Iron Law
```text
5:1 kill-to-ship ratio is normal; sunk cost is a fallacy
```
Most ideas should die.
That is not cynicism.
That is how you keep budget, time, and credibility from bleeding out on bad bets.

Money already spent does not vote.
Time already spent does not vote.
Embarrassment does not vote.
Only current evidence, explicit caps, and clean gates vote.

## When to Use
Use this skill when:
- a hypothesis has enough evidence for a terminal decision
- spend is near or above the cost cap in `HYPOTHESES.md`
- a run has gone stale and needs a real answer
- you want to quote a result outside `smokes/`
- falsification review is complete and the next move must be explicit
- surprise triage is complete and the result is stable enough to judge
- you are considering an override to keep a run alive
- you are about to change status in `HYPOTHESES.md`
- you are tempted to quietly abandon a weak run without writing down why

Use it especially when the decision feels awkward.
That usually means emotion is trying to outvote evidence.

## When NOT to Use
Do not use this skill:
- before `experiments/{id}/prereg.md` exists
- before the run has produced any real evidence
- instead of `/skill:falsification-review`
- instead of `/skill:surprise-triage` for divergent results
- to silently revive something already marked `KILLED`
- to publish smoke results before confirmation
- to excuse sloppy execution after the fact

If you are still setting up the run, go back earlier in the pipeline.
If you are ready to publish, make the decision here first, then move to the publication gate.

## The Process
### Phase 1: Load the actual decision state
1. Start from the repository, not from memory.
2. Call `loadRepoState(cwd)` from `src/state/repo.ts` to confirm the scaffold exists.
3. Call `loadHypotheses(cwd)` and identify the active `HypothesisEntry`.
4. If you expect one live record, use `getActiveHypothesis(entries)`.
5. If multiple hypotheses are active, split them and decide each one separately.
6. Read the live entry closely enough to answer five questions: what is the claim, what would falsify it, what was the cost cap, what judge reference is supposed to be locked, and what is the current status.
7. If you only have raw markdown, use `parseHypotheses(...)`.
8. If you rewrite the ledger, use `saveHypotheses(...)` and `hypothesisToMarkdown(...)`.
9. Do not invent a second parser for `HYPOTHESES.md`.
10. Locate `experiments/{id}/`.
11. Check required artifacts with `fileExists(path)`: `prereg.md`, `judge.lock`, `RESULTS.md`, and `KILLED.md`.
12. Inspect `experiments/{id}/baselines/`, `experiments/{id}/falsifiers/`, and `experiments/{id}/smokes/` too.
13. Pull cumulative spend with `getHypothesisSpend(cwd, id)`.
14. If you need portfolio context, pull all totals with `getAllHypothesisSpends(cwd)`.
15. The source of truth is `.epistemic/cost-ledger.jsonl`, which stores `CostRecord` entries appended by `appendCostRecord(...)`.
16. Do not estimate spend from memory.
17. Compute elapsed time from the hypothesis timestamp to now.
18. Compute inactivity from actual git history for the hypothesis or experiment directory.
19. "No commit" means no repository progress.
20. Hope does not count as progress.
21. Private intention does not count as progress.
22. Get the facts first.

### Phase 2: Apply the hard triggers first
1. Start with the thresholds that remove wiggle room.
2. Compare cumulative spend against `costCap * 1.5`.
3. If spend is greater than `1.5 × costCap`, you must choose `KILL` or `RECOMMIT`.
4. That trigger is mandatory.
5. Do not override it with optimism, sunk cost, or a pretty smoke run.
6. Next check inactivity.
7. If the run has been going for more than 7 days with no commit, warn.
8. Treat that warning as a forced decision point, not as background noise.
9. If the run has been going for more than 21 days with no commit, auto-kill it.
10. A 21-day silent experiment is not active research.
11. It is dead inventory.
12. Dead inventory does not get more budget.
13. The kill-criteria gate exists to enforce exactly this behavior.
14. The extension code does the policing so you do not rationalize your way around it.
15. Once these triggers narrow the branch set, accept the narrowing.
16. Arithmetic is not negotiable.
17. Delay is not evidence.

### Phase 3: Decide whether `SHIP` is even available
1. Before choosing a branch, decide whether `SHIP` is actually on the menu.
2. Start with preregistration.
3. If `experiments/{id}/prereg.md` is missing, `SHIP` is closed.
4. If the decisive run drifted away from prereg without an explicit override, `SHIP` is closed.
5. Next check judge integrity.
6. Read the lock with `getJudgeLock(cwd, id)`.
7. Recompute the expected hash with `computeJudgeHash(hypothesis.judgeRef, id)`.
8. If the lock is missing or mismatched, `SHIP` is closed.
9. Do not call `writeJudgeLock(...)` after the fact to make history look cleaner.
10. Retroactive compliance is theater.
11. Next check falsification.
12. Review `experiments/{id}/falsifiers/`.
13. If needed, run `runFalsificationAdversary({ claim, context, cwd })` from `src/adversary/dispatch.ts`.
14. Read the returned `AdversaryVerdict[]`.
15. Pay attention to `experiment`, `costEstimate`, `verdict`, and `reasoning`.
16. If any verdict is `falsified-or-unreproducible`, `SHIP` is closed.
17. If any verdict is `cannot-audit`, `SHIP` is closed until the audit gap is fixed.
18. If a verdict is `caveat-required`, that caveat must already be reflected in the confirmed writeup.
19. Next check result location.
20. `experiments/{id}/smokes/` is provisional; `experiments/{id}/RESULTS.md` is confirmatory.
21. If the best version of the claim depends on smoke output, `SHIP` is closed.
22. Next check baseline integrity for comparison claims.
23. Use `loadBaselines(cwd)`.
24. Match the relevant entry to `baselineRef`.
25. Use `getBaselineAgeDays(baseline)`.
26. If the baseline is older than 30 days, refresh it before shipping comparison language.
27. If the competitor number was never reproduced under your locked judge, do not ship the comparison headline.
28. At this point the branch set should be obvious.
29. If it is not obvious, read the files again.

### Phase 4: Choose the branch directly
1. Use this rule set.
2. If spend is above `1.5 × costCap` and there is no explicit justified exception, choose `KILL`.
3. If spend is above `1.5 × costCap` but there is a concrete bounded reason to continue, choose `RECOMMIT`.
4. If the run crossed 21 days with no commit, choose `KILL`.
5. If the run crossed 7 days with no commit, stop drifting and force either `KILL` or `RECOMMIT` now.
6. If prereg, judge lock, falsification, baseline freshness, and confirmed results are all clean, `SHIP` becomes available.
7. Availability is not obligation.
8. You still ship only if the result is worth saying out loud.
9. You do not keep a weak result alive because killing it feels wasteful.
10. You do not ship because leadership wants a win.
11. You do not recommit because the sunk cost hurts.
12. Choose the branch the evidence supports, not the branch that hurts least.

### Phase 5: If the answer is `KILL`, kill it cleanly
1. `KILL` is the default terminal state for weak, stale, or over-burned work.
2. Do it cleanly.
3. Do it once.
4. First update the hypothesis ledger.
5. Call `updateHypothesisStatus(cwd, id, "KILLED")`.
6. If the ledger should also carry the reason, reload entries with `loadHypotheses(cwd)`.
7. Set the matching entry's `killReason`.
8. Save the set back with `saveHypotheses(cwd, entries)`.
9. Second, write `experiments/{id}/KILLED.md`.
10. That file must include hypothesis ID, cumulative cost, time spent, and the reason for killing.
11. Include the claim too.
12. Use the real cost from `getHypothesisSpend(cwd, id)` and real elapsed time.
13. Good reasons look like this: spend exceeded `1.5 × costCap` without stable improvement; falsification exposed a cheaper disconfirming explanation; the run crossed 21 days with no commit and auto-killed; the result depended on stale or unreproduced baselines.
14. Bad reasons look like this: `maybe later`, `paused`, `not feeling it`.
15. Third, stop further execution on that record.
16. No more quiet runs under the same hypothesis.
17. No more quote-mining from its smoke outputs.
18. No more flipping `KILLED` back to `RUNNING`.
19. Fourth, preserve the evidence trail.
20. Do not delete `smokes/` and do not erase ledger entries.
21. Do not rewrite the history into something softer.
22. Fifth, enforce the sunk-cost rule.
23. Killed hypotheses cannot be silently revived.
24. If you want to revisit the idea, create a new entry in `HYPOTHESES.md`.
25. That new attempt gets a new ID, new prereg, and new budget.
26. Reusing the dead record is method fraud.

### Phase 6: If the answer is `RECOMMIT`, make it a new contract
1. `RECOMMIT` is not optimism and it is not procrastination dressed up as rigor.
2. It means the original contract has been breached or is about to be breached, and you can state exactly why more work is justified.
3. If you cannot name what changed, you do not have a recommit.
4. You have attachment.
5. First decide whether recommit is legal.
6. If the record is already `KILLED`, do not silently reopen it.
7. The sunk-cost rule still applies.
8. Use a new hypothesis entry instead.
9. If the run auto-killed after 21 days with no commit, treat it as dead.
10. Second, write the override in `OVERRIDES.md`.
11. Recommit requires a reason that is at least 50 characters long.
12. That minimum exists to kill one-line excuses.
13. The override should include date, hypothesis ID, trigger being overridden, old cap or time box, new cap or execution window, the reason, and what changed since the original plan.
14. The reason must describe a concrete change in evidence or execution context.
15. Acceptable reasons include a confirmed harness bug that invalidated earlier spend, a falsifier result that narrowed uncertainty to one decisive experiment, or a refreshed baseline that reopens the same comparison under the locked judge.
16. Unacceptable reasons include `we're close`, `it feels promising`, and `leadership wants a win`.
17. Third, update the live hypothesis record.
18. Load entries with `loadHypotheses(cwd)`.
19. Modify the matching entry.
20. Keep the same ID only if the claim is still the same hypothesis.
21. Update `costCap` if the budget changed.
22. Keep or set status to `RUNNING` if work continues.
23. Save with `saveHypotheses(cwd, entries)`.
24. Fourth, narrow the scope.
25. Write down the exact remaining experiment.
26. If the remaining work is not specific, kill instead.
27. Fifth, respect the gate.
28. Continuing without `OVERRIDES.md` is not recommit.
29. It is evasion.
30. Sixth, route back into disciplined execution.
31. The next runs should be the smallest set that can justify this exception.

### Phase 7: If the answer is `SHIP`, prove it deserves sunlight
1. `SHIP` is the rare branch.
2. Rare is healthy.
3. Before you ship, the repo must already look like a shipped result.
4. First confirm that spend policy is still intact.
5. If spend is greater than `1.5 × costCap`, do not jump straight to ship.
6. You must either `KILL` or `RECOMMIT` first.
7. Second confirm prereg integrity.
8. `experiments/{id}/prereg.md` must exist.
9. The confirmed result must correspond to the preregistered claim and setup.
10. Third confirm judge integrity.
11. Read `experiments/{id}/judge.lock` through `getJudgeLock(cwd, id)`.
12. Recompute the expected hash with `computeJudgeHash(hypothesis.judgeRef, id)`.
13. If those disagree, ship is blocked.
14. Fourth confirm falsification is clean.
15. Review the files under `experiments/{id}/falsifiers/`.
16. If they are missing or stale, rerun `runFalsificationAdversary({ claim, context, cwd })`.
17. A clean ship has no unresolved `falsified-or-unreproducible` verdicts, no ignored `cannot-audit` verdicts, and any `caveat-required` finding is reflected honestly in the result.
18. Fifth confirm baseline integrity.
19. Use `loadBaselines(cwd)` and `getBaselineAgeDays(...)`.
20. If the cited baseline is older than 30 days, refresh before shipping the comparison.
21. If the target was not reproduced under your locked judge, do not ship the comparative claim.
22. Sixth confirm result location.
23. Confirmed numbers belong in `experiments/{id}/RESULTS.md`.
24. Provisional numbers belong in `experiments/{id}/smokes/`.
25. Nothing in `smokes/` is quotable.
26. Seventh update status.
27. Call `updateHypothesisStatus(cwd, id, "CONFIRMED")`.
28. Eighth tag and publish.
29. Tag only after the confirmed artifacts are committed.
30. Publish only what is confirmed, what survived falsification, and what the gates allow.
31. If all gates passed, falsification is clean, and results are confirmed, ship the work.

### Phase 8: Close the loop so the repository tells the truth without you present
1. The repo should show one clear outcome per hypothesis.
2. After a kill, the authoritative terminal artifact is `experiments/{id}/KILLED.md`.
3. After a ship, the authoritative terminal artifact is `experiments/{id}/RESULTS.md`.
4. After a recommit, the authoritative exception record is `OVERRIDES.md`.
5. `HYPOTHESES.md` should agree with those artifacts.
6. `status = KILLED` must not point to a live execution story.
7. `status = CONFIRMED` must not depend on a smoke-only number.
8. `status = RUNNING` after recommit must be backed by a real override.
9. Leave the evidence trail intact.
10. Do not delete falsifier outputs because they are inconvenient.
11. Do not erase costs because the total looks bad.
12. Do not relabel a kill as a pause.
13. Future readers should be able to reconstruct the decision from files alone.
14. If they cannot, the method failed.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| `We already spent too much to stop now` | That is exactly why stopping may be correct. Prior spend is not evidence. |
| `One more run will probably settle it` | If you cannot name the uncertainty it resolves, you are drifting. |
| `The smokes look amazing` | `smokes/` is provisional and cannot justify a ship decision. |
| `We'll add the override later` | An unwritten override is not a recommit. |
| `We can flip it back from KILLED if needed` | Silent revival breaks the sunk-cost rule. New entry required. |
| `The baseline is only a little stale` | If `getBaselineAgeDays(...) > 30`, the comparison is stale enough to block ship language. |
| `The falsifier was being too picky` | Counterevidence does not disappear because it is inconvenient. |
| `We can write judge.lock now` | Retroactive locks prove nothing. They only conceal drift. |
| `Leadership needs a win` | Pressure does not convert weak evidence into confirmed results. |
| `No commit doesn't mean no progress` | This workflow uses repository evidence, not private feelings of momentum. |
| `Everything can't die` | Correct. Some things ship. Most should not. 5:1 kill-to-ship is normal. |
| `Killing it means the work was wasted` | A documented kill preserves learning and prevents further waste. |

## Red Flags - STOP
Stop and restart the decision process if:
- you want to quote a number from `experiments/{id}/smokes/`
- you want to ship even though spend exceeded `1.5 × costCap`
- you want to reopen a `KILLED` record in place
- you want to add `judge.lock` after results already exist
- you want to ignore an adversary verdict because it feels unfair
- you want to recommit without writing `OVERRIDES.md`
- your override reason cannot clear 50 meaningful characters
- you are calling a 21-day silent experiment `paused`
- `HYPOTHESES.md` says one thing and the experiment folder says another
- you are relying on baselines older than 30 days for a headline comparison
- you cannot explain what concrete new evidence justifies more budget
- you are deciding without reading the actual files

## Good vs Bad
### Good: clean kill
```markdown
# KILLED
- Hypothesis ID: h-017
- Claim: Router A improves answer quality over Router B on eval-set-3.
- Cumulative cost: $78.42
- Time spent: 9 days
- Decision: KILL
- Reason: Spend exceeded 1.5× the $50 cap and the last two confirmed runs failed to reproduce the earlier smoke gain under the locked judge.
```
Good because it records the real cost, the real time, and the real reason.

### Bad: evasive kill note
```markdown
# Maybe dead
Spent a lot.
Might revisit later if it becomes important.
```
Bad because it hides the decision and preserves deniability.

### Good: recommit with a real override
```markdown
## 2026-05-31 — Recommit h-024
- Trigger: spend exceeded 1.5× original cost cap
- Old cap: $40
- New cap: $65
- Scope: rerun only the preregistered eval after fixing a confirmed batching bug
- Reason: The prior spend is not informative because the harness duplicated 12% of prompts. The bug is fixed, the judge lock is unchanged, and one bounded rerun will decide whether the claim survives under the original prereg.
```
Good because it states what changed and binds the exception to one narrow next step.

### Bad: recommit by attachment
```markdown
## Override h-024
Reason: Feels close. Want a few more runs.
```
Bad because it is emotion masquerading as method.

### Good: ship only after the repo is clean
```markdown
Decision checklist for h-031
- prereg.md present and honored
- judge.lock present and hash matches computeJudgeHash(...)
- falsifiers reviewed with no unresolved falsified-or-unreproducible verdicts
- cited baseline refreshed within 30 days
- confirmed result written in experiments/h-031/RESULTS.md
- status updated to CONFIRMED
- ship tag created after the confirmed artifacts were committed
```
Good because ship depends on confirmed artifacts and gate compliance, not excitement.

### Bad: shipping from smoke and hope
```markdown
We beat Model X by 4.2%.
Source: experiments/h-031/smokes/run-07.md
Need to clean up prereg and falsifier notes later.
```
Bad because provisional data is being treated like publishable truth.

### Good: respect the sunk-cost rule
```markdown
# New hypothesis entry
- ID: h-044
- Claim: Router A with retrieval filter C improves answer quality over Router B.
- Reason for new entry: h-017 was killed after budget overrun; this retry has a new preregistration, a fresh budget, and a materially different setup.
```
Good because the old record stays dead and the new attempt gets a fresh contract.

### Bad: silent revival
```markdown
- ID: h-017
- Status: RUNNING
- Note: continuing after a short pause
```
Bad because it launders a dead experiment back into life.

## Why This Matters
This phase keeps research from turning into gambling.
Without kill discipline, cost caps are decorative.
Without recommit discipline, overrides become a back door for denial.
Without ship discipline, publication becomes cherry-picking.

A documented kill preserves learning.
A documented recommit explains why an exception was justified.
A documented ship proves the claim survived prereg, judge integrity, baseline freshness, falsification, and confirmed-result checks.

That is how the repository tells the truth even when nobody is in the room.
Anything weaker is just expensive self-deception.

After this, use `/skill:verification-before-publication`.
