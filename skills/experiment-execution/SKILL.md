---
name: experiment-execution
description: Use when a preregistered hypothesis is ready to run and you must generate provisional evidence under the locked method without contaminating headline outputs.
---

> **Related skills:** `/skill:preregistration`, `/skill:baseline-reproduction`, `/skill:falsification-review`, `/skill:kill-or-ship`

# Experiment Execution

## Overview
Execution is where method turns into evidence.
Not where you redesign the method, switch carriers because today is inconvenient, or leak a promising number into a headline file.

Your job is narrow:
- load the active hypothesis from repo state
- obey its `computeTarget`
- enforce `prereg.md`, `judge.lock`, and `environment.lock` before launch
- run the committed sample size `n`
- keep outputs provisional under `experiments/{id}/smokes/`
- append a real compute row after every run with `appendCostRecord(...)`

Core principle: execution is measurement under a locked contract.
Routing, environment, and cost accounting are part of that contract.
If you improvise on any of them, downstream review cannot rescue the result.

## Quick Reference
| Need | File or API | Rule |
| --- | --- | --- |
| Load hypothesis state | `loadHypotheses(cwd)` | Start from repo state, not memory |
| Select the live experiment | `getActiveHypothesis(entries)` | Do not guess the active `id` |
| Read execution target | `HypothesisEntry.computeTarget` | `local`, `docker`, or `modal` is part of the method |
| Mark execution start | `updateHypothesisStatus(cwd, id, "RUNNING")` | Bookkeeping only |
| Check preregistration | `fileExists("experiments/{id}/prereg.md")` | No prereg, no run |
| Read judge lock | `getJudgeLock(cwd, id)` | Missing or drifted judge lock blocks scored execution |
| Read environment lock | `getEnvironmentLock(cwd, id)` | Missing or drifted environment lock blocks all execution |
| Compare judge hash | `computeJudgeHash(judgeRef, id)` | Check before the first scored call |
| Read spend | `getHypothesisSpend(cwd, id)` | Watch the cap before more runs |
| Split spend by type | `getHypothesisSpendByCategory(cwd, id)` | Separate `llm` from `compute` burn |
| Append compute cost | `appendCostRecord(cwd, record)` | Use `category: "compute"` after every attempted run |
| Local or docker env contract | active `Dockerfile` + `requirements.txt` | Hash the exact pair used for the run |
| Modal env contract | `experiments/{id}/modal-app.py` | Hash the exact file you will execute |
| Docker writable path | `experiments/{id}/` | Mount this read-write; everything else read-only |
| Provisional artifacts | `experiments/{id}/smokes/` | Logs and raw outputs live here |
| Headline files | `experiments/{id}/RESULTS.md` and any root `RESULTS.md` | Do not write here yet |

## The Iron Law
```text
NO RUN WITHOUT LOCKS; NO RUN WITHOUT A LEDGER ROW
```

Every legitimate run leaves four traces:
1. `experiments/{id}/prereg.md`
2. the relevant lock files
3. provisional artifacts under `experiments/{id}/smokes/`
4. a cost row in `.epistemic/cost-ledger.jsonl`

If any trace is missing, you do not have evidence.
You have a story.

## When to Use
Use this skill when:
- `experiments/{id}/prereg.md` already exists
- a hypothesis in `HYPOTHESES.md` is `OPEN` or `RUNNING`
- you are about to write experiment code, launch a benchmark, or call a model-backed evaluator
- the run will create provisional outputs that must stay out of headline files
- the active hypothesis specifies `computeTarget: local`, `docker`, or `modal`
- the run consumes real budget and every attempt must land in the ledger
- `environment.lock` and, if applicable, `judge.lock` must be enforced before launch
- you need to finish the preregistered sample size `n` and compute the promised summary

## When NOT to Use
Do not use this skill when:
- the claim is still being framed — use `/skill:research-question`
- the method is still being locked — use `/skill:preregistration`
- you are reproducing an external baseline — use `/skill:baseline-reproduction`
- you are attacking the finished result — use `/skill:falsification-review`
- you are making the terminal decision — use `/skill:kill-or-ship`
- you want one “quick run” before preregistration or lock files are settled

A quick run that changes what you believe is not a harmless preview.
It is a real run with missing governance.

## The Process

