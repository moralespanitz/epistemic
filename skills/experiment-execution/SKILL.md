---
name: experiment-execution
description: Use when a preregistered hypothesis is ready to be run and provisional results must be collected, cost-tracked, and stored without contaminating headline outputs.
---

> **Related skills:** `/skill:preregistration`, `/skill:baseline-reproduction`, `/skill:falsification-review`, `/skill:kill-or-ship`

# Experiment Execution

## Overview
Execution is where discipline stops being a slogan.
This is the phase where you write the code, launch the runs, pay the bill, and create the evidence trail that later review depends on.
If you improvise here, nothing downstream can save you.

Most bad research does not fail because the model could not run.
It fails because somebody changed the judge after seeing weak numbers, peeked at early outputs and reworked the method, quietly dropped ugly runs, or let provisional numbers leak into claim files.
This skill exists to stop that.

Your job is simple and brutal: run the preregistered protocol exactly as committed, track every paid call, store provisional artifacts in the right place, and stop at the publication boundary.
Execution is measurement, not interpretation.

## Quick Reference
| Need | File or API | Rule |
| --- | --- | --- |
| Load repo state | `loadRepoState(cwd)` | High-level sanity check only |
| Load hypothesis entries | `loadHypotheses(cwd)` | Start here for any real execution decision |
| Parse hypothesis markdown | `parseHypotheses(content)` | Use only when reconstructing from file text |
| Select active hypothesis | `getActiveHypothesis(entries)` | Do not guess the active experiment |
| Repair hypothesis markdown | `hypothesisToMarkdown(h)` + `saveHypotheses(cwd, entries)` | Preserve the repo format |
| Mark active execution | `updateHypothesisStatus(cwd, id, "RUNNING")` | Bookkeeping, not confirmation |
| Check prereg presence | `fileExists("experiments/{id}/prereg.md")` | No prereg, no run |
| Read judge lock | `getJudgeLock(cwd, id)` | Missing or drifted lock blocks judge-backed execution |
| Compute expected lock | `computeJudgeHash(judgeRef, id)` | Compare before any scored run |
| Create first lock | `writeJudgeLock(cwd, id, judgeRef)` | Only when the judge is intentionally fixed |
| Read baseline metadata | `loadBaselines(cwd)` | Do not refresh baselines mid-run to chase a better comparison |
| Check baseline freshness | `getBaselineAgeDays(entry)` | Freshness is a gate, not an excuse to move the goalposts |
| Read current spend | `getHypothesisSpend(cwd, id)` | Watch the cost cap during execution |
| Read all spends | `getAllHypothesisSpends(cwd)` | Useful when several hypotheses are active |
| Append manual cost rows | `appendCostRecord(cwd, record)` | Every billable action gets a row |
| Ledger path | `.epistemic/cost-ledger.jsonl` | Append-only source of truth |
| Provisional outputs | `experiments/{id}/smokes/` | These CANNOT be quoted |
| Confirmed headline files | `experiments/{id}/RESULTS.md` and any root `RESULTS.md` | Do not write here yet |
| Later adversary step | `runFalsificationAdversary({ claim, context, cwd })` | Not part of execution |

## The Iron Law
```text
EVERY RUN IS TRACKED; NO SECRET EXPERIMENTS
```
If a run consumed money, changed your beliefs, or produced a number you now remember, it was real.
Real runs leave three traces: a preregistration, a cost record, and a provisional artifact.
If any of those are missing, you do not have evidence. You have a story.

## When to Use
Use this skill when:
- `experiments/{id}/prereg.md` already exists and the method is supposed to be locked.
- A hypothesis in `HYPOTHESES.md` is `OPEN` or `RUNNING`.
- You are about to write experiment code, launch the benchmark, or call model APIs.
- The run will incur cost that must land in `.epistemic/cost-ledger.jsonl`.
- The experiment uses a judge and `judge.lock` must be enforced.
- You need to store raw outputs and interim summaries without contaminating headline files.
- You need to complete the preregistered sample size `n` and compute the promised summary statistics.

