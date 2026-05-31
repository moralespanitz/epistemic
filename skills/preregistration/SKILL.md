---
name: preregistration
description: Use when a hypothesis is concrete enough to freeze the experiment contract, lock the judge and compute environment, and scaffold the run before any experiment-shaped command executes.
---

> **Related skills:** `/skill:research-question`, `/skill:baseline-reproduction`

# Preregistration

## Overview

Preregistration is where ambition loses the right to improvise.

In this repo, prereg is not paperwork.
It is the point where you freeze:
- the claim
- the falsifier
- the sample
- the judge
- the baseline target
- the budget
- the best-case conclusion
- the compute target and, when needed, the compute environment

`src/gates/prereg.ts` currently blocks experiment-shaped `bash` calls when `experiments/{id}/prereg.md` is missing.
Treat that as the floor, not the standard.
A real prereg is incomplete until the repository contains the artifacts required by the active `computeTarget`.

The current state surface in `src/state/repo.ts` already supports this:
- `HypothesisEntry` persists `bestCaseConclusion`
- `HypothesisEntry` persists `computeTarget`
- `ComputeTarget` is `local | docker | modal`
- `writeJudgeLock(...)` writes `experiments/{id}/judge.lock`
- `getEnvironmentLock(...)` reads `experiments/{id}/environment.lock`
- `computeEnvironmentHash(...)` computes the environment lock hash you must write when the target is `docker`

If the compute target is `docker`, prereg includes the runtime scaffold:
- `experiments/{id}/Dockerfile`
- `experiments/{id}/requirements.txt`
- `experiments/{id}/environment.lock`

If the compute target is `modal`, prereg includes:
- `experiments/{id}/modal-app.py`

If the compute target is `local`, prereg is still required.
Local is not a loophole.
It just means the environment freeze is descriptive instead of containerized.

This skill replaces the old split between “write the prereg,” “lock the judge,” and “decide the runtime later.”
Do it in one pass.
Freeze the contract.
Freeze the evaluator.
Freeze the execution surface.
Then code can run.

## The Iron Law

```text
NO EXPERIMENT-SHAPED CODE BEFORE THE CONTRACT, LOCKS, AND SCAFFOLD EXIST
```

No benchmark code.
No eval code.
No training code.
No smoke script that emits evidence you may later quote.
No “just checking the docker image.”
No “just making sure Modal boots.”
No helper that changes what story you can tell later.

If the command can influence what gets claimed, it comes after preregistration.

## When to Use

Use this skill:
- immediately after `/skill:research-question`
- when an `OPEN` hypothesis is concrete enough to freeze
- before the first benchmark run
- before the first judge call
- before the first training job
- before the first scripted comparison
- before any spend that will land in `.epistemic/cost-ledger.jsonl`
- when reviving an old idea under an existing hypothesis ID
- when the active hypothesis now has a real `computeTarget` and must be scaffolded cleanly
- before writing anything that might later land in `experiments/{id}/RESULTS.md`

## When NOT to Use

Do not use this skill:
- for vague brainstorming; use `/skill:research-question`
- after you already ran the experiment
- to backfill paperwork for a dirty run
- to rewrite the claim after seeing smoke results
- to change the compute target midstream because one platform now looks friendlier
- as a substitute for `/skill:baseline-reproduction`
- as a substitute for falsification review
- to sneak in a new judge, new environment, or new dependency after outputs exist
- to treat `local` as permission to skip environment thinking
- to call `runFalsificationAdversary({ claim, cwd, hypothesisId })` from `src/adversary/dispatch.ts`; that is later

## State Surface

