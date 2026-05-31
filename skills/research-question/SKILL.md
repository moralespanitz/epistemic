---
name: research-question
description: Use when a research idea is still vague and you must turn it into a testable hypothesis before preregistration or any experiment-shaped work begins.
---

> **Related skills:** `/skill:preregistration`

# Research Question

## Overview

A vague idea is not a hypothesis. It is raw material.

This skill turns a thought like "I wonder if X beats Y" into a draft that can survive contact with `HYPOTHESES.md`, `BASELINES.md`, `experiments/{id}/prereg.md`, and later adversarial review.

Use the same discipline as superpowers brainstorming: one question, one answer, one resolved ambiguity. Do not spray a seven-field intake form at the researcher and pretend the result is clarity. That only produces polished confusion.

By the end of this phase, the idea must be sharp enough to lose, cheap enough to justify, and modest enough not to mutate into marketing. Then write the draft to `HYPOTHESES.md` through the hypothesis command or the canonical file helpers in `src/state/repo.ts`.

## The Iron Law

```text
ASK ONE QUESTION AT A TIME UNTIL THE IDEA CAN FAIL
```

If the question still cannot fail, it is not ready.

If the falsifier is still philosophical, it is not ready.

If the budget still depends on hope, it is not ready.

Do not move to `/skill:preregistration` with an idea that only sounds rigorous because the wording got longer.

## When to Use

- A researcher says, "I wonder if X beats Y," "maybe this is better," or "should we test whether this is more robust?"
- The comparator is unclear.
- The metric is unclear.
- The failure condition is unclear.
- The sample size is still a hand-wave.
- The judge is still "whatever we usually use."
- The baseline is still folklore instead of a reference.
- The cost cap is still imaginary.
- The best-case conclusion is still elastic.
- You need a draft `OPEN` entry in `HYPOTHESES.md` before preregistration.

## When NOT to Use

- `experiments/{id}/prereg.md` already exists and the contract is being locked. Use `/skill:preregistration`.
- You are reproducing a competitor number or paper result. Use `/skill:baseline-reproduction`.
- You are about to run code, evals, training, judging, or benchmarks.
- You already have numbers and are trying to retrofit a cleaner question around them.
- You want to run `runFalsificationAdversary(...)` from `src/adversary/dispatch.ts`. That is later.
- You are deciding whether to kill, recommit, or ship. That is later.
- The repo scaffold is missing and `HYPOTHESES.md` does not exist yet.
- You are tempted to ask all seven fields in one message.

## State Surface

| Surface | API or file | Use at this phase |
| --- | --- | --- |
| Repo sanity check | `loadRepoState(cwd)` | Confirm the epistemic scaffold exists before assuming normal flow |
| Canonical hypothesis registry | `HYPOTHESES.md` | Final output of this stage |
| Read existing hypotheses | `loadHypotheses(cwd)` | Avoid overwriting a live idea |
| Parse raw registry text | `parseHypotheses(content)` | Use only if raw markdown is already loaded |
| Detect live work | `getActiveHypothesis(entries)` | Prevent silent replacement of an `OPEN` or `RUNNING` entry |
| Render one entry | `hypothesisToMarkdown(entry)` | Match repo format if direct writing is required |
| Persist registry | `saveHypotheses(cwd, entries)` | Preferred direct-write path |
| Later state change | `updateHypothesisStatus(cwd, id, status)` | Not used here; the draft stays `OPEN` |
| Baseline metadata | `BASELINES.md`, `loadBaselines(cwd)` | Name the comparator precisely |
| Baseline freshness | `getBaselineAgeDays(entry)` | Detect stale references before you lean on them |
| Prior spend | `getHypothesisSpend(cwd, id)` | Check whether a revived idea already burned budget |
| Repo-wide spend | `getAllHypothesisSpends(cwd)` | Useful when several open ideas compete for money |
| Ledger path | `.epistemic/cost-ledger.jsonl` | Planned here, filled later |
| Later manual cost entry | `appendCostRecord(cwd, record)` | Mentioned so the budget is grounded in real ledger behavior |
| Later judge lock | `computeJudgeHash`, `getJudgeLock`, `writeJudgeLock` | Keep `judgeRef` stable now so locking is possible later |
| Later adversary | `runFalsificationAdversary({ claim, cwd, hypothesisId })` | Do not use it to invent the question |
| Artifact existence | `fileExists(path)` | Check scaffold or related files when state is uncertain |

Current repo reality matters: `src/state/repo.ts` persists `n`, `judgeRef`, `baselineRef`, and `costCap` in the registry. Collect all seven research fields here anyway. If the current hypothesis serializer does not round-trip `bestCaseConclusion`, carry it forward into `experiments/{id}/prereg.md` during the next stage instead of inventing an unsupported registry format.

## The Seven Fields