## When NOT to Use
Do not use this skill when:
- The claim is still being framed. Use `/skill:research-question`.
- The method is still being locked. Use `/skill:preregistration`.
- You are reproducing a baseline under your own judge. Use `/skill:baseline-reproduction`.
- You are reviewing whether the finished result survives critique. Use `/skill:falsification-review`.
- You are deciding whether to kill the project or publish it. Use `/skill:kill-or-ship`.
- You want “just one quick run” before preregistration. That is exactly what this skill forbids.

## The Process

### 1. Identify the exact hypothesis before touching code
1. Load the current entries with `loadHypotheses(cwd)`.
2. Select the live entry with `getActiveHypothesis(entries)`.
3. Read the execution-critical fields from that entry: `id`, `claim`, `falsifier`, `n`, `judgeRef`, `baselineRef`, `costCap`, and `status`.
4. If you only have raw markdown, reconstruct entries with `parseHypotheses(content)` rather than improvising your own parser.
5. If the table needs repair, serialize through `hypothesisToMarkdown(h)` and persist with `saveHypotheses(cwd, entries)` so the repo stays canonical.
6. Derive the working paths immediately:
   - `experiments/{id}/prereg.md`
   - `experiments/{id}/judge.lock`
   - `experiments/{id}/smokes/`
   - `experiments/{id}/RESULTS.md`
   - `.epistemic/cost-ledger.jsonl`
7. If the hypothesis is legitimately starting now, move it from `OPEN` to `RUNNING` with `updateHypothesisStatus(cwd, id, "RUNNING")`.
8. Do not mark anything `CONFIRMED` here. Execution measures. Review interprets.

### 2. Refuse to run without `prereg.md`
1. Compute `experiments/{id}/prereg.md` and confirm it exists with `fileExists(path)`.
2. If that check fails, stop immediately. Do not run `bun`, `python`, `pytest`, `eval`, `benchmark`, `run_*`, or `train` commands and promise yourself you will document the method later.
3. Read the preregistration and extract the operational contract:
   - planned sample size `n`
   - exact task or dataset slice
   - metric definition
   - judge configuration if scoring is involved
   - stopping rule
   - retry or exclusion policy
4. Compare that contract against the active `HypothesisEntry`. If the entry says `n = 30` and the prereg text implies `n = 10`, repair the inconsistency before running.
5. Treat preregistration as executable governance. It is not a diary entry.
6. If the output could change what you do next, it is a real run.

### 3. Enforce the judge lock before any scored evaluation
1. Read `judgeRef` from the active hypothesis.
2. Load the stored lock with `getJudgeLock(cwd, id)`.
3. Compute the expected value with `computeJudgeHash(judgeRef, id)`.
4. Compare the two before the first scored call, not after the number is already on your screen.
5. If the lock is missing and this is the first legitimate locked run, create it deliberately with `writeJudgeLock(cwd, id, judgeRef)`.
6. If the lock exists and does not match, stop. Do not rationalize that the prompt change was “cosmetic” or the model version shift was “basically the same.”
7. A judge drift is method drift. Record an override in `OVERRIDES.md` if the repo allows it, or restart under a clean protocol. Never proceed silently.
8. If the experiment does not rely on a judge, say that explicitly in preregistration. Ambiguity here is how judge-shopping sneaks in.

### 4. Arm the cost ledger before the first paid call
1. The canonical ledger lives at `.epistemic/cost-ledger.jsonl`.
2. Read the current spend with `getHypothesisSpend(cwd, id)` before launching more work.
3. If you need the bigger picture, inspect `getAllHypothesisSpends(cwd)` to see whether multiple live hypotheses are already straining the budget.
4. Assume the cost-ledger gate handles normal tool accounting, but do not trust automation blindly. If you run anything outside that path, append a row yourself with `appendCostRecord(cwd, record)`.
5. Record failures too. A failed API call still burned money and still belongs in the ledger.
6. Do not aggregate from memory at the end of the day. Memory is not an accounting system.
7. Watch the cost cap during the run, not after it has already been exceeded.
8. If continued execution would overrun the committed budget, stop and hand off to the override or kill flow. Do not spend first and explain later.