### 1. Identify the active hypothesis and its carrier
1. Call `loadHypotheses(cwd)`.
2. Call `getActiveHypothesis(entries)`.
3. Read the execution-critical fields from the live entry: `id`, `claim`, `falsifier`, `n`, `judgeRef`, `baselineRef`, `costCap`, `computeTarget`, and `status`.
4. Treat `computeTarget` as part of the preregistered method.
5. Valid values are `local`, `docker`, and `modal`.
6. Do not infer the target from convenience, machine state, installed tools, or personal preference.
7. Derive the working paths immediately:
   - `experiments/{id}/prereg.md`
   - `experiments/{id}/judge.lock`
   - `experiments/{id}/environment.lock`
   - `experiments/{id}/modal-app.py`
   - `experiments/{id}/smokes/`
   - `experiments/{id}/RESULTS.md`
   - `.epistemic/cost-ledger.jsonl`
8. If execution is legitimately starting now, move `OPEN` to `RUNNING` with `updateHypothesisStatus(cwd, id, "RUNNING")`.
9. Do not mark anything `CONFIRMED` here.
10. Execution measures.
11. Review interprets.

### 2. Refuse to run without `prereg.md`
1. Confirm `experiments/{id}/prereg.md` exists with `fileExists(path)`.
2. If it does not exist, stop immediately.
3. Do not run `bun`, `python`, `pytest`, `benchmark`, `train`, `docker`, or `modal` commands and promise yourself you will document the method later.
4. Read the preregistration and extract the operational contract:
   - planned sample size `n`
   - task or dataset slice
   - metric definition
   - judge configuration if scoring is involved
   - stopping rule
   - retry or exclusion policy
   - execution carrier if the prereg makes it explicit
5. Compare that contract against the active `HypothesisEntry`.
6. If `n`, `judgeRef`, `baselineRef`, or `computeTarget` disagree between preregistration and `HYPOTHESES.md`, repair the inconsistency before running.
7. Treat preregistration as executable governance.
8. It is not a diary entry.

### 3. Enforce the judge lock before any scored evaluation
1. Read `judgeRef` from the active hypothesis.
2. Load the stored lock with `getJudgeLock(cwd, id)`.
3. Compute the expected value with `computeJudgeHash(judgeRef, id)`.
4. Compare the two before the first scored call, not after the number is already on your screen.
5. If the lock is missing and this is the first legitimate locked run, create it deliberately with `writeJudgeLock(cwd, id, judgeRef)`.
6. If the lock exists and does not match, stop.
7. Do not rationalize that the prompt change was cosmetic or the model version shift was basically the same.
8. Judge drift is method drift.

### 4. Enforce the environment lock before any compute launches
1. Load the stored lock with `getEnvironmentLock(cwd, id)`.
2. If it returns `null`, stop.
3. Execution reads `environment.lock`.
4. It does not mint or rewrite it mid-run.
5. For `local` and `docker`, the environment contract is the exact `Dockerfile` and `requirements.txt` registered for this run.
6. If the repo could plausibly contain more than one pair, preregistration must name the pair.
7. Execution does not guess.
8. Hash the current contents of that `Dockerfile` plus `requirements.txt` in a deterministic order and compare the result to `environment.lock`.
9. If either file is missing, stop.
10. Missing dependency files are a contract failure, not a setup detail.
11. For `modal`, the environment contract is `experiments/{id}/modal-app.py`.
12. Write that file from the locked protocol if the modal target requires it, then treat the exact file you will execute as frozen.
13. Hash the current contents of `modal-app.py` and compare the result to `environment.lock`.
14. If the stored lock and current hash differ, stop.
15. That is environment drift.
16. Do not “just refresh” `environment.lock` after editing `Dockerfile`, `requirements.txt`, or `modal-app.py`.
17. The lock exists to prevent exactly that move.
18. Local and docker share an environment contract.
19. The carrier may differ.
20. The locked dependencies do not.

### 5. Arm the cost ledger before the first run
1. The canonical ledger is `.epistemic/cost-ledger.jsonl`.
2. Read the current total with `getHypothesisSpend(cwd, id)`.
3. If you need the split, read `getHypothesisSpendByCategory(cwd, id)`.
4. If you need portfolio context, read `getAllHypothesisSpends(cwd)`.
5. Treat compute cost as first-class spend, not invisible overhead.
6. Plan to append one `CostRecord` with `category: "compute"` after every attempted run.
7. Failed launches still count as attempts and still get a ledger row.
8. Do not batch cost entries at the end of the day.
9. If the remaining budget cannot support the committed run set, stop and hand off to the override or kill flow.