1. **Claim** — one measurable sentence about an intervention, a comparator, a metric, and a context.
2. **Falsifier** — one empirical sentence answering: *What would disprove this?*
3. **Sample size** — how many observations, seeds, tasks, or runs. In the current registry this persists as `n`.
4. **Judge config** — the exact `model`, `prompt`, `temperature`, and `seed`. In the current registry this compresses into `judgeRef`.
5. **Baseline reference** — the comparator name plus enough source detail to reproduce it later. In the registry this compresses into `baselineRef`.
6. **Cost cap** — the maximum USD the idea is allowed to consume before recommit or kill criteria enter the picture.
7. **Best-case conclusion** — the strongest sentence you will allow yourself to write if the experiment succeeds.

These are research fields, not housekeeping fields.

The housekeeping fields still matter: `id`, `status`, and `timestamp`.

Do not confuse "the registry can store it" with "the hypothesis is scientifically complete." The registry shape is an implementation detail. The seven fields are the research contract.

## Cost Estimation Heuristics

Use planning math, not vibes.

```text
estimated_cost
≈ (input_tokens / 1_000_000) * input_rate
 + (output_tokens / 1_000_000) * output_rate
```

Then multiply by calls per observation, sample size `n`, and a retry buffer.

| Model family | Approx input / 1M | Approx output / 1M |
| --- | --- | --- |
| OpenAI GPT-5.5 | $5.00 | $30.00 |
| OpenAI GPT-5.4 mini | $0.75 | $4.50 |
| Anthropic Claude Sonnet 4.6 | $3.00 | $15.00 |
| Anthropic Claude Haiku 4.5 | $1.00 | $5.00 |
| Gemini 2.5 Pro | $2.00 | $12.00 |
| Gemini 2.5 Flash | $0.25 | $1.50 |

Planning rules:

- If one observation needs generation and judging, budget two paid calls, not one.
- If both the candidate and the baseline will be rerun, budget both sides.
- Add at least 25% buffer for malformed outputs, retries, and basic debugging.
- Add 50% buffer if the protocol depends on long contexts or multi-turn judging.
- If the cap only works when every output is tiny and perfect, the cap is fake.
- If the idea needs a premium model just to explain the question, the question is still too vague.

Use `getHypothesisSpend(cwd, id)` for resumed ideas and `getAllHypothesisSpends(cwd)` when several open ideas are already burning money in the same repo.

## The Process

### 1. Resolve the repository context before asking content questions

1. Start from repo state, not memory.
2. Use `loadRepoState(cwd)` if you need a high-level scaffold check.
3. Use `loadHypotheses(cwd)` to inspect `HYPOTHESES.md`.
4. If raw markdown is already in hand, use `parseHypotheses(content)` instead of improvising a parser.
5. Use `getActiveHypothesis(entries)` to see whether one idea is already `OPEN` or `RUNNING`.
6. If there is a live hypothesis, decide whether the new discussion refines that exact idea or deserves a new `id`.
7. Do not silently overwrite a live record because the new wording sounds better.
8. If the new idea is materially different, it gets a new entry.
9. If the scaffold is missing, fix that first instead of pretending normal flow exists.
10. Only once you know which record you are touching do you start the questioning loop.

### 2. Ask one question at a time, exactly like disciplined brainstorming

1. Ask one question.
2. Wait for one answer.
3. Compress that answer into one resolved field.
4. Ask the next question only after the previous ambiguity is closed.
5. Prefer multiple choice when it reduces drift.
6. Use open questions when the field itself is still undefined.
7. Never request all seven fields in one blast.
8. Giant intake forms create placeholder answers and hidden contradictions.
9. If the answer bundles multiple claims, split them before continuing.
10. If the answer is still mush, ask a narrower question instead of moving on.
11. Progress is not measured by how much text was exchanged. Progress is measured by how much ambiguity died.

### 3. Lock the claim down until it is measurable

1. A claim is not a slogan.
2. Force four concrete parts: intervention, comparator, metric, and context.
3. Ask what exactly is changing.
4. Ask what exactly it is being compared against.
5. Ask which metric decides the winner.
6. Ask where that metric will be measured: benchmark, dataset, task slice, or workload.
7. Ask for directionality: higher, lower, faster, cheaper, more accurate.
8. If a threshold matters, ask for it now.
9. Reject claims like "better," "smarter," "more robust," or "more aligned" when no metric is named.
10. Reject bundled claims that one experiment cannot falsify.
11. Reject claims that rely on an implied comparator.
12. Keep tightening until the claim can later live in one sentence in `RESULTS.md` without extra story-telling.

### 4. Run the falsifiability test hard