### 5. Implement the preregistered method, not a moving target
1. Write or complete only the code required to realize the locked protocol.
2. Keep the important invariants fixed across runs:
   - same dataset slice
   - same prompt and extraction rule
   - same judge
   - same model settings
   - same stopping rule
   - same metric definition
3. Run the full sample size `n` from the active hypothesis and preregistration. `n` is the denominator your claim will live or die on.
4. Do not peek at early outputs and then revise the method mid-run.
5. That means no prompt edits, no seed swaps, no ad hoc retries, no threshold tweaks, no post-hoc filtering, and no selective “cleanup” after seeing weak runs.
6. If infrastructure actually fails, follow the retry rule that was already written in preregistration.
7. If preregistration did not define the failure policy, stop and repair the protocol before continuing.
8. A pretty outcome does not validate bad execution discipline. A bad outcome does not justify changing the rules.

### 6. Finish the committed sample size
1. Do not summarize after 3 of 30 runs because the trend looks obvious.
2. Do not stop early because the result is already good enough for a slide.
3. Do not stop early because the result is ugly and you would rather redesign the method.
4. Complete the full `n` unless the preregistered stopping rule explicitly says otherwise.
5. If a run is missing, document exactly why it is missing and whether preregistration allowed exclusion.
6. If a run failed in a way that counts as a valid null result, keep it in the accounting.
7. Missingness is evidence. Silent disappearance is fraud in nicer clothes.
8. Only after the sample is complete may you compute the summary that the preregistration promised.

### 7. Store provisional artifacts in `smokes/` and nowhere else
1. Use `experiments/{id}/smokes/` as the provisional artifact directory.
2. Put raw per-run outputs there with deterministic names such as:
   - `run-001.json`
   - `run-002.json`
   - `aggregate.md`
   - `notes.md`
3. Keep experiment-local evidence under the experiment directory even if the repo scaffold also contains a top-level `smokes/`.
4. Treat everything in `experiments/{id}/smokes/` as provisional and non-quotable.
5. “Non-quotable” means the number does not belong in:
   - `experiments/{id}/RESULTS.md`
   - a root `RESULTS.md`
   - a README
   - a PR description
   - a commit message
   - a polished claim sentence
6. Working notes belong in `smokes/` too if they mention provisional numbers.
7. Do not write to `experiments/{id}/falsifiers/{model}.md` here. That directory is for the later adversarial review step.
8. Do not smuggle a smoke result into a nice sentence and tell yourself it is only temporary. Temporary leakage is still leakage.

### 8. Compute the prescribed summary statistics only after collection ends
1. Once the full sample is complete, compute the summary statistics named in preregistration.
2. Typical valid summaries include mean, median, standard deviation, confidence interval, pass rate, win rate, or error rate, but only if those were the planned summaries.
3. Do not invent a new flattering derived metric because the original one underperformed.
4. Keep raw observations and summary outputs side by side inside `experiments/{id}/smokes/`.
5. Raw data without a summary is hard to review. Summary without raw data is easy to manipulate.
6. If the completed summary is surprising, note the surprise. Do not retroactively rewrite the method.
7. Surprises are handled later by triage or falsification review, not by live improvisation during execution.
8. If you need an experiment-wide markdown rollup, keep it provisional inside `experiments/{id}/smokes/aggregate.md` or a similar file under `smokes/`.

