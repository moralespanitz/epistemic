---
name: kill-or-ship
description: Use when a hypothesis has reached a real decision point and you must choose KILL, PIVOT, RECOMMIT, REFINE, or SHIP from repository evidence.
---

> **Related skills:** `/skill:research-question`, `/skill:experiment-execution`, `/skill:falsification-review`, `/skill:surprise-triage`, `/skill:verification-before-publication`

# Kill or Ship

## Overview
This is the decision phase.
Not the coping phase.
Not the `one more run` phase.
Not the place where sunk cost gets a vote.

You must choose exactly one branch:
- `KILL` — the current claim dies.
- `PIVOT` — the current claim dies, but the failure teaches a different claim worth registering as a new hypothesis.
- `RECOMMIT` — same claim, same method, bounded extra budget or time under a written override.
- `REFINE` — same claim, changed method, written override, explicit refinement count, then rerun from execution.
- `SHIP` — the claim survived the gates and is ready for publication verification.

Two distinctions are non-negotiable:
1. `PIVOT` is still a kill of the old hypothesis.
2. `REFINE` is not `RECOMMIT`. `RECOMMIT` keeps the method. `REFINE` changes it.

`COST_OVERRUN` is not a sixth branch.
It is the `LessonEntry.outcome` you write when budget pressure forced the decision.

Current repo reality matters:
- `src/state/repo.ts` is the canonical state surface.
- `src/adversary/dispatch.ts` is the adversary entrypoint.
- `src/index.ts` still shows `registerKillCriteria(...)` as planned, not active.

So no live gate is going to save you from a sentimental decision.
This skill is the gate.

## Quick Reference
| Branch | Same claim? | Same method? | Required writes | Lesson outcome |
| --- | --- | --- | --- | --- |
| `KILL` | No future work on this claim | n/a | `HYPOTHESES.md` -> `KILLED`, `killReason`, `experiments/{id}/KILLED.md` | `"KILLED"` or `"COST_OVERRUN"` |
| `PIVOT` | No | No | old entry `KILLED`, kill reason points to new id, `experiments/{id}/KILLED.md`, new hypothesis entry | `"PIVOT"` |
| `RECOMMIT` | Yes | Yes | `OVERRIDES.md`, possible cap or window change, status stays `RUNNING` | `"COST_OVERRUN"` only if budget forced it |
| `REFINE` | Yes | No | `OVERRIDES.md`, increment `Refinement count`, rerun | none |
| `SHIP` | Yes | Yes | confirmed result on disk, status `CONFIRMED` | none |

## The Iron Law
```text
5:1 kill-to-ship is normal.
Pivots count as kills of the old claim.
Cost already spent still does not vote.
```
Most ideas should die.
Some should pivot.
A few should survive long enough to ship.
Anything softer becomes zombie research.

## When to Use
Use this skill when:
- falsification review is complete and the next move must be explicit
- surprise triage is complete and the anomaly is now explained, downgraded, or fatal
- an adversary verdict came back `falsified-or-unreproducible`
- spend is near or above the hypothesis `costCap`
- the result is clean enough that `SHIP` might be available
- the same claim may need either a bounded recommit or a methodological refinement
- a failed claim appears to suggest a better new claim
- you are about to change hypothesis status, write `KILLED.md`, or write an override
- you are tempted to quietly stop talking about a weak run instead of deciding it

Use it especially when the decision feels awkward.
That usually means emotion is trying to outvote evidence.

## When NOT to Use
Do not use this skill:
- before `experiments/{id}/prereg.md` exists
- before the run produced any real evidence
- instead of `/skill:falsification-review`
- instead of `/skill:surprise-triage`
- to publish anything that still lives only in `smokes/`
- to silently revive a `KILLED` record
- to launder a changed claim under the old hypothesis id
- to excuse missing `judge.lock`, stale baselines, or missing falsifier files
- to backfill method changes after you already shipped the result

If the idea itself is changing before the evidence exists, use `/skill:research-question` or `/skill:preregistration` instead.

## Decision Tree
```text
Did the claim actually fail?
├─ yes
│  ├─ Ask first: "What does this failure teach us that we didn't know before?"
│  ├─ Concrete new claim, new contract, new id? -> PIVOT
│  └─ No concrete new claim? -> KILL
└─ no
   ├─ Same claim, same method, bounded extra budget or time? -> RECOMMIT
   ├─ Same claim, changed method? -> REFINE
   └─ All gates clean, confirmed result on disk, no unresolved overrun? -> SHIP
```

