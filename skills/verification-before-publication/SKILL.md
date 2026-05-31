---
name: verification-before-publication
description: Use when about to state, circulate, or publish any research result, comparison claim, or confirmed conclusion.
---

> **Related skills:** `/skill:research-question`, `/skill:preregistration`, `/skill:baseline-reproduction`, `/skill:experiment-execution`, `/skill:falsification-review`, `/skill:surprise-triage`, `/skill:kill-or-ship`

# Verification Before Publication

## Overview
This is the final gate.
Publication is where local sloppiness becomes recorded falsehood.
A result that is merely interesting can stay in `smokes/`.
A result that will be quoted, merged, or published has to survive the full suite.

Core principle: a result is publishable only when the full evidence chain is fresh.
The metric is only the last link.
Do not inspect the last link and assume the chain holds.

A clean number is not enough.
A line in `RESULTS.md` is not enough.
A previous successful run is not enough.
Your memory is not enough.
If the repository cannot prove the claim now, the claim is not ready now.

Before claiming any result, run the full verification suite.
Not the comfortable subset.
Not the checks you already know will pass.
The full suite.

## The Iron Law

```text
NO PUBLICATION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Fresh means the evidence matches the exact hypothesis id, the current claim text, the current `judgeRef`, the current `judge.lock`, the current baselines, the current falsifier outputs, the current cost ledger, the current result files, and the current surprise-triage state.
If you did not run the full suite in this work session, you do not have publication evidence.
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
- quote a baseline comparison in a draft, commit message, PR description, or status update
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
- when the right outcome is to kill the hypothesis; use `/skill:kill-or-ship`
- as a substitute for earlier rigor
- as a ritual after you already made the claim

## The Gate Function

```text
IDENTIFY -> RUN -> READ -> VERIFY -> ONLY THEN CLAIM

1. IDENTIFY the exact hypothesis, files, and numbers.
2. RUN the full verification suite.
3. READ the actual files and outputs.
4. VERIFY every dependency under the claim.
5. ONLY THEN make the claim.