1. Ask the question directly: **What would disprove this?**
2. If the answer is not empirical, stop.
3. A valid falsifier must be observable from outputs, scores, logs, or other measurable artifacts.
4. A valid falsifier must be reachable by the experiment being proposed.
5. Reject answers about intent, elegance, vibes, philosophy, or metaphysics.
6. Reject moving-goal falsifiers like "unless the seed was weird" or "unless the judge missed nuance."
7. Force the falsifier into one sentence a hostile reviewer could apply mechanically.
8. Good form: "If metric M does not exceed comparator C by threshold T under condition K across n runs, the claim is falsified."
9. If the falsifier cannot be written that cleanly, the claim is still vague.
10. Fix the claim, then ask again.
11. Unfalsifiable ideas do not get into `HYPOTHESES.md`.

### 5. Choose sample size before any number exists

1. Define what one observation means: prompt, task, seed, batch, or full run.
2. Persist that count as `n` in the current registry shape.
3. Reject `n = TBD`.
4. Reject "until stable."
5. Reject "we'll start small and see."
6. Match `n` to the falsifier.
7. If the falsifier is about mean improvement, `n` must support a mean.
8. If it is about win rate, `n` must support a win rate.
9. If the process is stochastic, `n = 1` is usually theater.
10. If the process is deterministic, ask why repetition is unnecessary.
11. If the declared `n` does not fit the likely budget, narrow the claim instead of pretending the sample is enough.

### 6. Capture the judge, baseline, and budget with enough precision to survive later stages

1. For the judge, require four leaves: `model`, `prompt`, `temperature`, and `seed`.
2. Reject `latest`, `default`, `current prompt`, and other drifting placeholders.
3. Once the leaves are known, compress them into one stable `judgeRef` for the draft hypothesis.
4. For the baseline, require a name, source URL, quoted score when known, version when known, and retrieval date when known.
5. Use `loadBaselines(cwd)` to see whether the comparator already exists in `BASELINES.md`.
6. If it exists, inspect freshness with `getBaselineAgeDays(entry)`.
7. If the baseline is stale, say so immediately instead of hiding the problem for later.
8. For the budget, estimate cost from token math, not optimism.
9. Use the planning rates above.
10. If the idea is a resumed line of work, inspect prior spend with `getHypothesisSpend(cwd, id)`.
11. If multiple ideas are open, inspect `getAllHypothesisSpends(cwd)` so the new cap is grounded in actual repo burn.
12. Reject caps that cannot fund the declared `n`.
13. Reject caps like `$0`, `uncapped`, or `whatever it takes`.

### 7. Set the best-case conclusion before results can seduce you

1. Ask: "If everything goes right, what is the strongest conclusion you would allow yourself to write?"
2. Force one sentence.
3. Keep it benchmark-bound, judge-bound, and baseline-bound.
4. Reject sweeping answers like "this changes everything" or "this proves general reasoning."
5. Prefer modest conclusions such as: "Under the locked judge on benchmark B, method X appears better than the named baseline."
6. Check coherence across all seven fields.
7. The claim and falsifier must talk about the same metric.
8. `n` must be large enough for the falsifier.
9. The budget must actually fund `n`.
10. The best-case conclusion must be narrower than the claim surface, not broader.
11. If any pair conflicts, ask one more question and fix the conflict before writing the draft.

### 8. Write the draft to `HYPOTHESES.md` and stop there

1. Create or confirm the hypothesis `id`.
2. Add housekeeping fields: `status: "OPEN"` and `timestamp: Date.now()`.
3. Preferred exit: use the hypothesis command if the runtime exposes it.
4. Direct-write exit: use `loadHypotheses(cwd)`, update the in-memory entries, and persist with `saveHypotheses(cwd, entries)`.
5. If you must render a single entry yourself, use `hypothesisToMarkdown(entry)` so the file still matches `parseHypotheses(content)`.
6. Persist the current canonical fields: `id`, `claim`, `falsifier`, `n`, `judgeRef`, `baselineRef`, `costCap`, `status`, and `timestamp`.
7. Do not invent a parallel markdown format.
8. If the current serializer cannot store `bestCaseConclusion`, carry it explicitly into the preregistration handoff instead of polluting the registry schema.
9. Do not call `updateHypothesisStatus(...)` here. The draft remains `OPEN`.
10. Do not write `experiments/{id}/prereg.md` yet. That belongs to the next skill.
11. Do not write `experiments/{id}/judge.lock` yet. That also belongs to the next skill.
12. Exit condition: the idea now exists as a draft hypothesis in `HYPOTHESES.md`, and every one of the seven fields is specific enough to survive preregistration.

## Common Rationalizations