### 9. Stop at the publication boundary
1. When execution is complete, stop.
2. Do not write to `experiments/{id}/RESULTS.md` yet.
3. If this repo also maintains a root `RESULTS.md`, do not write there either.
4. Do not upgrade the hypothesis to `CONFIRMED` just because the mean looks good.
5. Do not write a headline sentence like “we beat baseline X by Y%” before adversarial review.
6. The output of execution is a clean handoff package, not a claim:
   - `experiments/{id}/prereg.md`
   - `experiments/{id}/judge.lock`
   - `experiments/{id}/smokes/` artifacts
   - the relevant rows in `.epistemic/cost-ledger.jsonl`
   - the active hypothesis entry in `HYPOTHESES.md`
7. If execution has already exhausted the cost cap, say so plainly.
8. The next question is not “can this be published?” The next question is “does this survive criticism?” That is a different skill.

## Reading the Cost Ledger
`.epistemic/cost-ledger.jsonl` is JSON Lines: one JSON object per line, append-only.
Do not treat it like a single array and do not rewrite history to make the spend look cleaner.

The `CostRecord` shape defined in `src/state/repo.ts` is:
```ts
interface CostRecord {
  timestamp: string;
  hypothesisId: string;
  toolName: string;
  estimatedCost: number;
  isError: boolean;
}
```

Example rows:
```json
{"timestamp":"2026-05-31T18:04:11.233Z","hypothesisId":"h-rag-precision","toolName":"openai:gpt-4o","estimatedCost":0.18,"isError":false}
{"timestamp":"2026-05-31T18:04:14.002Z","hypothesisId":"h-rag-precision","toolName":"openai:gpt-4o","estimatedCost":0.18,"isError":true}
{"timestamp":"2026-05-31T18:07:52.918Z","hypothesisId":"h-rag-precision","toolName":"google:gemini-2.5-pro","estimatedCost":0.41,"isError":false}
```

Read it with concrete questions:
1. How much has this hypothesis spent so far? Use `getHypothesisSpend(cwd, hypothesisId)`.
2. Which hypotheses are burning most of the budget? Use `getAllHypothesisSpends(cwd)`.
3. Are failures costing real money? Look for rows where `isError` is `true`.
4. Did every billable call leave a record? Gaps usually mean somebody assumed logging instead of verifying it.
5. Are costs clustering around retries or repeated failures? That is often the first sign of a dying experiment.

What not to do:
- Do not delete expensive rows because they are embarrassing.
- Do not log only successes.
- Do not replace atomic entries with a rounded final total.
- Do not keep a second private spreadsheet and call the official ledger “good enough later.”
- Do not treat small calls as free just because they are cheap.

The ledger is methodology, not bookkeeping theater.
Untracked cost usually means untracked execution.

## Common Rationalizations
| Excuse | Reality |
| --- | --- |
| “I just want one quick dry run before prereg is finalized.” | If you learn from it, it was a real run. Register it or do not run it. |
| “The judge hash changed, but only because I cleaned up the prompt.” | Prompt cleanup after lock is method drift. Stop. |
| “The first five runs already prove the point.” | Your preregistered `n` exists to stop exactly that impulse. |
| “I can switch seeds midway to reduce noise.” | Mid-run seed changes are methodology changes after peeking. |
| “I will backfill the cost ledger tonight.” | Memory is selective, flattering, and wrong. Log now. |
| “Failed API calls do not count because they returned nothing useful.” | They still consumed budget and changed feasibility. |
| “I only wrote the result into `RESULTS.md` as a placeholder.” | Headline files are claims, not scratchpads. |
| “I dropped two ugly runs because the harness glitched.” | Only preregistered exclusion rules may remove runs. |
| “I found a better metric after seeing the data.” | Then it is a new analysis, not this preregistered experiment. |
| “I want to run the adversary now so I know whether finishing is worth it.” | Execution and falsification are separate phases for a reason. |