| Surface | API or file | Use at this phase |
| --- | --- | --- |
| Repo sanity check | `loadRepoState(cwd)` | Confirm the scaffold exists before you assume normal flow |
| Canonical hypothesis registry | `HYPOTHESES.md` | Stores the active compact contract |
| Read hypotheses | `loadHypotheses(cwd)` | Load the current experiment registry |
| Parse raw registry text | `parseHypotheses(content)` | Use only if markdown is already loaded |
| Detect live work | `getActiveHypothesis(entries)` | Identify the active `OPEN` or `RUNNING` hypothesis |
| Render one hypothesis | `hypothesisToMarkdown(entry)` | Keep the registry parseable |
| Persist registry | `saveHypotheses(cwd, entries)` | Write the updated hypothesis entry |
| Artifact existence | `fileExists(path)` | Detect broken or partial prereg state |
| Judge hash | `computeJudgeHash(judgeRef, hypothesisId)` | Recompute the locked judge hash |
| Judge lock read | `getJudgeLock(cwd, hypothesisId)` | Detect judge drift before writing |
| Judge lock write | `writeJudgeLock(cwd, hypothesisId, judgeRef)` | Create `experiments/{id}/judge.lock` |
| Environment hash | `computeEnvironmentHash(...)` | Compute the Docker environment lock hash |
| Environment lock read | `getEnvironmentLock(cwd, hypothesisId)` | Detect environment drift before writing |
| Hypothesis spend | `getHypothesisSpend(cwd, id)` | Check whether the run already burned money |
| Repo-wide spend | `getAllHypothesisSpends(cwd)` | Useful when several live ideas compete for budget |
| Cost ledger | `.epistemic/cost-ledger.jsonl` | Spend policy anchor |
| Docker scaffold | `experiments/{id}/Dockerfile`, `experiments/{id}/requirements.txt` | Required when `computeTarget = docker` |
| Docker environment lock | `experiments/{id}/environment.lock` | Required when `computeTarget = docker` |
| Modal scaffold | `experiments/{id}/modal-app.py` | Required when `computeTarget = modal` |
| Prereg artifact | `experiments/{id}/prereg.md` | Narrative contract for the live experiment |

Current repo reality matters:
`HypothesisEntry` now round-trips both `bestCaseConclusion` and `computeTarget`.
Do not pretend those are prereg-only notes.
They belong in `HYPOTHESES.md` and in `experiments/{id}/prereg.md`.

## The Contract Shape

The research contract still has seven epistemic fields:

1. **Claim**
2. **Falsifier**
3. **Sample size**
4. **Judge configuration**
5. **Baseline reference**
6. **Cost cap**
7. **Best-case conclusion**

It also has one execution field:

8. **Compute target**

The research fields answer whether the claim is testable.
The compute target answers what environment must be frozen before code runs.

If any one of these is weak, the prereg is weak.
If any one of them is missing, the prereg is incomplete.
If the prereg is incomplete, the experiment should not run.

## The Process

### 1. Resolve repository state before you write anything

1. Start from the repo, not from memory.
2. Use `loadHypotheses(cwd)` to read `HYPOTHESES.md`.
3. If raw markdown is already loaded, use `parseHypotheses(content)`.
4. Use `getActiveHypothesis(entries)` to identify the live experiment.
5. If there is no active hypothesis and the idea is still vague, go back to `/skill:research-question`.
6. If there is no active hypothesis but the idea is already concrete, create the entry here through the canonical helpers.
7. If there is more than one `OPEN` or `RUNNING` hypothesis sharing the same result stream, stop.
8. One prereg belongs to one experiment ID.
9. Confirm the directory root is `experiments/{id}/`.
10. Use `fileExists(path)` to check `experiments/{id}/prereg.md`.
11. Use `fileExists(path)` to check `experiments/{id}/judge.lock`.
12. Read `computeTarget` from the active hypothesis before deciding what else must exist.
13. If `computeTarget` is `docker`, also check `experiments/{id}/Dockerfile`, `experiments/{id}/requirements.txt`, and `experiments/{id}/environment.lock`.
14. If `computeTarget` is `modal`, also check `experiments/{id}/modal-app.py`.
15. If any lock or scaffold exists without `prereg.md`, treat that as broken state.
16. Keep status `OPEN` while preregistration is being created or repaired.
17. Do not call `updateHypothesisStatus(...)` here.
18. The gate in `src/gates/prereg.ts` flips `OPEN` to `RUNNING` on the first allowed experiment command.
19. The gate currently enforces only `prereg.md`.
20. Your process is stricter than the gate.
21. Methodology is not defined by the regex floor.

