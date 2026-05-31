---
name: preregistration
description: Freeze the experiment contract before any benchmark, eval, training, or analysis code runs.
---
> **Related skills:** `/skill:research-question`, `/skill:baseline-reproduction`
# Preregistration
## Overview
This is the gatekeeper.
If preregistration is weak, the rest of the pipeline is theater.
In this repo, prereg is enforced, not suggested.
`src/gates/prereg.ts` inspects `bash` calls.
If a command starts with `bun`, `python`, `pytest`, `eval`, `benchmark`, `run_`, or `train`, and `experiments/{id}/prereg.md` is missing, the call is blocked.
Good. That is how it should work.
This skill replaces the old `/skill:hypothesis` and `/skill:judge-lock` split. You do one pass.
You freeze the contract.
You lock the judge.
You commit the prereg.
Then code can run.
The seven prereg fields are:
1. Claim
2. Falsifier
3. Sample size
4. Judge configuration
5. Baseline reference
6. Cost cap
7. Best-case conclusion
If one field is weak, the experiment is weak. If one field is missing, the prereg is incomplete. If the prereg is incomplete, code does not run.
## The Iron Law
```text
No code without prereg.md
```
No benchmark code.
No eval code.
No training code.
No helper script that emits evidence you might later cite.
No "just one smoke run".
If the command can generate data that would influence the story, it comes after preregistration.
Write `experiments/{id}/prereg.md` first.
Write `experiments/{id}/judge.lock` first.
Commit them first.
## When to Use
- Use this immediately after `/skill:research-question`.
- Use this before the first benchmark run.
- Use this before the first judge call.
- Use this before the first training job.
- Use this before the first scripted comparison.
- Use this when reviving an old idea under an existing experiment id.
- Use this when replacing the old hypothesis registration flow.
- Use this when replacing the old judge-lock flow.
- Use this when a claim is concrete enough to name an experiment id.
- Use this before spending money tracked in `.epistemic/cost-ledger.jsonl`.
- Use this before creating anything that might later land in `experiments/{id}/RESULTS.md`.
## When NOT to Use
- Do not use this for vague brainstorming.
- Do not use this after you already ran the experiment.
- Do not use this to backfill paperwork for a dirty run.
- Do not use this to rewrite the claim after seeing smoke results.
- Do not use this to sneak in a new judge midstream.
- Do not use this as a replacement for `/skill:baseline-reproduction`.
- Do not use this as a replacement for `/skill:falsification-review`.
- Do not call `runFalsificationAdversary({ claim, cwd, hypothesisId })` from `src/adversary/dispatch.ts` here.
- Do not pretend a remembered vendor score is a reproduced baseline.
- Do not proceed if multiple active experiments are sharing one result stream.
## The Process
### 1. Resolve repo state before you write anything
1. Start from repo state, not memory.
2. Use `loadRepoState(cwd)` from `src/state/repo.ts` if you need the top-level snapshot.
3. Use `loadHypotheses(cwd)` to read `HYPOTHESES.md`.
4. If you already have raw markdown, use `parseHypotheses(content)`.
5. Use `getActiveHypothesis(entries)` to identify the current experiment.
6. If there is no active hypothesis, create one here instead of using the deprecated `/skill:hypothesis` flow.
7. If there is more than one `OPEN` or `RUNNING` entry, stop.
8. One prereg belongs to one id.
9. Confirm the directory is `experiments/{id}/`.
10. Use `fileExists(path)` to check `experiments/{id}/prereg.md`.
11. Use `fileExists(path)` to check `experiments/{id}/judge.lock`.
12. If `judge.lock` exists without `prereg.md`, treat that as broken state.
13. Keep status `OPEN` while you preregister.
14. Do not call `updateHypothesisStatus` here.
15. The gate in `src/gates/prereg.ts` flips `OPEN` to `RUNNING` on the first allowed experiment command.
### 2. Field 1 of 7 — validate the claim
1. A claim is not a slogan.
2. It must name the intervention.
3. It must name the comparator.
4. It must name the metric.
5. It must name the task, benchmark, dataset, or slice.
6. It must name the direction of change.
7. If it depends on a threshold, write the threshold now.
8. Reject claims like "this is better".
9. Reject claims like "more robust" with no metric.
10. Reject claims like "users will love it" with no observable criterion.
11. Reject bundled claims that require multiple experiments to test.
12. Good claims are narrow enough to fail cleanly.
13. Bad claims can only be defended with interpretation.
14. Write the claim so later review can attack it without reading your mind.
15. If the claim cannot become a one-line result statement later, it is still mush.
### 3. Field 2 of 7 — validate the falsifier
1. The falsifier is the condition that kills the claim.
2. If the claim cannot be killed, it is not a research claim.
3. The falsifier must be empirical.
4. The falsifier must be reachable by the planned experiment.
5. The falsifier must not depend on vibes, intent, elegance, or worldview.
6. Reject philosophical non-falsifiers.
7. Reject "if the model does not truly understand".
8. Reject "if users do not spiritually resonate".
9. Reject "if the approach is not elegant enough".
10. Reject "if God does not permit the improvement".
11. Reject "if the benchmark is flawed unless we win".
12. Reject moving-goal clauses like "unless the seed was unlucky".
13. A valid falsifier sounds like a stop condition.
14. Example: "If mean exact-match improvement is less than 2 points across n=30 runs, the claim is falsified."
15. Example: "If pass@1 is not higher than baseline under the locked judge, the claim is falsified."
16. Example: "If cost-normalized win rate does not exceed the baseline by 5%, the claim is falsified."
17. If two hostile reviewers would not agree on the falsifier, it is still weak.
18. Fix this before you write anything else.
### 4. Field 3 of 7 — validate sample size
1. In `src/state/repo.ts`, the registry field is `n`.
2. Do not invent a parallel `sampleSize` field in `HYPOTHESES.md`.
3. `n` must be a positive integer.
4. `n` must match the actual unit of repetition.
5. Say whether `n` means prompts, seeds, tasks, or full runs.
6. If the system is stochastic, `n=1` is usually a confession.
7. Reject "we will run until it looks stable".
8. Reject "we will stop when the chart looks convincing".
9. Reject "start with 3 and decide later" unless that staged plan is preregistered.
10. Match `n` to the falsifier.
11. Match `n` to the budget.
12. Match `n` to the expected runtime.
13. If you cannot afford the declared sample, narrow the claim instead of lying about the design.
14. If you do not know what one unit of repetition means, you are not ready to preregister.
### 5. Field 4 of 7 — validate judge configuration
1. The judge has four required leaves.
2. They are `model`, `prompt`, `temperature`, and `seed`.
3. Missing any one of them means the judge is not locked.
4. "Default temperature" is not a value.
5. "Current prompt" is not a value.
6. "Latest model" is not a value.
7. Pin the exact model identifier.
8. Pin the exact prompt text or an immutable prompt reference.
9. If the prompt lives in a file, record the file path and immutable revision.
10. Record `temperature` as a number.
11. Record `seed` as a number.
12. If the provider ignores seeds, record the requested seed anyway.
13. Build a canonical object from exactly these four fields.
14. Serialize it in stable key order.
15. Compute the SHA-256 of `{model, prompt, temperature, seed}` as the conceptual judge-lock payload.
16. In this repo, turn that frozen payload into `judgeRef`, then use `computeJudgeHash(judgeRef, hypothesisId)` or `writeJudgeLock(cwd, hypothesisId, judgeRef)` from `src/state/repo.ts`.
17. `writeJudgeLock` writes `experiments/{id}/judge.lock`.
18. If `getJudgeLock(cwd, hypothesisId)` already returns a value, recompute and compare.
19. If the hash differs, stop.
20. That is judge drift.
21. Do not overwrite drift casually.
22. If you must break the lock, record the reason in `OVERRIDES.md`.
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
12. Do not use "SOTA" as a baseline name.
13. Do not use memory as a baseline source.
14. If you cannot name the baseline precisely, the claim is not ready.
15. Naming a baseline is not reproducing a baseline.
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
10. Base it on expected calls, tokens, and `n`.
11. Reject "$0", "uncapped", or "we'll see".
12. Reject caps that cannot fund the declared sample.
13. The cap must be tight enough to constrain behavior.
14. Later, actual tool costs get recorded through `appendCostRecord(cwd, record)`.
15. A real cap should feel slightly uncomfortable.
### 8. Field 7 of 7 — validate best-case conclusion
1. The best-case conclusion is the maximum claim you are allowed to make if everything goes right.
2. Write it before results exist.
3. Keep it to one sentence.
4. Keep it smaller than the story in your head.
5. Tie it to the named task, named baseline, and locked judge.
6. Good: "Under the locked judge on GSM8K, prompt A appears better than the reproduced zero-shot baseline."
7. Bad: "We solved reasoning."
8. Bad: "This proves general intelligence."
9. Bad: "Users will love it everywhere."
10. The current `HypothesisEntry` code does not persist `bestCaseConclusion`.
11. Keep this field in `experiments/{id}/prereg.md`.
12. Do not invent ad hoc syntax in `HYPOTHESES.md` unless the state API changes intentionally.
13. If the conclusion ceiling feels restrictive, that is proof it is doing its job.
### 9. Update `HYPOTHESES.md` and write `prereg.md`
1. `HYPOTHESES.md` is the compact registry.
2. Use `loadHypotheses(cwd)` to load existing entries.
3. Modify the active `HypothesisEntry` in memory or create one if none exists.
4. The persisted fields are `id`, `claim`, `falsifier`, `n`, `judgeRef`, `baselineRef`, `costCap`, `status`, and `timestamp`.
5. Preserve valid existing metadata.
6. Keep status `OPEN`.
7. Do not set `RUNNING` here.
8. Do not hand-edit the file into a shape `parseHypotheses` cannot read.
9. Use `hypothesisToMarkdown(entry)` and `saveHypotheses(cwd, entries)`.
10. Keep the richer narrative fields in `experiments/{id}/prereg.md`.
11. Write that file at the exact path `experiments/{id}/prereg.md`.
12. Create `experiments/{id}/` if needed.
13. Include all seven fields.
14. Include the experiment id.
15. Include the current date.
16. Include status `OPEN`.
17. Include the raw judge fields under a dedicated judge section.
18. Include notes that justify the baseline and sample size.
19. Do not include outputs.
20. Do not include smoke numbers.
21. Do not include screenshots.
22. Do not include provisional claims.
23. Use a shape like this:
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
## Judge
- Model: {model}
- Prompt: {prompt}
- Temperature: {temperature}
- Seed: {seed}
```
24. If a field is missing, the prereg is incomplete.
25. If the file reads like a diary, rewrite it until it reads like a contract.
### 10. Commit the prereg before code runs
1. Writing the file is not enough.
2. The prereg must exist in version control before the experiment starts.
3. Stage the registry and experiment artifacts together.
4. The minimum set is `HYPOTHESES.md`, `experiments/{id}/prereg.md`, and `experiments/{id}/judge.lock`.
5. Use a clean prereg commit.
6. Do not batch this with result files.
7. Do not batch this with smoke artifacts.
8. The whole point is temporal ordering.
9. Once the prereg exists, `src/gates/prereg.ts` can allow experiment-shaped `bash` calls.
10. On the first allowed run, that gate calls `updateHypothesisStatus(cwd, id, "RUNNING")`.
11. Let the gate own that transition.
12. Use a commit shaped like this:
```bash
git add HYPOTHESES.md experiments/{id}/prereg.md experiments/{id}/judge.lock
git commit -m "epistemic: prereg {id}"
```
13. After the commit exists, hand off to baseline reproduction.
14. Do not call the adversary yet.
15. Do not write `experiments/{id}/RESULTS.md` yet.
16. Do not quote smoke artifacts from `experiments/{id}/smokes/`.
## Common Rationalizations
| Excuse | Reality |
| --- | --- |
| "I'll write `prereg.md` after one smoke run." | Then the smoke run already contaminated the design. |
| "I only need a quick script." | Quick scripts still generate evidence. |
| "The falsifier is obvious." | If it is not written, it will move. |
| "Temperature defaults to zero anyway." | Defaults drift; pin it. |
| "Seed does not matter for this provider." | Recording it is cheap and auditable. |
| "I know the baseline from memory." | Memory is not a reproduced source. |
| "I'll lock the judge later." | Later means after outputs existed. |
| "We only spent a little before prereg." | Reconcile it honestly or kill the run. |
| "Best-case conclusion feels restrictive." | That is exactly why it matters. |
| "The gate only catches certain commands." | Integrity is not defined by regex loopholes. |
| "I'll commit prereg together with the experiment run." | That destroys ordering and turns prereg into theater. |
| "The baseline is famous enough that we do not need a URL." | Fame is not provenance. |
## Red Flags - STOP
- `getHypothesisSpend(cwd, id)` is already non-zero before prereg exists.
- `getJudgeLock(cwd, id)` exists and does not match the current canonical judge.
- The falsifier mentions philosophy, intent, vibes, elegance, or worldview.
- The claim compares against a baseline you cannot name precisely.
- `getBaselineAgeDays(entry)` says the comparator is older than 30 days.
- The judge prompt points at a mutable scratch file with no immutable revision.
- `n` is "TBD", "until stable", or any other moving target.
- The cost cap cannot fund the declared sample.
- The best-case conclusion is broader than the claim.
- `experiments/{id}/prereg.md` contains outputs, screenshots, or smoke numbers.
- You feel pressure to run "just one command" before the prereg commit exists.
- Multiple `OPEN` or `RUNNING` hypotheses are sharing one result stream.
- You are about to overwrite `judge.lock` because it is inconvenient.
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
- "Smarter" is not a metric.
- "More robust" is not tied to a measurement.
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
## Judge
- Model: gpt-4.1-mini-2026-04-14
- Prompt: prompts/gsm8k-judge-v3.md@9f3e2c1
- Temperature: 0
- Seed: 17
```
Why it is good:
- All seven fields are present.
- The judge is inspectable.
- The baseline target is concrete.
- The conclusion ceiling is explicit.
### Bad `prereg.md`
```md
# Notes for experiment
- Claim: We think this prompt might be better.
- Falsifier: TBD
- N: start with 3
- Baseline: sota
- Cost cap: maybe $100?
```
Why it is bad:
- The judge section is missing.
- The best-case conclusion is missing.
- The falsifier is missing.
- The baseline is fake.
- `N` is still being negotiated.
## Why This Matters
Preregistration protects you from your future self.
Not the cartoon villain version.
The tired, clever, motivated version that can rationalize almost anything after seeing a graph.
A written claim prevents drift.
A hard falsifier prevents rhetoric from replacing evidence.
A declared sample prevents optional stopping.
A locked judge prevents judge-shopping.
A named baseline gives `/skill:baseline-reproduction` a target.
A cost cap prevents ego from burning money.
A best-case conclusion caps what you are allowed to say even on a good day.
A committed `prereg.md` gives `src/gates/prereg.ts` permission to let code run.
If this phase is sloppy, every later phase inherits the slop.
If this phase is tight, later disagreement becomes useful instead of political.
After this, use `/skill:baseline-reproduction`
