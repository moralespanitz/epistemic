---
name: falsification-review
description: Use when a numerical claim, comparison claim, or headline result is about to leave `smokes/` or be written into `RESULTS.md`.
---

> **Related skills:** `/skill:baseline-reproduction` for reproduced comparison targets, `/skill:experiment-execution` for preregistered runs, `/skill:surprise-triage` when a reviewed claim still behaves strangely, `/skill:verification-before-publication` before anything leaves the repo.

# Falsification Review

## Overview

This is the phase where the claim stops being yours and starts being evidence. Your job is not to help the claim survive; your job is to find the cheapest honest way to kill it before anyone else does.

A claim that only survives friendly reading is not a result. A claim that survives reproduced baselines, independent adversaries, and explicit disconfirming checks might be a result.

In this phase, you must:
- extract the exact claim from `RESULTS.md` or from the researcher's explicit statement
- verify the experiment is anchored in `experiments/{id}/prereg.md`
- verify any cited baseline was actually reproduced at `experiments/repro_{name}/prereg.md`
- run `runFalsificationAdversary()` from `src/adversary/dispatch.ts` against the exact claim
- require at least two adversary models different from the drafter model
- write one paper trail file per adversary to `experiments/{id}/falsifiers/{model}.md`
- decide `ALLOW`, `BLOCK`, or `ALLOW WITH CAVEAT`
- keep provisional numbers in `experiments/{id}/smokes/` until falsification passes
- promote from `smokes/` to `RESULTS.md` only after this phase clears the claim

The gates in this repo help, but they do not replace judgment. If a gate missed something, that does not grant permission.

## The Iron Law

```text
Your claim is guilty until proven defensible by ≥2 models
```

One model is not enough. Self-critique is not independence. Missing audit is not support.

## When to Use

Use this skill when:
- you are about to move a number out of `experiments/{id}/smokes/`
- you are drafting or editing `experiments/{id}/RESULTS.md`
- you are drafting or editing a repo-level `RESULTS.md`
- you are writing `beats`, `outperforms`, `matches`, `wins`, `better than`, or any comparison claim
- you want to treat a baseline as reproduced evidence instead of as a cited number
- the researcher asks, `Can we say this?`
- an experiment finished and now needs adversarial review before promotion
- a gate or reviewer says the claim is unsupported, caveated, or unreproduced

## When NOT to Use

Do not use this skill when:
- you are still defining the claim; use `/skill:research-question`
- you are still locking the protocol; use `/skill:preregistration`
- you are still reproducing the comparison target; use `/skill:baseline-reproduction`
- you are still running the preregistered experiment; use `/skill:experiment-execution`
- the note will remain exploratory inside `experiments/{id}/smokes/`
- the claim is already blocked because preregistration, judge lock, or execution integrity failed
- you are doing final publication packaging; use `/skill:verification-before-publication`

## Working Surface

These files and functions are the working surface for this phase. Read them. Use them. Do not guess.

| Surface | Why it matters |
|---------|----------------|
| `HYPOTHESES.md` | Registered claim, falsifier, baseline reference, judge reference |
| `experiments/{id}/prereg.md` | Proof that the experiment existed before results |
| `experiments/{id}/judge.lock` | Proof that the judge did not drift |
| `experiments/repro_{name}/prereg.md` | Mandatory proof that the baseline was actually reproduced |
| `experiments/{id}/smokes/` | Provisional outputs only |
| `experiments/{id}/RESULTS.md` | Confirmed experiment-level conclusions |
| `RESULTS.md` | Optional repo-level mirror of confirmed conclusions |
| `experiments/{id}/falsifiers/{model}.md` | Per-model falsification record |
| `.epistemic/cost-ledger.jsonl` | Cost accounting for audit reruns |
| `OVERRIDES.md` | Explicit exceptions with reasons |
| `src/state/repo.ts` | Canonical state helpers and types |
| `src/adversary/dispatch.ts` | Adversary dispatch and verdict parsing |