### 2. Field 1 of 7 — validate the claim

1. A claim is not a slogan.
2. It must name the intervention.
3. It must name the comparator.
4. It must name the metric.
5. It must name the task, benchmark, dataset, or slice.
6. It must name the direction of change.
7. If a threshold matters, write the threshold now.
8. Reject claims like “this is better.”
9. Reject claims like “more robust” with no metric.
10. Reject claims like “users will love it” with no observable criterion.
11. Reject bundled claims that require multiple experiments to test.
12. Good claims are narrow enough to fail cleanly.
13. Bad claims can only be defended with interpretation.
14. Write the claim so later review can attack it without reading your mind.
15. If the claim cannot later become a one-line result statement, it is still mush.

### 3. Field 2 of 7 — validate the falsifier

1. The falsifier is the condition that kills the claim.
2. If the claim cannot be killed, it is not a research claim.
3. The falsifier must be empirical.
4. The falsifier must be reachable by the planned experiment.
5. The falsifier must not depend on vibes, elegance, intent, or worldview.
6. Reject philosophical non-falsifiers.
7. Reject “if the model does not truly understand.”
8. Reject “if users do not spiritually resonate.”
9. Reject “if the approach is not elegant enough.”
10. Reject moving-goal clauses like “unless the seed was unlucky.”
11. A valid falsifier sounds like a stop condition.
12. Example: “If mean exact-match improvement is less than 2 points across n=30 runs, the claim is falsified.”
13. Example: “If pass@1 is not higher than baseline under the locked judge, the claim is falsified.”
14. Example: “If cost-normalized win rate does not exceed the named baseline by 5%, the claim is falsified.”
15. If two hostile reviewers would not agree on the falsifier, it is still weak.
16. Fix this before you write anything else.

### 4. Field 3 of 7 — validate sample size

1. In `src/state/repo.ts`, the registry field is `n`.
2. Do not invent a parallel `sampleSize` field in `HYPOTHESES.md`.
3. `n` must be a positive integer.
4. `n` must match the actual unit of repetition.
5. Say whether `n` means prompts, seeds, tasks, or full runs.
6. If the system is stochastic, `n = 1` is usually a confession.
7. Reject “we will run until it looks stable.”
8. Reject “we will stop when the chart looks convincing.”
9. Reject “start with 3 and decide later” unless the staged plan itself is preregistered.
10. Match `n` to the falsifier.
11. Match `n` to the budget.
12. Match `n` to the expected runtime.
13. If you cannot afford the declared sample, narrow the claim instead of lying about the design.
14. If you do not know what one unit of repetition means, you are not ready to preregister.

### 5. Field 4 of 7 — validate judge configuration and lock it

1. The judge has four required leaves.
2. They are `model`, `prompt`, `temperature`, and `seed`.
3. Missing any one of them means the judge is not locked.
4. “Default temperature” is not a value.
5. “Current prompt” is not a value.
6. “Latest model” is not a value.
7. Pin the exact model identifier.
8. Pin the exact prompt text or an immutable prompt reference.
9. If the prompt lives in a file, record the file path and immutable revision.
10. Record `temperature` as a number.
11. Record `seed` as a number.
12. If the provider ignores seeds, record the requested seed anyway.
13. Build a canonical object from exactly these four fields.
14. Serialize it in stable key order.
15. Turn that frozen judge payload into `judgeRef`.
16. Use `writeJudgeLock(cwd, hypothesisId, judgeRef)` from `src/state/repo.ts` to write `experiments/{id}/judge.lock`.
17. If `getJudgeLock(cwd, hypothesisId)` already returns a value, recompute the expected hash with `computeJudgeHash(judgeRef, hypothesisId)` and compare it.
18. If the hash differs, stop.
19. That is judge drift.
20. Do not overwrite drift casually.
21. If you must break the lock, record the reason in `OVERRIDES.md` before changing it.
22. The discipline is simple: no drift without override.
23. This lock belongs in preregistration, not after the first eval.