`REFINE` is not a loophole after a real falsifier kill.
If the claim died, kill it or pivot it.
`REFINE` is for the same claim when the method changed and the claim itself is still live.

## State Surface
Read the actual repo state before deciding anything.

| Surface | Why it matters |
| --- | --- |
| `HYPOTHESES.md` | canonical branch record, `killReason`, new hypothesis entry, refinement counter |
| `.epistemic/cost-ledger.jsonl` | total spend and spend composition |
| `.epistemic/lessons.jsonl` | cross-run memory via `appendLesson()` |
| `OVERRIDES.md` | mandatory authorization for `RECOMMIT` and `REFINE` |
| `experiments/{id}/prereg.md` | `SHIP` eligibility and method contract |
| `experiments/{id}/judge.lock` | proof the judge did not drift |
| `experiments/{id}/smokes/` | provisional evidence only |
| `experiments/{id}/RESULTS.md` | confirmed result required for `SHIP` |
| `experiments/{id}/KILLED.md` | terminal artifact for `KILL` and the old side of a `PIVOT` |
| `experiments/{id}/falsifiers/` | why the claim survived or died |
| `BASELINES.md` and `experiments/repro_{name}/prereg.md` | freshness and reproduction for comparison claims |
| `src/state/repo.ts` | canonical helpers and types |
| `src/adversary/dispatch.ts` | adversary verdict source |
| `src/index.ts` | proves the kill gate is still planned, not enforced |

State helpers you will actually use here:
- `loadRepoState(cwd)`
- `loadHypotheses(cwd)`, `getActiveHypothesis(entries)`, `parseHypotheses(content)`
- `hypothesisToMarkdown(entry)`, `saveHypotheses(cwd, entries)`, `updateHypothesisStatus(cwd, id, status)`
- `fileExists(path)`
- `getHypothesisSpend(cwd, id)`, `getHypothesisSpendByCategory(cwd, id)`, `getAllHypothesisSpends(cwd)`
- `loadBaselines(cwd)`, `getBaselineAgeDays(entry)`
- `getJudgeLock(cwd, id)`, `computeJudgeHash(judgeRef, id)`
- `appendLesson(cwd, lesson)`
- `runFalsificationAdversary({ claim, context, cwd })` if the decision depends on missing or stale adversary output

Current repo reality:
- `HypothesisEntry` supports `killReason`.
- `LessonEntry.outcome` supports `"KILLED"`, `"PIVOT"`, `"COST_OVERRUN"`, and `"UNREPRODUCIBLE_BASELINE"`.
- `HypothesisEntry` does **not** currently carry a refinement counter.

So `REFINE` needs a visible `- **Refinement count:** N` line in the hypothesis block.
Preserve it deliberately.
Do not assume `saveHypotheses(...)` will keep unknown fields.

## The Process

### 1. Load the real decision state
1. Start from repo state, not memory.
2. Call `loadRepoState(cwd)` for the top-level scaffold.
3. Call `loadHypotheses(cwd)` and identify the active hypothesis.
4. If several hypotheses could match, resolve the exact `id` explicitly.
5. Read the active `HypothesisEntry` closely enough to answer:
   - what is the claim
   - what falsifies it
   - what is the best-case conclusion
   - what is the cost cap
   - what compute target is expected
   - what judge is locked
   - what baseline is being compared
   - what the current status says
6. Locate `experiments/{id}/`.
7. Check `prereg.md`, `judge.lock`, `RESULTS.md`, and `KILLED.md` with `fileExists(...)`.
8. Inspect `smokes/`, `falsifiers/`, and `baselines/`.
9. Pull total spend with `getHypothesisSpend(cwd, id)`.
10. Pull the spend split with `getHypothesisSpendByCategory(cwd, id)`.
11. If shared budget matters, inspect `getAllHypothesisSpends(cwd)`.
12. For comparison claims, load the relevant baseline metadata and freshness.
13. Do not decide from memory.
14. Do not decide from the last encouraging run.
15. Do not decide from the loudest person in the room.

### 2. Read the money as diagnosis, not decoration
1. Total spend is not enough.
2. You must read the split from `getHypothesisSpendByCategory(cwd, id)`.
3. Record both numbers: `llm` and `compute`.
4. The split changes the story.
5. A hypothesis that spent `$10` on LLM and `$200` on Modal is not failing the same way as one that spent `$180` on judge calls and `$5` on compute.
6. Interpret the split before you write the reason:
   - `llm >> compute` often means the hypothesis, judge, prompt, or search loop consumed the budget.
   - `compute >> llm` often means the substrate, orchestration path, or execution economics consumed the budget.
   - low spend with a decisive falsifier means kill quickly instead of defending the sunk cost.