State helpers you will actually use here:
- `loadRepoState(cwd)` for a quick snapshot
- `loadHypotheses(cwd)` and `getActiveHypothesis(entries)` to recover the active hypothesis
- `loadBaselines(cwd)` and `getBaselineAgeDays(entry)` to inspect baseline references and freshness
- `fileExists(path)` to prove required artifacts exist
- `getJudgeLock(cwd, id)` and `computeJudgeHash(judgeRef, id)` to verify judge continuity
- `getHypothesisSpend(cwd, id)` or `getAllHypothesisSpends(cwd)` to inspect accumulated audit cost
- `appendCostRecord(cwd, record)` if manual reruns created unlogged cost
- `updateHypothesisStatus(cwd, id, status)` when the claim is actually dead

Other helpers exist in `src/state/repo.ts`. Do not use `saveHypotheses(...)`, `hypothesisToMarkdown(...)`, or `writeJudgeLock(...)` here to paper over missing earlier work. This phase audits reality. It does not rewrite history.

`src/adversary/dispatch.ts` exposes `runFalsificationAdversary({ claim, context, cwd })`. Keep the hypothesis id in surrounding workflow even though the function itself does not currently take it; you still need it for file paths and status decisions.

## The Process

1. ### Pin the exact claim

   Start with the sentence that is asking for authority. Never falsify a vibe. Never falsify a softer paraphrase than the one about to ship.

   Steps:
   1. Load `HYPOTHESES.md` with `loadHypotheses(cwd)`.
   2. If the experiment id is not explicit, use `getActiveHypothesis(...)`.
   3. Resolve the claim source in this order:
      - the exact sentence already drafted in root `RESULTS.md`
      - the exact sentence drafted in `experiments/{id}/RESULTS.md`
      - the researcher's explicit statement in the current request
   4. If multiple versions exist, review the version that would actually ship.
   5. Quote the claim verbatim in your notes.
   6. Record the hypothesis id, metric, comparator, dataset, and destination file.

   If the sentence does not say what improved, against what, on which task, and under which conditions, stop and rewrite it into a falsifiable claim before review.

2. ### Verify the experiment is real before reviewing the claim

   Falsification review is not a substitute for missing protocol. If the experiment itself is unanchored, every later decision is fake confidence.

   Steps:
   1. Check `experiments/{id}/prereg.md` with `fileExists(...)`.
   2. If it is missing, **BLOCK** immediately.
   3. Use `loadRepoState(cwd)` if you need a fast snapshot of `HYPOTHESES.md`, `BASELINES.md`, and root `RESULTS.md`.
   4. Compare the drafted claim against the registered `HypothesisEntry` fields from `src/state/repo.ts`.
   5. If the reviewed sentence silently changed metric, comparator, or scope from the registered claim, stop and send it back for correction.

   A sentence can be numerically true on one metric and still invalid because it is no longer the preregistered claim.

3. ### Verify judge continuity instead of assuming it

   Comparison claims are meaningless if the judge drifted halfway through the experiment. This repo has a judge-lock mechanism. Use it.

   Steps:
   1. Read the expected judge from `HypothesisEntry.judgeRef`.
   2. Use `getJudgeLock(cwd, id)` to check whether `experiments/{id}/judge.lock` exists.
   3. If a lock exists, recompute the expected hash with `computeJudgeHash(judgeRef, id)`.
   4. If the stored lock and computed hash do not match, **BLOCK**.
   5. If the lock is missing, stop and return the work to the judge-lock phase.
   6. Do not silently call `writeJudgeLock(...)` here.

   Late repair is not integrity. It is paperwork after the fact.

4. ### Prove the baseline was reproduced under your protocol

   This is where comparison claims usually die. A cited baseline is not a reproduced baseline. `BASELINES.md` is context, not proof.

   Steps:
   1. Read `HypothesisEntry.baselineRef` to identify the intended comparison target.
   2. Use `loadBaselines(cwd)` to locate the named baseline entry if one exists.
   3. Normalize the baseline name into a stable `{name}` token.
   4. Check the proof path: `experiments/repro_{name}/prereg.md`.
   5. If `fileExists("experiments/repro_{name}/prereg.md")` is false, **BLOCK**.
   6. Use this exact blocking language: `Baseline not reproduced under your protocol. Missing experiments/repro_{name}/prereg.md.`
   7. If the file exists but is empty, vague, or clearly about another setup, treat it as missing.
   8. If a baseline entry exists in `BASELINES.md`, use `getBaselineAgeDays(...)` to check freshness.
   9. If a reproduced baseline dossier contains a result file, read it before allowing any comparison sentence to survive.

   The distinction is non-negotiable:
   - `BASELINES.md` proves the number was recorded
   - `experiments/repro_{name}/prereg.md` proves the baseline was reproduced under your protocol

   If you cannot prove the second, you do not get to say `beats`.