### 6. Field 5 of 7 — validate baseline reference

1. Comparative claims require a named baseline.
2. Use `loadBaselines(cwd)` to inspect known baselines.
3. Current `BaselineEntry` fields are `name`, `url`, `score`, `judge`, `version`, and `retrieved`.
4. If the target baseline exists locally, inspect `retrieved` with `getBaselineAgeDays(entry)`.
5. If the baseline is older than 30 days, it is stale.
6. Stale baselines do not support fresh comparison claims.
7. If the baseline is external, record the URL anyway.
8. Record the quoted score.
9. Record the version or release identifier.
10. Record the evaluation method or judge when known.
11. Record whether local reproduction is still pending.
12. Do not use “SOTA” as a baseline name.
13. Do not use memory as a baseline source.
14. If you cannot name the baseline precisely, the claim is not ready.
15. Naming a baseline is not reproducing a baseline.
16. That comes next, under `/skill:baseline-reproduction`.

### 7. Field 6 of 7 — validate cost cap

1. The cost cap is part of the design.
2. It is not decoration.
3. The ledger lives at `.epistemic/cost-ledger.jsonl`.
4. Use `getHypothesisSpend(cwd, hypothesisId)` to inspect existing spend for this experiment.
5. Use `getAllHypothesisSpends(cwd)` if you need repo-wide context.
6. Before a clean prereg, spend should usually be zero.
7. Non-zero spend before prereg is a protocol breach or a resumed run.
8. Treat that as a red flag.
9. Set the cap in real USD.
10. Base it on expected calls, tokens, environment cost, and `n`.
11. Reject `$0`, `uncapped`, or `we’ll see`.
12. Reject caps that cannot fund the declared sample.
13. Reject caps that only work if every run succeeds on the first try.
14. Later, actual tool costs get recorded through `appendCostRecord(cwd, record)`.
15. A real cap should feel slightly uncomfortable.

### 8. Field 7 of 7 — validate best-case conclusion explicitly

1. This field is mandatory.
2. Ask the question directly:
3. **What is the sober, low-expectations outcome if this works?**
4. Write the answer before results exist.
5. Keep it to one sentence.
6. Keep it smaller than the story in your head.
7. Tie it to the named task, named baseline, and locked judge.
8. Good: “Under the locked judge on GSM8K, prompt A appears better than the reproduced zero-shot baseline.”
9. Bad: “We solved reasoning.”
10. Bad: “This proves general intelligence.”
11. Bad: “Users will love it everywhere.”
12. In the current repo, `HypothesisEntry` persists `bestCaseConclusion`.
13. Record it in `HYPOTHESES.md`.
14. Mirror it in `experiments/{id}/prereg.md`.
15. If the conclusion ceiling feels restrictive, that is proof it is doing its job.

### 9. Execution field — validate `computeTarget` and scaffold the right runtime

1. Read `computeTarget` from the active `HypothesisEntry`.
2. The allowed values are exactly `local`, `docker`, and `modal`.
3. Validate the value.
4. Reject blank values.
5. Reject unknown values like `gpu`, `cluster`, `k8s`, `serverless`, or `whatever runs fastest`.
6. Do not infer the target from the current laptop.
7. Do not let the target drift because infra friction changed.
8. The target is part of the contract.
9. It determines which scaffold must exist before code runs.
10. Route strictly by value.

#### If `computeTarget = local`