7. Compare total spend against `costCap`.
8. If spend is greater than `1.5 × costCap`, treat it as a forced decision point.
9. `SHIP` is closed until the overrun is explicitly resolved.
10. If budget pressure drove the outcome, the lesson you write later uses `outcome: "COST_OVERRUN"`.

### 3. Close branches that are not legally available
1. `SHIP` is closed if `experiments/{id}/prereg.md` is missing.
2. `SHIP` is closed if `judge.lock` is missing or does not match `computeJudgeHash(h.judgeRef, id)`.
3. `SHIP` is closed if the claim still depends on `smokes/`.
4. `SHIP` is closed if comparison language depends on a stale or unreproduced baseline.
5. `SHIP` is closed if the falsifier files show unresolved `falsified-or-unreproducible` or `cannot-audit` verdicts.
6. `SHIP` is closed if cost overrun was never explicitly resolved.
7. `RECOMMIT` is closed if the claim changed.
8. `RECOMMIT` is closed if the method changed.
9. `REFINE` is closed if the claim changed.
10. `REFINE` is closed if you cannot describe the old method, the new method, and why the claim itself still deserves to live.
11. `PIVOT` is closed if you do not have a concrete new hypothesis.
12. A killed hypothesis cannot be reopened in place.
13. If the old idea deserves another life, it gets a new id.

### 4. When the adversary says `falsified`, ask the pivot question first
Treat any `falsified-or-unreproducible` verdict as a real falsifier hit for this phase.

Ask this exact question before you even think about `KILL`:

> **What does this failure teach us that we didn't know before?**

Then decide honestly:
1. If the answer yields a concrete new claim, new boundary condition, or new comparator that the old evidence actually revealed, choose `PIVOT`.
2. If the answer is just a plea for more effort, choose `KILL`.
3. If the answer is `same claim, but we need a different method`, that is only `REFINE` when the claim itself survived and only the method is changing.
4. If the falsifier killed the claim as stated, `REFINE` is not available.
5. `PIVOT` comes before `KILL` in this branch because learning is the only honest rescue.
6. No new learning, no pivot.

### 5. Separate `RECOMMIT` from `REFINE`
This is where people lie to themselves.

Choose `RECOMMIT` only when all of these are true:
- same hypothesis id
- same claim
- same method
- same success condition
- one bounded extra window of time or budget is justified by concrete new information

Choose `REFINE` only when all of these are true:
- same hypothesis id
- same claim
- same success or failure boundary
- the method changed
- the change is written explicitly
- the claim is still worth testing after the method change

If the claim changed, it is not `RECOMMIT`.
If the claim changed, it is not `REFINE`.
It is either `PIVOT` or `KILL`.

### 6. Execute the chosen branch exactly

#### If the answer is `KILL`
1. `KILL` means the current claim is dead and there is no concrete better claim to register right now.
2. Call `updateHypothesisStatus(cwd, id, "KILLED")`.
3. Reload the entries with `loadHypotheses(cwd)`.
4. Set the matching entry's `killReason`.
5. Save the entries back with `saveHypotheses(cwd, entries)`.
6. Write `experiments/{id}/KILLED.md`.
7. Include:
   - hypothesis id
   - claim
   - total spend
   - spend split (`llm`, `compute`)
   - compute target
   - time spent
   - decision: `KILL`
   - root cause
8. If budget pressure drove the kill, say so plainly and include the split.
9. Preserve `smokes/`, falsifier files, and ledger history.
10. Do not reopen the same id later.

#### If the answer is `PIVOT`
1. `PIVOT` means the old claim died.
2. Start there.
3. Update the old hypothesis to `KILLED`.
4. Set `killReason` so it points to the new hypothesis id and the lesson learned.
5. Write `experiments/{oldId}/KILLED.md`.
6. The pivot note must include:
   - old hypothesis id
   - old claim
   - why the old claim failed
   - what the failure taught
   - total spend and spend split
   - new hypothesis id
7. Then create a brand-new hypothesis entry.
8. Use `loadHypotheses(cwd)`, append the new `HypothesisEntry`, then persist with `saveHypotheses(cwd, entries)`.
9. New id. New timestamp. New contract.
10. The new entry must include `id`, `claim`, `falsifier`, `bestCaseConclusion`, `n`, `judgeRef`, `baselineRef`, `costCap`, `computeTarget`, `status: OPEN`, and `timestamp`.
11. If you cannot write the new claim concretely, then you do not have a pivot yet.
12. Kill the old hypothesis honestly and return to `/skill:research-question` instead of faking specificity.
13. The pivot rationale must explain what was learned, not merely what you want to try next.