### 6. Route execution from `computeTarget`, not from convenience
1. Branch strictly on `h.computeTarget`.
2. `local` means run in a virtual environment under the locked dependency contract.
3. Use the venv as the carrier, not as permission to install extras or patch dependencies ad hoc.
4. Capture the merged stdout/stderr and persist it to `experiments/{id}/smokes/run-{n}.log`.
5. `docker` means build from the registered `Dockerfile`, then execute inside a container.
6. Run from `/work` inside the container.
7. Mount the repo read-only and mount `experiments/{id}/` read-write.
8. The safe shape is:
```bash
docker run --rm \
  -v "$(pwd):/work:ro" \
  -v "$(pwd)/experiments/{id}:/work/experiments/{id}:rw" \
  -w /work \
  <image> <command>
```
9. That mount pattern is containment, not decoration.
10. The container must not rewrite unrelated files.
11. Capture build and run output.
12. If you use one log per run, it must be complete enough to audit the launch.
13. `modal` means write `experiments/{id}/modal-app.py` with `@modal.app()` and `@modal.function()` decorators.
14. Install dependencies inside the Modal image definition, not ad hoc on the host.
15. Launch with `modal run experiments/{id}/modal-app.py`.
16. Capture the merged stdout/stderr from that command and persist it to `experiments/{id}/smokes/run-{n}.log`.
17. Never switch carriers mid-experiment because another path feels easier today.
18. Carrier drift is method drift.

### 7. Append compute cost immediately after each run
1. After every attempted run, call `appendCostRecord(cwd, record)`.
2. Use the real `CostRecord` shape from `src/state/repo.ts`.
3. Set `category: "compute"`.
4. For `local` and `docker`, record `estimatedCost: 0`.
5. In this repo, those carriers are tracked as compute work with zero billed external cost.
6. For `modal`, record `estimatedCost = gpuSeconds × rate`.
7. Fix `rate` before the run.
8. Do not reverse-engineer it after seeing the result.
9. Set `toolName` to the actual backend.
10. Set `isError` to reflect whether the run failed.
11. Append the row immediately after the run ends.
12. Do not rely on memory.
13. Do not leave Modal compute blank because estimating it is annoying.

### 8. Finish the committed sample size
1. Do not summarize after 3 of 30 runs because the trend looks obvious.
2. Do not stop early because the result is already good enough for a slide.
3. Do not stop early because the result is ugly and you would rather redesign the method.
4. Complete the full `n` unless the preregistered stopping rule explicitly says otherwise.
5. Keep the important invariants fixed across runs:
   - same dataset slice
   - same prompt and extraction rule
   - same judge
   - same model settings
   - same metric definition
   - same `computeTarget`
6. Do not peek at early outputs and then revise the method mid-run.
7. That means no prompt edits, no seed swaps, no ad hoc retries, no threshold tweaks, no carrier changes, and no selective cleanup after seeing weak runs.
8. If infrastructure actually fails, follow the retry rule that was already written in preregistration.
9. If preregistration did not define the failure policy, stop and repair the protocol before continuing.

### 9. Store provisional artifacts in `smokes/` and nowhere else
1. Use `experiments/{id}/smokes/` as the provisional artifact directory.
2. Put raw per-run outputs there with deterministic names such as:
   - `run-001.log`
   - `run-001.json`
   - `run-002.log`
   - `aggregate.md`
   - `notes.md`
3. Keep experiment-local evidence under the experiment directory even if the repo scaffold also contains a top-level `smokes/`.
4. Treat everything in `experiments/{id}/smokes/` as provisional and non-quotable.
5. Non-quotable means the number does not belong in:
   - `experiments/{id}/RESULTS.md`
   - a root `RESULTS.md`
   - a README
   - a PR description
   - a commit message
   - a polished claim sentence
6. Working notes belong in `smokes/` too if they mention provisional numbers.
7. Do not write to `experiments/{id}/falsifiers/{model}.md` here.
8. That directory belongs to later adversarial review.