1. `prereg.md` is still required.
2. `judge.lock` is still required.
3. Record the target as `local` in both `HYPOTHESES.md` and `prereg.md`.
4. Write down any local-only assumptions in the prereg notes.
5. Do not pretend local execution is reproducible just because it is convenient.
6. Local is the lightest scaffold, not an exemption from discipline.

#### If `computeTarget = docker`

1. Create `experiments/{id}/Dockerfile`.
2. Create `experiments/{id}/requirements.txt`.
3. Pin the Python base image version exactly.
4. Example: `FROM python:3.11.9-slim`.
5. Do not use floating tags like `python:3.11`, `python:latest`, or `ubuntu:latest`.
6. In `requirements.txt`, pin every third-party dependency exactly with `package==version`.
7. Reject unpinned entries like `numpy`, `pandas>=2`, or comment-only placeholders.
8. An empty `requirements.txt` is acceptable only if the experiment truly uses the Python standard library only, and the prereg should say so plainly.
9. Keep the Dockerfile boring.
10. Good scaffolds privilege reproducibility over clever caching tricks.
11. A minimal shape is enough:
```Dockerfile
FROM python:3.11.9-slim
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip==24.2 \
    && python -m pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "experiments.{id}.run"]
```
12. A minimal `requirements.txt` shape is:
```text
numpy==2.1.1
pydantic==2.9.2
```
13. Those versions are examples, not permission to guess your real dependencies.
14. The real file must pin the dependencies the experiment actually uses.
15. After the Dockerfile and requirements are frozen, compute the environment hash with `computeEnvironmentHash()` from `src/state/repo.ts`.
16. Use the exact frozen Dockerfile input and exact frozen requirements input as the lock basis.
17. Write the resulting SHA-256 to `experiments/{id}/environment.lock`.
18. The required layout is:
    - `experiments/{id}/prereg.md`
    - `experiments/{id}/judge.lock`
    - `experiments/{id}/Dockerfile`
    - `experiments/{id}/requirements.txt`
    - `experiments/{id}/environment.lock`
19. If `getEnvironmentLock(cwd, hypothesisId)` already returns a value, recompute from the current scaffold and compare it.
20. If the hash differs, stop.
21. That is environment drift.
22. Do not overwrite it casually.
23. If you must change the environment after prereg, record the reason in `OVERRIDES.md` first.
24. Judge drift and environment drift follow the same rule: no drift without override.

#### If `computeTarget = modal`

1. Create `experiments/{id}/modal-app.py`.
2. The stub must exist before the first remote run.
3. Generate a minimal app stub with a `@modal.app()` decorator, matching the chosen Modal execution surface.
4. Keep it boring and explicit.
5. The stub exists to freeze the entry point, not to show off framework fluency.
6. A minimal shape is:
```py
import modal

@modal.app()
def app():
    """Experiment app scaffold for {id}."""
```
7. If the real run needs additional functions, images, volumes, or secrets, add them deliberately after they are part of the prereg contract.
8. Do not quietly bootstrap Modal from an ad hoc scratch file outside `experiments/{id}/`.
9. Record the target as `modal` in both `HYPOTHESES.md` and `prereg.md`.
10. For now, the explicit environment lock discipline in this repo applies to Docker scaffolds.
11. Do not invent a parallel `environment.lock` rule for Modal unless the repo standard changes intentionally.

### 10. Update `HYPOTHESES.md` and write the prereg artifacts