5. ### Build the adversary packet correctly

   `runFalsificationAdversary()` is only as good as the packet you send it. Friendly framing produces friendly nonsense.

   Steps:
   1. Use the real function signature from `src/adversary/dispatch.ts`: `runFalsificationAdversary({ claim, context, cwd })`.
   2. Keep the hypothesis id in surrounding workflow for paths and status updates.
   3. Build `context` from repo facts, not hype.
   4. Include:
      - the exact claim text
      - the hypothesis id
      - `experiments/{id}/prereg.md`
      - the relevant evidence in `experiments/{id}/smokes/`
      - `experiments/repro_{name}/prereg.md` when the claim is comparative
      - the locked judge description from `HypothesisEntry.judgeRef`
      - any caveat already known before adversarial review
   5. Determine the drafter model from `HypothesisEntry.judgeRef` or from the active drafting context if it is more specific.
   6. Require at least two adversary models that are different from the drafter model.

   Each model must return the core payload: `{experiment, costEstimate, verdict, reasoning}`.
   The canonical repo-side form is `AdversaryVerdict` in `src/state/repo.ts`: `{ provider, model, name, experiment, costEstimate, verdict, reasoning }`.

6. ### Dispatch and distrust the first neat answer

   The goal of the run is the strongest disconfirming experiment, not reassurance.

   Steps:
   1. Call `runFalsificationAdversary({ claim, context, cwd })`.
   2. Confirm you received at least two model outputs.
   3. Confirm those outputs came from models different from the drafter model.
   4. Confirm each output has non-empty `experiment`, `costEstimate`, `verdict`, and `reasoning`.
   5. Exclude `cannot-audit` from the set of passing audits.
   6. If fewer than two independent audited verdicts remain after exclusions, **BLOCK**.

   Read `src/adversary/dispatch.ts` carefully before trusting the response shape blindly. The happy path returns canonical fields, but some fallback paths still emit legacy keys like `modelId`, `providerId`, and `disconfirmingExperiment`. If the response is malformed, normalize it before writing files and do not count the malformed response as a clean pass.

7. ### Write the paper trail before deciding anything

   Never make the verdict from scrollback memory. Write the evidence first.

   Steps:
   1. Create or update `experiments/{id}/falsifiers/`.
   2. For each adversary verdict, write one file to `experiments/{id}/falsifiers/{model}.md`.
   3. Normalize model names into stable filenames.
   4. In each file include:
      - claim text
      - claim source path or researcher statement source
      - hypothesis id
      - drafter model
      - adversary provider
      - adversary model
      - baseline reproduction path checked
      - verdict
      - proposed disconfirming experiment
      - cost estimate
      - whether that experiment has already been run
      - evidence path proving run or non-run
      - reasoning
   5. Determine `already been run` from repo artifacts, not from confidence.
   6. Compare the proposed disconfirming experiment against `experiments/{id}/smokes/`, `experiments/{id}/RESULTS.md`, and existing falsifier files.
   7. If manual reruns created unlogged cost, call `appendCostRecord(cwd, record)`.
   8. If audit reruns are piling up, inspect `getHypothesisSpend(cwd, id)` or `getAllHypothesisSpends(cwd)`.

   Planned is not run. Mentioned is not run. Half-run is not run.