### 10. Compute the prescribed summary only after collection ends
1. Once the full sample is complete, compute the summary statistics named in preregistration.
2. Mean, median, pass rate, win rate, confidence interval, and error rate are valid only if they were planned.
3. Do not invent a new flattering metric because the original one underperformed.
4. Keep raw observations and summary outputs side by side inside `experiments/{id}/smokes/`.
5. Raw data without a summary is hard to audit.
6. Summary without raw data is easy to manipulate.
7. If the completed summary is surprising, note the surprise.
8. Do not retroactively rewrite the method.

### 11. Stop at the publication boundary
1. When execution is complete, stop.
2. Do not write to `experiments/{id}/RESULTS.md` yet.
3. If the repo also maintains a root `RESULTS.md`, do not write there either.
4. Do not upgrade the hypothesis to `CONFIRMED` just because the mean looks good.
5. Do not write a headline sentence like “we beat baseline X by Y%” before later review.
6. The output of execution is a clean handoff package, not a claim:
   - `experiments/{id}/prereg.md`
   - `experiments/{id}/judge.lock`
   - `experiments/{id}/environment.lock`
   - `experiments/{id}/modal-app.py` if `computeTarget` is `modal`
   - `experiments/{id}/smokes/` artifacts
   - the relevant rows in `.epistemic/cost-ledger.jsonl`
   - the active hypothesis entry in `HYPOTHESES.md`
7. If execution exhausted the cost cap, say so plainly.
8. The next question is not whether this can be published.
9. The next question is whether the provisional result survives scrutiny.

## Reading the Cost Ledger
`.epistemic/cost-ledger.jsonl` is JSON Lines: one JSON object per line, append-only.
Do not treat it like one array and do not rewrite history to make spend look cleaner.

The `CostRecord` shape defined in `src/state/repo.ts` is:
```ts
interface CostRecord {
  timestamp: string;
  hypothesisId: string;
  toolName: string;
  estimatedCost: number;
  category: "llm" | "compute";
  isError: boolean;
}
```

Execution adds `category: "compute"` rows.
Examples:
```json
{"timestamp":"2026-05-31T18:04:11.233Z","hypothesisId":"h-rag-precision","toolName":"compute:local","estimatedCost":0,"category":"compute","isError":false}
{"timestamp":"2026-05-31T18:12:44.901Z","hypothesisId":"h-rag-precision","toolName":"compute:docker","estimatedCost":0,"category":"compute","isError":true}
{"timestamp":"2026-05-31T18:19:52.918Z","hypothesisId":"h-rag-precision","toolName":"compute:modal:a10g","estimatedCost":1.12,"category":"compute","isError":false}
```

Read it with concrete questions:
1. How much has this hypothesis spent in total? Use `getHypothesisSpend(cwd, id)`.
2. How much of that is compute rather than LLM spend? Use `getHypothesisSpendByCategory(cwd, id)`.
3. Did every attempted run leave a compute row? Missing rows usually mean somebody assumed logging instead of verifying it.
4. Are failures clustering in one carrier? Repeated `isError: true` rows are execution evidence, not bookkeeping noise.
5. Did Modal GPU time get recorded with a real rate? If not, cost accountability is already broken.

What not to do:
- Do not delete expensive rows because they are embarrassing.
- Do not log only successful runs.
- Do not leave `local` or `docker` blank because the cost is zero. Zero is still a recorded decision.
- Do not leave Modal compute blank because the estimate takes work.
- Do not replace atomic per-run entries with one rounded final total.
- Do not keep a second private spreadsheet and call the official ledger “good enough later.”

The ledger is methodology, not bookkeeping theater.
Untracked cost usually means untracked execution.

## Common Rationalizations
| Excuse | Reality |
| --- | --- |
| “The hypothesis says `local`, but Docker is cleaner on this machine.” | Carrier choice is part of the registered method. Convenience does not overrule it. |
| “I only changed `requirements.txt` a little.” | A little dependency drift is still dependency drift. |
| “I can rewrite `environment.lock` after I finish debugging.” | Retroactive compliance is theater. Stop and repair the protocol first. |
| “I will let the container write anywhere in the repo because it is faster.” | Wide write access destroys containment and makes the run harder to audit. |
| “Modal cost is hard to estimate, so I will leave compute blank.” | Untracked compute is hidden spend. Estimate it and record it. |
| “The first five runs already prove the point.” | Your preregistered `n` exists to stop exactly that impulse. |
| “I can switch carriers midway to reduce infra noise.” | Mid-run carrier changes are methodology changes after peeking. |
| “Failed launches do not count because no result file was produced.” | They still consumed time, budget, and feasibility. Log them. |
| “I only wrote the number into `RESULTS.md` as a placeholder.” | Headline files are claims, not scratchpads. |
| “I found a better metric after seeing the data.” | Then it is a new analysis, not this preregistered execution. |