1. `HYPOTHESES.md` is the compact registry.
2. Use `loadHypotheses(cwd)` to load existing entries.
3. Modify the active `HypothesisEntry` in memory or create one if none exists.
4. The persisted fields now include `id`, `claim`, `falsifier`, `bestCaseConclusion`, `n`, `judgeRef`, `baselineRef`, `costCap`, `computeTarget`, `status`, and `timestamp`.
5. Preserve valid existing metadata.
6. Keep status `OPEN`.
7. Do not set `RUNNING` here.
8. Do not hand-edit the file into a shape `parseHypotheses` cannot read.
9. Use `hypothesisToMarkdown(entry)` and `saveHypotheses(cwd, entries)`.
10. Write `experiments/{id}/prereg.md` at the exact path `experiments/{id}/prereg.md`.
11. Create `experiments/{id}/` if needed.
12. Include all seven epistemic fields.
13. Include the compute target explicitly.
14. Include the experiment ID.
15. Include the current date.
16. Include status `OPEN`.
17. Include the raw judge fields under a dedicated judge section.
18. Include notes that justify the baseline and sample size.
19. If `computeTarget = docker`, include the scaffold file paths and the environment lock hash.
20. If `computeTarget = modal`, include the path to `modal-app.py`.
21. If `computeTarget = local`, include the local environment assumptions plainly.
22. Do not include outputs.
23. Do not include smoke numbers.
24. Do not include screenshots.
25. Do not include provisional claims.
26. Use a shape like this:

```md
# Pre-registration: {id}
- Date: 2026-05-31
- Status: OPEN
- Claim: {claim}
- Falsifier: {falsifier}
- N: {n}
- Baseline reference: {baselineRef}
- Cost cap: ${costCap}
- Best-case conclusion: {bestCaseConclusion}
- Compute target: {computeTarget}

## Judge
- Model: {model}
- Prompt: {prompt}
- Temperature: {temperature}
- Seed: {seed}

## Environment
- Dockerfile: experiments/{id}/Dockerfile
- Requirements: experiments/{id}/requirements.txt
- Environment lock: {environmentHash}

## Notes
- Baseline status: pending local reproduction
- Sample rationale: {why n is enough}
```

27. If the target is not Docker, adapt the environment section honestly instead of copying boilerplate.
28. If a field is missing, the prereg is incomplete.
29. If the file reads like a diary, rewrite it until it reads like a contract.

### 11. Commit the prereg before code runs

1. Writing the files is not enough.
2. The prereg must exist in version control before the experiment starts.
3. Stage the registry and experiment artifacts together.
4. The always-required set is:
   - `HYPOTHESES.md`
   - `experiments/{id}/prereg.md`
   - `experiments/{id}/judge.lock`
5. If `computeTarget = docker`, also stage:
   - `experiments/{id}/Dockerfile`
   - `experiments/{id}/requirements.txt`
   - `experiments/{id}/environment.lock`
6. If `computeTarget = modal`, also stage:
   - `experiments/{id}/modal-app.py`
7. Use a clean prereg commit.
8. Do not batch this with result files.
9. Do not batch this with smoke artifacts.
10. Do not batch this with “one quick run.”
11. The whole point is temporal ordering.
12. Once the prereg exists, `src/gates/prereg.ts` can allow experiment-shaped `bash` calls.
13. On the first allowed run, that gate calls `updateHypothesisStatus(cwd, id, "RUNNING")`.
14. Let the gate own that transition.
15. A clean commit looks like this:

```bash
git add HYPOTHESES.md experiments/{id}/prereg.md experiments/{id}/judge.lock
# docker only:
git add experiments/{id}/Dockerfile experiments/{id}/requirements.txt experiments/{id}/environment.lock
# modal only:
git add experiments/{id}/modal-app.py
git commit -m "epistemic: prereg {id}"
```

16. After the commit exists, hand off to baseline reproduction.
17. Do not call the adversary yet.
18. Do not write `experiments/{id}/RESULTS.md` yet.
19. Do not quote smoke artifacts from `experiments/{id}/smokes/` yet.

## Common Rationalizations