#### If the answer is `RECOMMIT`
1. `RECOMMIT` is same claim, same method, tighter remaining work.
2. Write the override in `OVERRIDES.md`.
3. The reason must be at least 50 characters long.
4. Include:
   - date
   - hypothesis id
   - trigger being overridden
   - old cap or window
   - new cap or window
   - exact remaining experiment
   - what changed since the original plan
5. If the remaining work is not specific, do not recommit.
6. Update the live hypothesis entry only as needed:
   - adjusted `costCap`
   - status `RUNNING`
7. Keep the same id.
8. Keep the same claim.
9. Keep the same method.
10. If budget pressure forced the recommit, append a `COST_OVERRUN` lesson.

#### If the answer is `REFINE`
1. `REFINE` keeps the claim and changes the method.
2. Write the override in `OVERRIDES.md`.
3. The reason must be at least 50 characters long.
4. The override must name:
   - the old method
   - the new method
   - why the old method failed
   - why the same claim still deserves a test
5. Increment the refinement counter in the hypothesis entry.
6. Write it as an explicit `- **Refinement count:** N` line in that hypothesis block.
7. Because the current state serializer does not round-trip that field, preserve the line manually when you edit the block.
8. If you must update supported fields in the same pass, re-read the raw markdown and make one careful edit instead of helper-round-tripping the block and dropping the counter.
9. Keep the same id.
10. Do not create a new hypothesis entry.
11. If the change alters the claim, comparator, metric, baseline target, or the meaning of success, it is not `REFINE`.
12. It is `PIVOT`.
13. Once the override, method record, and counter are written, route the work back to `/skill:experiment-execution`.
14. Do not jump from `REFINE` straight to publication.

#### If the answer is `SHIP`
1. `SHIP` is the rare branch.
2. Before you take it, the repo must already look ship-ready.
3. Confirm:
   - prereg exists and still matches the claim
   - `judge.lock` matches `computeJudgeHash(...)`
   - the result survived falsification review
   - any required baseline is fresh and reproduced
   - the confirmed number lives in `experiments/{id}/RESULTS.md`
   - the claim no longer depends on `smokes/`
   - no unresolved cost overrun remains
4. If any of that is false, `SHIP` is not available.
5. If all of it is true, call `updateHypothesisStatus(cwd, id, "CONFIRMED")`.
6. `SHIP` does not skip publication verification.
7. It earns the right to start it.

## Cross-Run Lessons Are Mandatory
On `KILL`, `PIVOT`, or budget-driven overrun decisions, append a `LessonEntry` through `appendLesson()` from `src/state/repo.ts`.
Do not hand-edit `.epistemic/lessons.jsonl`.

Use the real fields:
- `hypothesisId`
- `outcome`
- `summary`
- `costSpent`
- `rootCause`

Canonical shape:
```ts
await appendLesson(cwd, {
  timestamp: new Date().toISOString(),
  hypothesisId: id,
  outcome,
  summary,
  costSpent: totalSpend,
  rootCause,
});
```

Decision-to-lesson mapping:
- `KILL` -> `outcome: "KILLED"` unless budget pressure was the forcing reason
- `PIVOT` -> `outcome: "PIVOT"`
- budget-driven `KILL` or `RECOMMIT` -> `outcome: "COST_OVERRUN"`

Write the lesson like an adult:
- `summary` says what was learned or why the line stopped
- `rootCause` names the mechanism, not the mood
- `costSpent` is the real total from `getHypothesisSpend(...)`

Good `rootCause`:
- `Modal compute burn dominated the run and no stable gain survived the locked judge.`
- `Falsification showed the gain existed only on long-context tasks, so the general claim died.`

Bad `rootCause`:
- `Not feeling it`
- `Maybe later`
- `Too messy`

## Close the Loop
The decision is not done until the repository tells one story without you present.

After `KILL` or `PIVOT`:
- `HYPOTHESES.md` says `KILLED`
- `killReason` is present
- `experiments/{id}/KILLED.md` exists
- `.epistemic/lessons.jsonl` has the lesson row

After `RECOMMIT`:
- `OVERRIDES.md` exists
- the remaining work is bounded
- any budget-driven exception has a `COST_OVERRUN` lesson
- status stays `RUNNING` for a real reason, not habit