8. ### Apply the verdict matrix exactly

   Once the evidence exists on disk, decide the outcome from the matrix below and nothing softer.

   | Condition | Outcome | Required action |
   |-----------|---------|-----------------|
   | All independent audited verdicts are `defensible` | `ALLOW` | Promotion may proceed if no cheap unrun killer remains |
   | Any independent audited verdict is `falsified-or-unreproducible` | `BLOCK` | Stop promotion and record the blocking reasoning |
   | Mixed audited verdicts with at least one `caveat-required` and none `falsified-or-unreproducible` | `ALLOW WITH CAVEAT` | Tag the claim and ship the caveat with it |
   | Fewer than two independent audited verdicts remain after excluding `cannot-audit` | `BLOCK` | Fix the adversary roster or configuration first |
   | Required baseline reproduction is missing | `BLOCK` | Reproduce the baseline first |
   | Cheapest disconfirming experiment is `<$1` and unrun | `BLOCK` | Run the cheap killer before promoting |

   Short form:
   - all defensible -> `ALLOW`
   - any falsified -> `BLOCK`
   - mixed -> `ALLOW WITH CAVEAT`
   - missing reproduced baseline -> `BLOCK`
   - `<2` independent audited models -> `BLOCK`
   - cheapest unrun disconfirming experiment `<$1` -> `BLOCK`

   `ALLOW WITH CAVEAT` is not decorative. Tag the claim. Attach the limitation where the claim appears. Do not bury it in another file.

   If the claim is actually dead, use `updateHypothesisStatus(cwd, id, "FALSIFIED")`.

9. ### Enforce the cheap-killer rule honestly

   This is the part people try to skip because the number looks small. Do not help them do that.

   Steps:
   1. Gather every proposed `experiment` and `costEstimate` from the adversary set.
   2. Find the cheapest disconfirming experiment.
   3. Determine whether that exact experiment has already been run and documented.
   4. Count it as run only if the method matches and the evidence belongs to the current hypothesis.
   5. If the cheapest disconfirming experiment costs less than `$1` and is unrun, **BLOCK**.
   6. Use this exact blocking language: `Claim blocked pending cheapest disconfirming experiment (<$1) requested by falsification review.`

   If the strongest cheap killer is still sitting there unrun, the claim has not earned authority.

10. ### Promote or refuse promotion cleanly

   Promotion is the point where a provisional observation becomes repo memory.

   Steps:
   1. If the outcome is `BLOCK`, keep the evidence in `experiments/{id}/smokes/` and keep the claim out of every `RESULTS.md`.
   2. If the outcome is `ALLOW`, promote the reviewed result from `experiments/{id}/smokes/` to `experiments/{id}/RESULTS.md`.
   3. If the repo mirrors confirmed claims at the top level, update root `RESULTS.md` only after the experiment-level file is correct.
   4. If the outcome is `ALLOW WITH CAVEAT`, promote only the reviewed sentence and attach the caveat directly beside it.
   5. If the claim text changes after review, run falsification again.
   6. If the claim is blocked hard enough to end the hypothesis, route the work toward `/skill:kill-or-ship`.

   Promotion rule: only after falsification passes may anything move from `smokes/` to `RESULTS.md`.
   Laundering rule: `promote now, rerun the falsifier later` is not a workflow.

11. ### Close the loop before leaving the phase

   A falsification review is not complete until the record is internally consistent.

   Steps:
   1. Confirm the falsifier files exist under `experiments/{id}/falsifiers/`.
   2. Confirm the reviewed claim text on disk matches the text you actually reviewed.
   3. Confirm any caveat is attached wherever the claim appears.
   4. Confirm blocked claims stayed out of headline files.
   5. Confirm cost accounting is not silently missing.
   6. Confirm the hypothesis status still matches reality.
   7. If the claim survived but exposed weird instability, route the next step to `/skill:surprise-triage`.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| `BASELINES.md` already has the competitor number. | A cited number is not reproduced evidence. Proof is `experiments/repro_{name}/prereg.md`. |
| One strong model audit is enough. | The Iron Law requires `≥2` independent model reviews. |
| The drafter model challenging itself should count. | Self-critique is not independence. Same model does not count. |
| The draft sentence is basically the same as the reviewed one. | If the sentence changed, the claim changed. Re-review the shipped sentence. |
| The baseline paper is recent, so reproduction can wait. | Fresh citation is still not reproduction under your judge. |
| `cannot-audit` is close enough to neutral. | Missing audit does not become supportive evidence. |
| The cheap killer is probably noise. | Then run it. If it costs `<$1`, guessing is more expensive than checking. |
| Mixed verdicts mostly mean yes. | Mixed means `ALLOW WITH CAVEAT`, not clean `ALLOW`. |
| We already spent enough on this hypothesis. | Then escalate to kill-or-ship. Do not lower the falsification bar. |
| `smokes/` looks stable, so promotion is safe. | Stable-looking provisional data is still provisional data. |
| We can promote now and clean up the caveat later. | If the caveat does not ship with the claim, the claim is misrepresented. |
| The function returned something shaped like a verdict, so it counts. | Malformed or legacy fallback output must be normalized and may still fail the audit minimum. |