Skip a step = no verification.
Run a subset = no verification.
Reuse old output = no verification.
```

Use the sequence literally.
`I basically checked` means you did not check.
`The important parts are fine` means you skipped the parts most likely to retract the claim later.

## State and Artifact Surface
Use the actual API from `src/state/repo.ts` and `src/adversary/dispatch.ts`.
Do not build side bookkeeping.

Use these state functions:
- `loadRepoState(cwd)`, `loadHypotheses(cwd)`, `parseHypotheses(content)`, `getActiveHypothesis(entries)`
- `hypothesisToMarkdown(h)`, `saveHypotheses(cwd, entries)`, `updateHypothesisStatus(cwd, id, status)`
- `loadBaselines(cwd)`, `getBaselineAgeDays(b)`
- `getHypothesisSpend(cwd, id)`, `getAllHypothesisSpends(cwd)`, `appendCostRecord(cwd, record)`
- `computeJudgeHash(judgeRef, hypothesisId)`, `getJudgeLock(cwd, hypothesisId)`, `writeJudgeLock(cwd, hypothesisId, judgeRef)`
- `fileExists(path)`

Use this adversary entrypoint:
- `runFalsificationAdversary({ claim, cwd, hypothesisId })`

Respect these evidence types:
- `HypothesisEntry`, `BaselineEntry`, `CostRecord`, `AdversaryVerdict`

Read these files before publishing:
- `HYPOTHESES.md`, `BASELINES.md`, `RESULTS.md`, `OVERRIDES.md`
- `.epistemic/cost-ledger.jsonl`
- `experiments/{id}/prereg.md`, `experiments/{id}/judge.lock`
- `experiments/{id}/baselines/{name}.md`, `experiments/{id}/falsifiers/{model}.md`
- `experiments/{id}/smokes/`, `experiments/{id}/RESULTS.md`, `experiments/{id}/KILLED.md`

## Verification Checklist
Before any publication claim, every item below MUST be true:
- `experiments/{id}/prereg.md` exists and still matches the claim being published.
- `computeJudgeHash(judgeRef, id)` matches `getJudgeLock(cwd, id)` and `experiments/{id}/judge.lock` exists.
- All required baselines from `BASELINES.md` are fresh, reproduced, and younger than 30 days.
- All falsifier verdicts are written to `experiments/{id}/falsifiers/{model}.md` and actually evaluated.
- `.epistemic/cost-ledger.jsonl` is current and the spend still fits the governing decision.
- No surprising number remains pending triage in `smokes/` or `experiments/{id}/smokes/`.
- `RESULTS.md` and `experiments/{id}/RESULTS.md` contain confirmed, falsification-passed results only.
- Nothing provisional, killed, unreproduced, or overridden without written reason is being presented as final.

## The Process

### 1. Identify the exact publication unit
1. Load hypotheses with `loadHypotheses(cwd)`.
2. If one active hypothesis exists, use `getActiveHypothesis(entries)`.
3. If several hypotheses could match, select the exact `id` explicitly.
4. Read the selected `HypothesisEntry` and capture `claim`, `falsifier`, `judgeRef`, `baselineRef`, `costCap`, and `status`.
5. Name the exact sentence you are about to publish.
6. Name the exact file that will carry it.
7. If you cannot identify the precise publication unit, stop.
8. Vague targets produce vague verification, and vague verification ships false claims.

### 2. Establish authoritative repo state
1. Call `loadRepoState(cwd)`.
2. Read `HYPOTHESES.md`, `BASELINES.md`, and root `RESULTS.md`.
3. Read `experiments/{id}/RESULTS.md` when it exists.
4. Read `OVERRIDES.md` when any gate was bypassed.
5. If `HYPOTHESES.md` was edited manually and looks suspicious, rerun `parseHypotheses(content)` on the raw markdown.
6. Publication review starts from current repo state, not memory.

### 3. Verify preregistration integrity
1. Compute `experiments/{id}/prereg.md`.
2. Use `fileExists(path)`.
3. If the file is missing, block publication immediately.
4. Read the prereg file.
5. Confirm the prereg claim still matches the publication claim.
6. Confirm the prereg falsifier still matches the failure condition being claimed against.
7. Confirm the reported result stays inside prereg scope.
8. Final verification does not legalize scope drift.

### 4. Verify the judge lock
1. Take the current `judgeRef` from the hypothesis entry.
2. Read the lock with `getJudgeLock(cwd, id)`.
3. If the lock is missing, block publication.
4. Compute `computeJudgeHash(judgeRef, id)`.
5. Compare the expected hash against the lock contents.
6. If they differ, you have judge drift.
7. Drift invalidates the claim until resolved.
8. `writeJudgeLock(...)` is for legitimate lock creation, not failed-review cleanup.

### 5. Verify baseline freshness and reproduction
1. Load baselines with `loadBaselines(cwd)`.
2. Find every baseline the claim depends on.
3. Compute age with `getBaselineAgeDays(entry)`.
4. If any required baseline is 30 days old or older, it is stale.
5. Stale baselines cannot support publication comparisons.
6. Read `experiments/{id}/baselines/{name}.md` when present.
7. If the claim says `beats X`, verify `X` was reproduced, not merely cited.
8. A source URL proves provenance, not reproduction.

### 6. Verify falsifier coverage and verdict meaning
1. Inspect `experiments/{id}/falsifiers/`.
2. Read every `experiments/{id}/falsifiers/{model}.md` file.
3. If a required verdict file is missing, run `runFalsificationAdversary({ claim, cwd, hypothesisId: id })`.
4. Persist the returned `AdversaryVerdict` records before relying on them.
5. Read the persisted verdicts back.
6. If any verdict is `falsified-or-unreproducible`, publication is blocked.
7. If any verdict is `cannot-audit`, publication is blocked until the audit gap is fixed or explicitly overridden.
8. If any verdict is `caveat-required`, the caveat must travel with the claim.

### 7. Verify cost ledger integrity
1. Read `.epistemic/cost-ledger.jsonl`.
2. Call `getHypothesisSpend(cwd, id)`.
3. If shared work matters, also call `getAllHypothesisSpends(cwd)`.
4. Confirm current work is represented in the ledger.
5. Confirm the spend still fits the governing decision for the hypothesis.
6. If history is incomplete, the claim is not auditable.
7. Use `appendCostRecord(...)` only to record a real omitted event.
8. Do not backfill fiction to make publication easier.

### 8. Verify surprise status
1. Inspect `smokes/`.
2. Inspect `experiments/{id}/smokes/`.
3. Any number living only there is provisional.
4. Provisional numbers do not belong in headline files.
5. Compare the candidate result against the most recent comparable prior result.
6. If the delta is surprising, route through `/skill:surprise-triage` first.
7. If surprise triage is incomplete, publication is blocked.
8. `Looks stable` is not triage.

### 9. Verify the results files
1. Read root `RESULTS.md`.
2. Read `experiments/{id}/RESULTS.md` when it exists.
3. Confirm every published number is within prereg scope.
4. Confirm every published number used the locked judge.
5. Confirm every published comparison uses fresh reproduced baselines.
6. Confirm every published headline survived falsifier review.
7. Confirm no smoke-only number was copied into a final file.
8. Confirm no killed or provisional result is being presented as confirmed.

### 10. Decide from evidence, not momentum
1. If every check passed, the result is eligible for publication.
2. Only then may `updateHypothesisStatus(cwd, id, "CONFIRMED")` be called when warranted.
3. If the hypothesis record needs cleanup first, normalize it with `hypothesisToMarkdown(h)` and `saveHypotheses(cwd, entries)`.
4. If any check failed, block the claim plainly.
5. If the hypothesis is dead, route to `/skill:kill-or-ship` and write `experiments/{id}/KILLED.md`.
6. Publication review ends in one of two states: publishable or blocked.

## Full Verification Suite
Run the whole suite every time.
Do not skip the checks that feel administrative.
Those are the checks that stop embarrassing claims.

```text
1. loadHypotheses(cwd)
2. getActiveHypothesis(entries) or select explicit id
3. loadRepoState(cwd)
4. fileExists(`experiments/${id}/prereg.md`)
5. read `experiments/${id}/prereg.md`
6. getJudgeLock(cwd, id)
7. computeJudgeHash(judgeRef, id)
8. loadBaselines(cwd)
9. getBaselineAgeDays(b) for each required baseline
10. read `experiments/${id}/baselines/{name}.md` when present
11. read `experiments/${id}/falsifiers/{model}.md`
12. runFalsificationAdversary(...) if verdicts are missing or stale
13. read `.epistemic/cost-ledger.jsonl`
14. getHypothesisSpend(cwd, id)
15. inspect `smokes/` and `experiments/${id}/smokes/`
16. read `RESULTS.md`
17. read `experiments/${id}/RESULTS.md` when present
18. read `OVERRIDES.md` if any exception was used
19. update status only after the full suite passes
20. only then make the claim
```

## Common Failures

| Failure | What actually happened | Correct response |
|---------|------------------------|------------------|
| Claimed from `RESULTS.md` alone | Verified the headline, not the chain | Run the full suite |
| Verified prereg and stopped | Treated one gate as all gates | Continue through every dependency |
| Saw `judge.lock` and assumed safety | Checked existence, not equality | Recompute and compare the hash |
| Used a cited baseline as a reproduced baseline | Collapsed sourcing into reproduction | Reproduce or drop the comparison |
| Ran falsifiers and ignored verdict text | Mistook motion for verification | Read and evaluate every verdict |
| Copied a smoke number into a final file | Promoted provisional evidence | Triage first |
| Ignored missing ledger entries | Lost auditability under pressure | Repair the record or block publication |
| Marked status `CONFIRMED` early | Used state as aspiration | Let evidence determine status |

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| `The result is already written down.` | Files can be wrong. Verify the evidence chain. |
| `I checked this last time.` | Last time is not this time. |
| `The judge only changed a little.` | Small drift is still drift. |
| `The baseline is famous.` | Fame is not reproduction. |
| `The baseline is 31 days old, basically fresh.` | Stale is stale. |
| `The falsifier files exist.` | Existence is not evaluation. |
| `No adversary fully killed it.` | One unresolved blocker is enough. |
| `The cheap disconfirming test probably would not matter.` | Then run it and prove it. |
| `The ledger is close enough.` | Close enough is not auditable. |
| `I can patch the ledger later.` | Retroactive bookkeeping invites fiction. |
| `The smoke run looks stable.` | Smoke evidence is still provisional. |
| `This is just an internal summary.` | Internal falsehood becomes external fast. |
| `I only changed wording.` | Wording can widen or harden the claim. |
| `The paper draft needs a number now.` | Then the draft waits. |
| `The override is obvious.` | If it is not in `OVERRIDES.md`, it does not exist. |
| `The status is basically confirmed.` | Status follows evidence. |
| `The gates would have blocked me.` | Gates catch classes of mistakes, not the full publication chain. |
| `Nothing surprising happened.` | Check `smokes/`. Do not trust vibes. |

## Red Flags - STOP
Stop immediately if any of these thoughts show up:
- `Probably ready.`
- `Good enough.`
- `Close enough.`
- `I only need one more quick check.`
- `The rest will be fine.`
- `I remember the lock matching.`
- `The baseline is recent enough.`
- `The falsifier concern is minor.`
- `The smoke number is basically confirmed.`
- `I can fix the ledger afterward.`
- `Nobody will ask how this was verified.`
- `This wording change does not count.`
- `I need the conclusion now.`

Every one of these means the same thing:
you are trying to publish faster than you are verifying.

## Good vs Bad

### 1. Judge lock verification
**Good**
```ts
const entries = await loadHypotheses(cwd);
const active = getActiveHypothesis(entries);
if (!active) throw new Error("No active hypothesis");
const locked = await getJudgeLock(cwd, active.id);
if (!locked) throw new Error(`Missing judge.lock for ${active.id}`);
const expected = computeJudgeHash(active.judgeRef, active.id);
if (locked !== expected) throw new Error(`Judge drift for ${active.id}`);
```
**Bad**
```ts
const locked = await getJudgeLock(cwd, id);
if (locked) console.log("judge lock exists");
```

### 2. Baseline comparison
**Good**
```ts
const baselines = await loadBaselines(cwd);
const target = baselines.find(b => b.name === "Model-X");
if (!target) throw new Error("Missing baseline metadata");
if (getBaselineAgeDays(target) >= 30) throw new Error("Stale baseline");
if (!(await fileExists(`experiments/${id}/baselines/Model-X.md`))) {
  throw new Error("Missing reproduced baseline note");
}
```
**Bad**
```md
We beat Model-X by 4.2 points, consistent with the public paper.
```

### 3. Falsifier review
**Good**
```ts
const verdicts = await runFalsificationAdversary({
  claim: active.claim,
  cwd,
  hypothesisId: active.id,
});
for (const verdict of verdicts) {
  if (verdict.verdict !== "defensible" && verdict.verdict !== "caveat-required") {
    throw new Error(`Publication blocked by ${verdict.model}`);
  }
}
```
**Bad**
```ts
const verdicts = await runFalsificationAdversary({ claim, cwd, hypothesisId: id });
console.log(`Ran ${verdicts.length} adversaries`);
```

### 4. Smoke versus final result
**Good**
```text
smokes/run-07.md says 81.4
RESULTS.md still says 78.9
Action: keep 81.4 out of headline files and route through /skill:surprise-triage
```
**Bad**
```text
smokes/run-07.md says 81.4
RESULTS.md updated to 81.4 because it looks better
```

## Why This Matters
Publication failure rarely starts with a giant bug.
It starts with one skipped check, then another, then a sentence that sounded safe because the number looked clean.

A stale baseline turns a comparison into fiction.
A judge mismatch turns the result into a different experiment.
An ignored falsifier turns review into theater.
A smoke number in `RESULTS.md` turns exploration into a claim.
A stale ledger turns accountability into storytelling.

This final gate exists to stop last-mile dishonesty.
Not dramatic dishonesty.
Ordinary rushed dishonesty.
The kind that says `we basically verified it`.
Do not do that.

A claim is ready when it survives the suite.
Not when it feels ready.

> **This is the final skill. After verification, the hypothesis is ready for publication.**