| Excuse | Reality |
| --- | --- |
| “I’ll write `prereg.md` after one smoke run.” | Then the smoke run already contaminated the design. |
| “I only need a quick script.” | Quick scripts still generate evidence. |
| “The falsifier is obvious.” | If it is not written, it will move. |
| “Temperature defaults to zero anyway.” | Defaults drift; pin it. |
| “Seed does not matter for this provider.” | Recording it is cheap and auditable. |
| “I know the baseline from memory.” | Memory is not a reproduced source. |
| “I’ll lock the judge later.” | Later means after outputs existed. |
| “Judge lock is enough; the environment can stay loose.” | Judge drift and environment drift are different failure modes. |
| “We’ll decide between local and Docker after the first run.” | Then `computeTarget` was never part of the contract. |
| “The Dockerfile can stay on `latest` for now.” | Floating base images are just environment drift with better branding. |
| “`requirements.txt` can stay loose; pip will figure it out.” | Loose dependencies are how unreproducible wins get born. |
| “Modal setup is just operational glue.” | Operational changes change what actually ran. |
| “We only spent a little before prereg.” | Reconcile it honestly or kill the run. |
| “Best-case conclusion feels restrictive.” | That is exactly why it matters. |
| “The gate only catches certain commands.” | Integrity is not defined by regex loopholes. |
| “I’ll commit prereg together with the experiment run.” | That destroys ordering and turns prereg into theater. |
| “The baseline is famous enough that we do not need a URL.” | Fame is not provenance. |
| “We can overwrite `environment.lock`; it’s only scaffolding.” | Scaffolding that changes results is part of the experiment. |

## Red Flags - STOP

- `getHypothesisSpend(cwd, id)` is already non-zero before prereg exists.
- `getJudgeLock(cwd, id)` exists and does not match the current canonical judge.
- `getEnvironmentLock(cwd, id)` exists and does not match the current Docker scaffold.
- The falsifier mentions philosophy, intent, vibes, elegance, or worldview.
- The claim compares against a baseline you cannot name precisely.
- `getBaselineAgeDays(entry)` says the comparator is older than 30 days.
- The judge prompt points at a mutable scratch file with no immutable revision.
- `n` is `TBD`, `until stable`, or any other moving target.
- The cost cap cannot fund the declared sample.
- The best-case conclusion is broader than the claim.
- `computeTarget` is missing or not one of `local`, `docker`, `modal`.
- `computeTarget = docker` but `Dockerfile`, `requirements.txt`, or `environment.lock` is missing.
- `computeTarget = modal` but `modal-app.py` is missing.
- The Docker base image tag floats.
- `requirements.txt` contains unpinned dependencies.
- `experiments/{id}/prereg.md` contains outputs, screenshots, or smoke numbers.
- You feel pressure to run “just one command” before the prereg commit exists.
- Multiple `OPEN` or `RUNNING` hypotheses are sharing one result stream.
- You are about to overwrite `judge.lock` because it is inconvenient.
- You are about to overwrite `environment.lock` because the container changed “just a little.”
- You are about to hand-edit `HYPOTHESES.md` into a format `parseHypotheses` cannot parse.

## Good vs Bad

### Good claim and falsifier

```md
Claim:
Prompt A improves exact-match over the reproduced zero-shot baseline by at least 2 points on GSM8K under the locked judge.
Falsifier:
If mean exact-match improvement is less than 2 points across n=30 locked runs, the claim is falsified.
```

Why it is good:
- The comparator exists.
- The metric exists.
- The threshold exists.
- The falsifier is empirical.
- Another reviewer can execute it without reading your mind.

### Bad claim and falsifier

```md
Claim:
Prompt A is smarter and more robust.
Falsifier:
If the model does not truly understand the task or if the benchmark feels unfair.
```

Why it is bad:
- “Smarter” is not a metric.
- “More robust” is not tied to a measurement.
- The falsifier is philosophical.
- The benchmark complaint is a moving escape hatch.

### Good judge config

```json
{
  "model": "gpt-4.1-mini-2026-04-14",
  "prompt": "prompts/gsm8k-judge-v3.md@9f3e2c1",
  "temperature": 0,
  "seed": 17
}
```

Why it is good:
- Every required leaf is present.
- The prompt is pinned.
- The values can be serialized into `judgeRef`.
- `writeJudgeLock(cwd, hypothesisId, judgeRef)` can lock it cleanly.