## Red Flags - STOP

Stop immediately if any of these are true:
- you cannot point to the exact sentence under review
- `experiments/{id}/prereg.md` is missing
- `experiments/{id}/judge.lock` is missing or drifted
- the claim is comparative and `experiments/repro_{name}/prereg.md` is missing
- you are treating `BASELINES.md` as reproduction proof
- fewer than two independent audited models remain after excluding the drafter model and `cannot-audit`
- one audited verdict is `falsified-or-unreproducible`
- the cheapest disconfirming experiment is `<$1` and you cannot prove it was run
- you are about to move anything from `smokes/` into `RESULTS.md` before resolving the matrix
- you are trying to paraphrase the claim after seeing adversary output
- you are calling `ALLOW WITH CAVEAT` a clean pass
- you are about to silently repair missing historical artifacts instead of routing the work back to the failed phase

Any one of these means stop. Do not promote. Fix the broken premise first.

## Good vs Bad

### Claim extraction

**Good**
You load `HYPOTHESES.md` with `loadHypotheses(cwd)`, recover `hyp-017`, and review the exact sentence in `experiments/hyp-017/RESULTS.md`: `Model A beats Model B by 4.2 points on Dataset D under judge J.` The adversary sees that exact sentence.

**Bad**
You summarize it as `the model seems better on Dataset D` before sending it for review. Now the falsifier is auditing a softer claim than the one that would ship.

### Baseline proof

**Good**
You inspect `HypothesisEntry.baselineRef`, normalize the comparison target, and verify `experiments/repro_llama-3/prereg.md` exists and matches the task and judge.

**Bad**
You find `## Baseline: llama-3` in `BASELINES.md` and decide that is enough. It is not. That proves the number was recorded, not reproduced.

### Adversary independence

**Good**
You require two adversary models different from the drafter model and exclude any same-model self-audit from the pass count.

**Bad**
You count the drafter model's self-critique as one of the two required adversaries. That is the same bias wearing a hat.

### Cheap killer experiment

**Good**
Two adversaries propose disconfirming experiments costing `$0.42` and `$2.10`. The `$0.42` check has not been run, so you block with `Claim blocked pending cheapest disconfirming experiment (<$1) requested by falsification review.`

**Bad**
You say the `$0.42` check is too minor to delay promotion. The cheaper the killer, the less excuse you have not to run it.

### Mixed verdicts

**Good**
One adversary returns `defensible`; another returns `caveat-required`. No audited verdict says `falsified-or-unreproducible`, and no cheap unrun killer remains. You tag the claim `ALLOW WITH CAVEAT` and ship the caveat with the sentence.

**Bad**
You average the two judgments into a clean `ALLOW`. That is how caveats disappear and overclaiming starts.

### Promotion discipline

**Good**
You keep provisional results inside `experiments/{id}/smokes/` until the matrix resolves. Only then do you promote to `experiments/{id}/RESULTS.md`, and only then do you mirror anything into root `RESULTS.md`.

**Bad**
You copy a promising sentence into `RESULTS.md` first and promise to run falsification afterward. That is not sequencing. That is laundering provisional numbers.

## Why This Matters

Most bad claims do not survive because the experiment runner is malicious. They survive because nobody forced the claim through hostile review before it became institutional memory.

This phase matters because it:
- prevents cited baselines from masquerading as reproduced baselines
- forces the cheapest honest killer to run before the claim earns authority
- keeps `smokes/` provisional and `RESULTS.md` meaningful
- turns caveated claims into explicitly caveated claims instead of quietly overstated ones
- leaves a durable audit trail in `experiments/{id}/falsifiers/`
- gives you a clean cut between `ALLOW`, `BLOCK`, and `ALLOW WITH CAVEAT`

Once a sentence lands in `RESULTS.md`, people will reuse it. They will quote it in docs, planning, reviews, and future experiments. If the sentence is wrong, the error compounds.

That is why this phase is strict. If the claim cannot survive reproduced baselines, independent adversaries, and cheap disconfirming checks inside the repo, it has no business representing the repo outside it.

After this, use `/skill:surprise-triage`.