| Excuse | Reality |
| --- | --- |
| "I'll just ask for all seven fields at once." | Then you will get seven vague answers at once. |
| "The claim is directionally clear." | Direction is not a metric, comparator, or falsifier. |
| "We can define the falsifier later." | Then the claim will drift to protect itself. |
| "The baseline is obvious." | If it is not named and sourced, it is not obvious. |
| "n depends on how the first runs look." | That is optional stopping in a lab coat. |
| "The judge can stay informal for now." | Informal judges become formal drift later. |
| "The budget is small enough not to matter." | Small unplanned spend is how sloppy work scales. |
| "Best-case conclusion is just PR language." | Exactly. That is why it must be bounded early. |
| "I'll register the idea after a smoke run." | Then the smoke run already contaminated the design. |
| "The parser probably handles extra fields." | Probably is not a storage contract. |
| "This is basically the same as the last hypothesis." | "Basically" is how history gets overwritten. |
| "The gates will catch mistakes later." | Gates do not rescue vague thinking. |

## Red Flags - STOP

- You are about to ask multiple unresolved questions in one message.
- The claim still uses words like `better`, `smarter`, or `more robust` without a metric.
- The falsifier cannot answer "What would disprove this?" in one empirical sentence.
- `n` is still `TBD`, `until stable`, or `whatever fits`.
- The judge config still contains `latest`, `default`, or a mutable scratch prompt.
- The baseline reference is a brand name with no source URL or version.
- `getBaselineAgeDays(entry)` already shows the only local comparator is stale and you are ignoring it.
- The cost cap only works if every call is short, clean, and retry-free.
- The best-case conclusion is broader than the claim.
- `getActiveHypothesis(entries)` points at a different live idea and you are still about to overwrite it.
- You want to write ad hoc extra fields into `HYPOTHESES.md` that `src/state/repo.ts` does not round-trip.
- You feel pressure to run code before the question is fully specified.

## Good vs Bad

### Good: one-question-at-a-time refinement

```text
Q1: What exact baseline are you comparing against?
A1: Our zero-shot prompt on GSM8K.

Q2: What metric decides the winner?
A2: Exact-match accuracy.

Q3: What would disprove the claim?
A3: If the new prompt improves mean exact-match by less than 2 points across 30 runs.

Q4: Which judge will score ambiguous answers?
A4: gpt-5.4-mini, prompts/gsm8k-judge-v3.md@9f3e2c1, temperature 0, seed 17.
```

Why it is good: each answer kills one ambiguity, the falsifier is empirical, and the result is ready to become a real draft hypothesis.

**Bad**

```text
Send me the claim, falsifier, sample size, judge, baseline, budget, and best-case conclusion.
```

Why it is bad: it creates placeholder answers, hides contradictions, and skips the only pressure test that matters.

### Good: claim and falsifier

```md
Claim: Prompt A improves exact-match over the reproduced zero-shot baseline on GSM8K under the named judge.
Falsifier: If mean exact-match improvement is less than 2 points across n=30 runs, the claim is falsified.
```

Why it is good: comparator, metric, threshold, and failure condition all exist.

**Bad**

```md
Claim: Prompt A is smarter and more robust.
Falsifier: If it does not really understand the task.
```

Why it is bad: the metric is missing, the comparator is missing, and the falsifier is philosophical nonsense.

### Good: draft write to `HYPOTHESES.md`

```ts
const entries = await loadHypotheses(cwd);

entries.push({
  id: "prompt-a-vs-zeroshot-gsm8k-2026-05-31",
  claim: "Prompt A improves exact-match over the zero-shot baseline on GSM8K under the named judge.",
  falsifier: "If mean exact-match improvement is less than 2 points across n=30 runs, the claim is falsified.",
  n: 30,
  judgeRef: "model=gpt-5.4-mini,prompt=prompts/gsm8k-judge-v3.md@9f3e2c1,temp=0,seed=17",
  baselineRef: "zeroshot-gsm8k|url=https://example.com|score=71.4|version=2026-05|retrieved=2026-05-31",
  costCap: 18,
  status: "OPEN",
  timestamp: Date.now(),
});

await saveHypotheses(cwd, entries);
```

Why it is good: it uses the real state helpers, matches the current registry shape, and leaves a clean `OPEN` draft for preregistration.

**Bad**

```md
## Hypothesis: big-win
- **Claim:** Prompting is better.
- **Falsifier:** If the vibe is off.
- **N:** We'll see.
- **Judge:** latest
- **Baseline:** SOTA
- **Cost cap:** whatever it takes
- **Best-case conclusion:** This changes everything
```

Why it is bad: every critical field is vague, drifting, or unserious.

## Why This Matters

Most bad research does not begin with fabricated numbers. It begins with a question that never had a clean way to lose.

A sharp research question buys you clean preregistration, real falsifiability, a concrete baseline target, a budget that can constrain behavior, and a bounded conclusion that cannot quietly inflate after success.

This stage is cheap. That is why people skip it.

Skipping it is how they end up spending real money to answer a question they never actually asked.

After this, use `/skill:preregistration`.