### Bad judge config

```json
{
  "model": "latest",
  "prompt": "current prompt",
  "temperature": "default"
}
```

Why it is bad:
- `latest` drifts.
- The prompt is mutable.
- `temperature` is not numeric.
- `seed` is missing.

### Good Docker scaffold

```Dockerfile
FROM python:3.11.9-slim
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip==24.2 \
    && python -m pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "experiments.gsm8k_cot.run"]
```

```text
numpy==2.1.1
pydantic==2.9.2
```

Why it is good:
- The Python version is pinned.
- Dependencies are pinned.
- The entrypoint is explicit.
- `computeEnvironmentHash(...)` has a stable scaffold to lock.

### Bad Docker scaffold

```Dockerfile
FROM python:latest
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "run.py"]
```

```text
numpy
pydantic>=2
```

Why it is bad:
- The base image drifts.
- The dependency set drifts.
- The entrypoint is vague.
- Any later `environment.lock` built on this is theater.

### Good `prereg.md`

```md
# Pre-registration: gsm8k-cot-a-vs-zeroshot-2026-05-31
- Date: 2026-05-31
- Status: OPEN
- Claim: Prompt A improves exact-match over the reproduced zero-shot baseline by at least 2 points on GSM8K under the locked judge.
- Falsifier: If mean exact-match improvement is less than 2 points across n=30 locked runs, the claim is falsified.
- N: 30
- Baseline reference: GPT-4o zero-shot, https://example.com/report, score 84.1, judge exact-match, version 2026-05-10, pending reproduction
- Cost cap: $35
- Best-case conclusion: Under the locked judge on GSM8K, prompt A appears better than the reproduced zero-shot baseline.
- Compute target: docker

## Judge
- Model: gpt-4.1-mini-2026-04-14
- Prompt: prompts/gsm8k-judge-v3.md@9f3e2c1
- Temperature: 0
- Seed: 17

## Environment
- Dockerfile: experiments/gsm8k-cot-a-vs-zeroshot-2026-05-31/Dockerfile
- Requirements: experiments/gsm8k-cot-a-vs-zeroshot-2026-05-31/requirements.txt
- Environment lock: 9db0c4f7f5f0c2f57d6e1f5a0d1b4f8a8e4d9f8e4578a6d3e7c8a2b9d1f8c4aa
```

Why it is good:
- All seven epistemic fields are present.
- The compute target is explicit.
- The judge is inspectable.
- The baseline target is concrete.
- The conclusion ceiling is explicit.
- The environment artifact path is frozen.

### Bad `prereg.md`

```md
# Notes for experiment
- Claim: We think this prompt might be better.
- Falsifier: TBD
- N: start with 3
- Baseline: sota
- Cost cap: maybe $100?
- Compute target: maybe docker later
```

Why it is bad:
- The judge section is missing.
- The best-case conclusion is missing.
- The falsifier is missing.
- The baseline is fake.
- `N` is still being negotiated.
- The compute target is not locked.
- There is no environment scaffold discipline.

## Why This Matters

Preregistration protects you from your future self.
Not the cartoon villain version.
The tired, clever, motivated version that can rationalize almost anything after seeing a graph.

A written claim prevents drift.
A hard falsifier prevents rhetoric from replacing evidence.
A declared sample prevents optional stopping.
A locked judge prevents judge-shopping.
A locked compute target prevents platform-shopping.
A locked Docker scaffold prevents “works on my machine” folklore from sneaking into the result.
A named baseline gives `/skill:baseline-reproduction` a real target.
A cost cap prevents ego from burning money.
A best-case conclusion caps what you are allowed to say even on a good day.
A committed `prereg.md` gives `src/gates/prereg.ts` permission to let code run.

If this phase is sloppy, every later phase inherits the slop.
If this phase is tight, later disagreement becomes useful instead of political.

After this, use `/skill:baseline-reproduction`.