## Red Flags - STOP
Stop immediately if any of these are true:
- You are about to launch the run before checking `experiments/{id}/prereg.md`.
- You cannot say which hypothesis `id` is active.
- `judge.lock` exists but you have not compared it against `computeJudgeHash(judgeRef, id)`.
- `judge.lock` does not match and you are tempted to “just proceed once.”
- You have already seen numbers that are not logged and not stored under `smokes/`.
- You want to add “just one more seed” because the mean is close.
- You want to drop a run because it looks embarrassing.
- You are editing prompts, dataset slices, thresholds, or parsers after seeing outputs.
- You are about to mention a provisional number in `RESULTS.md`, a PR, or a commit message.
- `.epistemic/cost-ledger.jsonl` is missing rows for paid calls you know happened.
- You want to declare success before falsification review has run.

All of those mean the same thing: stop, return to the contract, and repair the method before generating more evidence.

## Good vs Bad
### Good: start from the real hypothesis
```ts
const entries = await loadHypotheses(cwd);
const h = getActiveHypothesis(entries);
if (!h) throw new Error("No OPEN or RUNNING hypothesis.");
```
Good because execution begins from repo state, not memory.

### Bad: infer the target from vibes
```ts
const id = process.env.LAST_EXPERIMENT || "tmp-run";
```
Bad because the repo already has canonical state and you ignored it.

### Good: refuse to run without preregistration
```ts
const preregPath = join(cwd, "experiments", h.id, "prereg.md");
if (!(await fileExists(preregPath))) {
  throw new Error("Missing preregistration.");
}
```
Good because the run cannot quietly outrun the protocol.

### Bad: run first, explain later
```ts
await bash("python benchmark.py --samples 5");
// will document the exact setup after I see whether this is promising
```
Bad because you already contaminated the experiment the moment you saw the output.

### Good: enforce the judge lock before scored calls
```ts
const locked = await getJudgeLock(cwd, h.id);
const expected = computeJudgeHash(h.judgeRef, h.id);
if (locked && locked !== expected) {
  throw new Error("Judge drift detected.");
}
```
Good because the method is checked before the result exists.

### Bad: treat judge drift as a cosmetic change
```ts
// same prompt, just clearer wording
judge.prompt = revisedPrompt;
```
Bad because clearer wording is still a changed judge.

### Good: log costs as they happen
```ts
await appendCostRecord(cwd, {
  timestamp: new Date().toISOString(),
  hypothesisId: h.id,
  toolName: "openai:gpt-4o",
  estimatedCost: 0.18,
  isError: false,
});
```
Good because the official ledger stays complete and append-only.

### Bad: backfill from memory
```ts
const estimatedTotal = 4.0; // roughly what the run cost
```
Bad because “roughly” is not a ledger.

### Good: keep provisional outputs in `smokes/`
```text
experiments/h-rag-precision/
  prereg.md
  judge.lock
  smokes/
    run-001.json
    run-002.json
    aggregate.md
```
Good because raw evidence is organized and still isolated from claim files.

### Bad: leak a smoke into a headline file
```text
experiments/h-rag-precision/RESULTS.md
  Our method beats the reproduced baseline by 3.7%.
```
Bad because falsification review has not happened yet.

### Good: finish `n`, then summarize
You run all preregistered observations, preserve every valid failure, and compute the planned summary only after collection is complete.

### Bad: adaptive execution disguised as “being responsive”
After six runs, you tweak the prompt, rerun weak seeds, and switch metrics because the original plan no longer flatters the result.
That is not responsiveness. That is post-hoc methodology drift.

## Why This Matters
A clean execution phase buys you five things that clever improvisation never will.

1. **Reproducibility** — somebody else can rerun the method because the protocol stayed fixed.
2. **Auditability** — the hypothesis entry, preregistration, lock file, cost ledger, and provisional artifacts all tell the same story.
3. **Cost accountability** — you know exactly what the hypothesis consumed, including failed calls.
4. **Interpretive separation** — measurement happens before narrative, so `RESULTS.md` does not become a wish list.
5. **Faster downstream review** — falsification review is much easier when execution artifacts are already honest and organized.

Execution is not where you prove brilliance.
Execution is where you prove restraint.

After this, use `/skill:falsification-review`.