After `REFINE`:
- `OVERRIDES.md` exists
- `Refinement count` incremented
- the same claim still exists
- the next step is `/skill:experiment-execution`

After `SHIP`:
- `experiments/{id}/RESULTS.md` is the authoritative artifact
- status is `CONFIRMED`
- nothing quoteable still depends on `smokes/`

If the files disagree, the decision is not finished.

## Common Rationalizations
| Excuse | Reality |
| --- | --- |
| `We already spent too much to stop now.` | Prior spend is not evidence. It is exactly why you need a decision. |
| `Pivot is basically the same as keeping it alive.` | No. `PIVOT` kills the old claim and creates a new id. |
| `Falsified means kill immediately.` | First ask what the failure taught. `PIVOT` comes before `KILL` when the evidence supports a new claim. |
| `Refine and recommit are basically the same.` | No. `RECOMMIT` keeps the method. `REFINE` changes it. |
| `The total cost is enough.` | No. Read the split. `$10` LLM + `$200` Modal is a different failure mode from `$180` of judge calls. |
| `We can write the lesson later.` | Unwritten lessons are forgotten failures. Use `appendLesson()` now. |
| `We can reopen the killed hypothesis if the new idea works.` | Silent revival is method fraud. New id required. |
| `The smokes look great, so ship is fine.` | `smokes/` is provisional. It does not authorize `SHIP`. |
| `The override can be one sentence.` | Short excuses are why the 50-character minimum exists. |
| `Refinement count is bookkeeping.` | It is churn accounting. If the same claim needed three method rewrites, that matters. |

## Red Flags - STOP
Stop and restart the decision if:
- you want to ship from `smokes/`
- you want to ignore the spend split
- you want to treat `COST_OVERRUN` like a branch instead of a lesson label
- you want to pivot without a concrete new hypothesis id
- you want to refine without naming the old and new method
- you want to recommit even though the claim changed
- you want to call a real falsifier hit a refinement
- you want to keep the old id after changing the claim
- you want to skip `.epistemic/lessons.jsonl` because the failure feels embarrassing
- `HYPOTHESES.md`, `KILLED.md`, `RESULTS.md`, and `OVERRIDES.md` tell different stories

All of those mean the same thing:
stop, reread the artifacts, and let the repository win.

## Good vs Bad

### Good: pivot from real learning
```markdown
# KILLED
- Hypothesis ID: h-017
- Claim: Router A improves answer quality over Router B across the full eval set.
- Decision: PIVOT
- Why old claim died: Falsification showed the gain vanished on short-context tasks under the locked judge.
- What we learned: The effect appears limited to long-context routing.
- Successor hypothesis: h-044
- Spend: $210.14 total ($12.08 llm, $198.06 compute)
```
Good because the old claim is dead, the lesson is explicit, and the new claim is narrower.

### Bad: sentimental pivot
```markdown
- Status: RUNNING
- Note: same idea, just with a slightly smarter framing
```
Bad because nothing died, nothing was learned, and the new contract is hidden.

### Good: refine the method without changing the claim
```markdown
## 2026-05-31 — Refine h-024
- Reason: The claim is unchanged, but the extraction parser was dropping valid answers and contaminating the score. We are keeping the same claim, comparator, metric, and judge, updating only the parser, and rerunning the full preregistered sample.
- Method change: parser v1 -> parser v2
- Hypothesis entry: Refinement count 2
```
Good because the claim stayed put, the method change is explicit, and the churn is counted.

### Bad: hide a method rewrite inside recommit
```markdown
## Override h-024
- Reason: Want a few more runs and some evaluation cleanup
```
Bad because `evaluation cleanup` is method change disguised as budget extension.

### Good: cost-overrun lesson with diagnosis
```ts
await appendLesson(cwd, {
  timestamp: "2026-05-31T18:04:11.233Z",
  hypothesisId: "h-031",
  outcome: "COST_OVERRUN",
  summary: "Killed after compute burn exceeded the budget without stable improvement.",
  costSpent: 210.14,
  rootCause: "Compute spend on modal dominated the run while the locked-judge win rate stayed flat.",
});
```
Good because the lesson says why the budget mattered, not just that the number was large.

### Bad: vague kill reason
```markdown
# Maybe dead
Spent a lot.
Might revisit later.
```
Bad because it preserves deniability instead of recording a decision.

After `SHIP`, the next required skill is `/skill:verification-before-publication`.