## Red Flags - STOP
Stop immediately if any of these are true:
- You are about to launch before checking `experiments/{id}/prereg.md`.
- You cannot say which hypothesis `id` is active.
- You cannot say which `computeTarget` the active hypothesis specifies.
- `judge.lock` exists but you have not compared it against `computeJudgeHash(judgeRef, id)`.
- `environment.lock` exists but you have not compared it against the current environment hash.
- `environment.lock` does not match and you are tempted to “just proceed once.”
- The Docker container can write outside `experiments/{id}/`.
- `modal-app.py` changed after the lock was recorded and you are still planning to run it.
- You have already seen numbers that are not logged and not stored under `smokes/`.
- A run finished and no compute `CostRecord` was appended.
- You want to switch carriers because another path feels easier.
- You are about to mention a provisional number in `RESULTS.md`, a PR, or a commit message.

All of those mean the same thing: stop, return to the contract, and repair the method before generating more evidence.

## Good vs Bad
### Good: route from the active hypothesis
```ts
const entries = await loadHypotheses(cwd);
const h = getActiveHypothesis(entries);
if (!h) throw new Error("No OPEN or RUNNING hypothesis.");

switch (h.computeTarget) {
  case "local":
  case "docker":
  case "modal":
    break;
  default:
    throw new Error(`Unknown compute target: ${h.computeTarget}`);
}
```
Good because the carrier comes from repo state, not from vibes.

### Bad: pick the carrier from convenience
```ts
const target = process.env.USE_DOCKER ? "docker" : "local";
```
Bad because the hypothesis already owns that decision.

### Good: enforce the environment lock before launch
```ts
const lockedEnv = await getEnvironmentLock(cwd, h.id);
if (!lockedEnv) throw new Error("Missing environment.lock.");

const currentEnvHash = computeCurrentEnvironmentHash();
if (lockedEnv !== currentEnvHash) {
  throw new Error("Environment drift detected.");
}
```
Good because the environment is checked before results exist.

### Bad: rewrite the lock after editing the environment
```ts
await writeFile(`experiments/${h.id}/environment.lock`, currentEnvHash, "utf8");
```
Bad because you are laundering drift into compliance.

### Good: contain Docker writes to the experiment directory
```text
-v "$(pwd):/work:ro"
-v "$(pwd)/experiments/h-rag-precision:/work/experiments/h-rag-precision:rw"
```
Good because the container can write evidence without rewriting the repo.

### Bad: mount the whole repo read-write
```text
-v "$(pwd):/work:rw"
```
Bad because the run can silently mutate unrelated files.

### Good: append compute cost immediately
```ts
await appendCostRecord(cwd, {
  timestamp: new Date().toISOString(),
  hypothesisId: h.id,
  toolName: `compute:${h.computeTarget}`,
  estimatedCost: h.computeTarget === "modal" ? gpuSeconds * rate : 0,
  category: "compute",
  isError: runFailed,
});
```
Good because compute burn is explicit and auditable.

### Bad: keep cost in your head until later
```ts
const estimatedTotal = 4.0; // roughly what all runs cost
```
Bad because roughly is not a ledger.

## Why This Matters
Clean execution buys you things improvisation never will.

1. **Carrier discipline** — the run happened on the registered target, not the convenient one.
2. **Environment reproducibility** — `environment.lock` means the dependencies were frozen before launch.
3. **Containment** — Docker can write evidence without rewriting the repository.
4. **Cost accountability** — every run leaves a `compute` row, including zero-cost local and docker runs and billable Modal runs.
5. **Interpretive separation** — measurement stays in `smokes/` until later review decides what, if anything, deserves a headline.

Execution is not where you prove brilliance.
Execution is where you prove restraint.

After execution is complete, use `/skill:statistical-rigor`, then `/skill:falsification-review`.
