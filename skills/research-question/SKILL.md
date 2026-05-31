---
name: research-question
description: Use when a research idea, vague comparison, or surprising observation must be turned into a falsifiable, prereg-ready hypothesis before any benchmark, eval, training, or judge-backed work begins.
---

# Research Question

## Overview

A vague idea is not a hypothesis.
A favorite explanation is not research.

This phase exists to stop the oldest failure mode in experimental work: seeing one interesting observation, falling in love with the first story that explains it, and then building the whole experiment around that story.

In this repo, the output of this phase is:
- one `OPEN` draft in `HYPOTHESES.md`
- zero code runs
- zero judge-lock files
- zero prereg files
- a paper trail of the non-chosen explanations in `experiments/{id}/alternatives/`

Current repo reality matters. `src/state/repo.ts` already persists `bestCaseConclusion` and `computeTarget` on `HypothesisEntry`. Use the real shape. Do not invent a smaller checklist because an older note called it "seven fields."

One question at a time. One ambiguity killed at a time. No giant intake form. No favorite theory disguised as inevitability.

## The Iron Law

```text
NO HYPOTHESIS WITHOUT A RIVAL AND A WAY TO LOSE
```

If the observation only has one explanation, you are not done.
If the explanations do not have distinct disconfirming predictions, you are not done.
If the claim still cannot be falsified mechanically, you are not done.
If the compute target is still "we'll figure it out later," the cost and runtime story is still fiction.

Do not move to preregistration with a claim that only sounds disciplined because the wording got longer.

## When to Use

Use this skill when:
- a researcher says "maybe X is better", "I think Y helped", or "should we test whether this is more robust?"
- you have a surprising observation but no clean causal story yet
- the comparator is still implied
- the metric is still vague
- the falsifier is still philosophical
- the baseline is still folklore instead of a named source
- sample size is still hand-wavy
- cost cap depends on hope
- compute target is still unstated
- you need a prereg-ready draft in `HYPOTHESES.md`

## When NOT to Use

Do not use this skill when:
- `experiments/{id}/prereg.md` already exists and the contract is being locked; use `/skill:preregistration`
- you are reproducing an external or published comparator; use `/skill:baseline-reproduction`
- you are about to run code, evals, training, benchmarks, or judge-backed scoring
- you already have numbers and want to retrofit a cleaner question around them
- you are deciding whether to kill, recommit, or ship
- the repo scaffold is missing and `HYPOTHESES.md` does not exist yet
- you are tempted to ask for every field in one message and call that rigor

## Working Surface

| Surface | API or file | Why it matters now |
| --- | --- | --- |
| Repo sanity | `loadRepoState(cwd)` | Confirm the epistemic scaffold exists before assuming normal flow |
| Canonical registry | `HYPOTHESES.md` | Final output of this stage |
| Read live ideas | `loadHypotheses(cwd)` | Avoid overwriting active work |
| Parse registry text | `parseHypotheses(content)` | Use only if raw markdown is already loaded |
| Detect live work | `getActiveHypothesis(entries)` | Decide whether you are refining an existing idea or minting a new `id` |
| Render and persist | `hypothesisToMarkdown(entry)`, `saveHypotheses(cwd, entries)` | Preserve the real repo format, including `bestCaseConclusion` and `computeTarget` |
| Baseline context | `BASELINES.md`, `loadBaselines(cwd)` | Name the comparator precisely instead of vaguely |
| Baseline freshness | `getBaselineAgeDays(entry)` | Detect stale references before you lean on them |
| Prior spend | `getHypothesisSpend(cwd, id)`, `getAllHypothesisSpends(cwd)` | Ground the budget in actual burn instead of vibes |
| Cost ledger | `.epistemic/cost-ledger.jsonl` | Planned here, filled later |
| Alternative archive | `experiments/{id}/alternatives/` | Preserve rejected explanations instead of letting them vanish |
| Later prereg artifact | `experiments/{id}/prereg.md` | Next phase only; do not write it here |

## The Prereg-Ready Checklist

Legacy shorthand called this the "7-field" checklist.
That shorthand is stale.

In this repo, a prereg-ready hypothesis has **eight** required research fields because `bestCaseConclusion` and `computeTarget` are first-class parts of the contract:

1. **`claim`** — one measurable sentence with an intervention, comparator, metric, and context.
2. **`falsifier`** — one empirical sentence answering: *What would disprove this?*
3. **`bestCaseConclusion`** — one-sentence low-expectations framing: the strongest boring conclusion you are allowed to write if the experiment succeeds.
4. **`n`** — the sample size: prompts, seeds, tasks, or runs.
5. **`judgeRef`** — the exact judge configuration you expect to lock later.
6. **`baselineRef`** — the comparator name plus enough provenance to reproduce it later.
7. **`costCap`** — the maximum USD the idea is allowed to consume before a real decision point.
8. **`computeTarget`** — where the experiment will run: `local`, `docker`, or `modal`.

Housekeeping fields still matter: `id`, `status`, and `timestamp`.

Do not confuse "the registry can store it" with "the hypothesis is scientifically complete."
The checklist is the research contract.
The markdown shape is only the transport.

## Competing Hypotheses

This phase comes **before** you settle on one claim.

Start from one observation.
Generate **2-3 competing explanations** for that same observation.
Each explanation must have its own **unique disconfirming prediction**.

If two explanations die under the same killer test, they are not meaningfully separated yet.
Tighten them or delete one.

Use a table like this:

| Explanation | Unique disconfirming prediction | Falsifiability score (1-5) | Cost to test | Prior plausibility (1-5) |
| --- | --- | --- | --- | --- |
| A | What result would kill A specifically? | 1-5 | dollars or low/med/high | 1-5 |
| B | What result would kill B specifically? | 1-5 | dollars or low/med/high | 1-5 |
| C | What result would kill C specifically? | 1-5 | dollars or low/med/high | 1-5 |

Ranking rule:
1. Prefer **higher falsifiability**
2. Then prefer **lower cost to test**
3. Then prefer **higher prior plausibility**

Do **not** let "it feels most likely" outrank "it is easiest to kill."
Research gets cleaner when the chosen explanation is cheap to defeat.

Workflow:
1. The coding agent proposes the 2-3 ranked explanations.
2. The researcher picks one explicit winner.
3. The chosen explanation becomes the `claim` candidate.
4. The non-chosen explanations are written to `experiments/{id}/alternatives/`.
5. Each alternative note records:
   - the observation
   - the alternative explanation
   - its unique disconfirming prediction
   - falsifiability score
   - cost to test
   - prior plausibility
   - why it was not chosen now

Unchosen explanations are not trash.
They are live audit material.
If the chosen claim dies later, that archive is where honest follow-up starts.

## The Process

### 1. Resolve the repository context before asking content questions

1. Start from repo state, not memory.
2. Use `loadRepoState(cwd)` if you need a top-level scaffold check.
3. Use `loadHypotheses(cwd)` to inspect `HYPOTHESES.md`.
4. If raw markdown is already in hand, use `parseHypotheses(content)` instead of improvising a parser.
5. Use `getActiveHypothesis(entries)` to see whether one idea is already `OPEN` or `RUNNING`.
6. Decide whether the current conversation refines that exact idea or deserves a new `id`.
7. If the new idea is materially different, mint a new `id` before you archive alternatives.
8. Do not silently overwrite a live record because the new wording sounds cleaner.
9. If the scaffold is missing, fix that first instead of pretending normal flow exists.
10. Only once you know which record you are touching do you start the questioning loop.

### 2. Ask one question at a time from the observation outward

1. Ask one question.
2. Wait for one answer.
3. Compress that answer into one resolved ambiguity.
4. Ask the next question only after the previous ambiguity is actually closed.
5. Prefer multiple choice when it reduces drift.
6. Use open questions when the field itself is still undefined.
7. Never ask for all eight fields in one blast.
8. Giant intake forms create placeholder answers and hidden contradictions.
9. Start from the observed fact: what changed, where, against what, and how do we know?
10. Do not let the first explanation sneak in as if it were already the claim.
11. If the answer bundles multiple observations, split them before continuing.
12. Progress is not measured by how much text was exchanged. Progress is measured by how much ambiguity died.

### 3. Build competing hypotheses before you bless one story

1. Take the same observation and generate 2-3 plausible explanations for it.
2. Each explanation must explain the same observed fact, not a different fact.
3. Each explanation must come with one unique disconfirming prediction.
4. Write the ranking table explicitly: falsifiability score, cost to test, prior plausibility.
5. Rank the explanations using the rule above: more falsifiable, then cheaper, then more plausible.
6. Present the ranked set to the researcher.
7. The researcher picks one.
8. Record the choice explicitly. Do not silently choose by omission.
9. Write the non-chosen explanations to `experiments/{id}/alternatives/` immediately.
10. If you cannot produce at least two plausible rivals, you do not understand the observation well enough yet.
11. If one explanation only survives because its disconfirming prediction is vague, lower its rank.
12. If an explanation cannot be killed by a practical experiment, it is weak no matter how elegant it sounds.

### 4. Lock the chosen claim down until it is measurable

1. A claim is not a slogan.
2. Force four concrete parts: intervention, comparator, metric, and context.
3. Ask what exactly is changing.
4. Ask what exactly it is being compared against.
5. Ask which metric decides the winner.
6. Ask where that metric will be measured: benchmark, dataset, task slice, or workload.
7. Ask for directionality: higher, lower, faster, cheaper, more accurate.
8. If a threshold matters, ask for it now.
9. Reject words like `better`, `smarter`, `more robust`, or `more aligned` when no metric is named.
10. Reject bundled claims that one experiment cannot falsify.
11. Reject claims that rely on an implied comparator.
12. Keep tightening until the claim can later live in one sentence in `RESULTS.md` without extra storytelling.

### 5. Run the falsifiability test hard

1. Ask the question directly: **What would disprove this?**
2. If the answer is not empirical, stop.
3. A valid falsifier must be observable from outputs, scores, logs, or other measurable artifacts.
4. A valid falsifier must be reachable by the planned experiment.
5. Reject answers about intent, elegance, vibes, philosophy, or metaphysics.
6. Reject moving-goal clauses like "unless the seed was weird" or "unless the judge missed nuance."
7. Force the falsifier into one sentence a hostile reviewer could apply mechanically.
8. Good form: "If metric M does not exceed comparator C by threshold T under condition K across n runs, the claim is falsified."
9. If the falsifier cannot be written that cleanly, the claim is still vague.
10. Fix the claim, then ask again.
11. Unfalsifiable ideas do not get into `HYPOTHESES.md`.

### 6. Choose sample size before any number exists

1. Define what one observation means: prompt, task, seed, batch, or full run.
2. Persist that count as `n`.
3. Reject `n = TBD`.
4. Reject "until stable."
5. Reject "we'll start small and see."
6. Match `n` to the falsifier.
7. If the falsifier is about mean improvement, `n` must support a mean.
8. If it is about win rate, `n` must support a win rate.
9. If the process is stochastic, `n = 1` is usually theater.
10. If the process is deterministic, ask why repetition is unnecessary.
11. If the declared `n` does not fit the likely budget, narrow the claim instead of pretending the sample is enough.

### 7. Capture judge, baseline, compute target, and budget with enough precision to survive preregistration

1. For the judge, require exact leaves: `model`, `prompt`, `temperature`, and `seed`.
2. Reject `latest`, `default`, `current prompt`, and other drifting placeholders.
3. Once those leaves are known, compress them into one stable `judgeRef`.
4. For the baseline, require a name, source URL, quoted score when known, version when known, and retrieval date when known.
5. Use `loadBaselines(cwd)` to see whether the comparator already exists in `BASELINES.md`.
6. If it exists, inspect freshness with `getBaselineAgeDays(entry)`.
7. If the baseline is stale, say so immediately instead of hiding the problem for later.
8. Then ask the compute question exactly:
   **"Where will experiments run? local, Docker, or Modal?"**
9. Record the answer as `computeTarget`.
10. Explain the trade-offs plainly:
    - **`local`** — fastest feedback loop, lowest setup overhead, easiest interactive debugging, highest environment drift risk
    - **`docker`** — slower upfront, better dependency and OS pinning, better handoff and reproducibility, usually the safest default when environment matters
    - **`modal`** — best for remote parallelism or heavier managed compute, but adds orchestration, secrets, cold starts, and extra spend; not a free default
11. Reject "we'll start local and decide later" unless that environment switch is part of the registered design.
12. Estimate cost from token math and compute reality, not optimism.
13. If the compute target is `modal`, include infra overhead and retries in the budget.
14. If the compute target is `docker`, include image build and environment prep costs when they are real.
15. If the compute target is `local`, make sure the hardware and ambient environment assumptions are actually credible.
16. Use `getHypothesisSpend(cwd, id)` for resumed ideas and `getAllHypothesisSpends(cwd)` when several open ideas are already burning money.
17. Reject caps that cannot fund the declared `n` under the chosen compute target.
18. Reject caps like `$0`, `uncapped`, or `whatever it takes`.

### 8. Set `bestCaseConclusion` before results can seduce you

1. Ask: "If everything goes right, what is the strongest conclusion you would allow yourself to write?"
2. Force one sentence.
3. Keep it benchmark-bound, judge-bound, baseline-bound, and smaller than the story in anyone's head.
4. This is low-expectations framing, not a victory speech.
5. Reject sweeping answers like "this changes everything" or "this proves general reasoning."
6. Prefer modest conclusions such as: "Under the locked judge on benchmark B, method X appears better than the named baseline."
7. Check coherence across all eight research fields.
8. The claim and falsifier must talk about the same metric.
9. `n` must be large enough for the falsifier.
10. The budget must actually fund `n` under the chosen compute target.
11. `bestCaseConclusion` must be narrower than the claim surface, not broader.
12. If any pair conflicts, ask one more question and fix the conflict before writing the draft.

### 9. Write the draft to `HYPOTHESES.md` and stop there

1. Create or confirm the hypothesis `id`.
2. Add housekeeping fields: `status: "OPEN"` and `timestamp: Date.now()`.
3. Load entries with `loadHypotheses(cwd)`.
4. Update the target entry in memory or append a new one.
5. Persist the real repo fields: `id`, `claim`, `falsifier`, `bestCaseConclusion`, `n`, `judgeRef`, `baselineRef`, `costCap`, `computeTarget`, `status`, and `timestamp`.
6. Use `saveHypotheses(cwd, entries)` so the file stays parseable by `parseHypotheses(content)`.
7. Write every non-chosen explanation to `experiments/{id}/alternatives/`.
8. Do not invent a parallel markdown format.
9. Do not write `experiments/{id}/prereg.md` yet.
10. Do not write `experiments/{id}/judge.lock` yet.
11. Do not run code yet.
12. Exit condition: the idea now exists as an `OPEN` draft in `HYPOTHESES.md`, the rival explanations are archived, and every research field is specific enough to survive preregistration.

## Common Rationalizations

| Excuse | Reality |
| --- | --- |
| "The first explanation is probably the right one." | Probably is exactly why you generate rivals first. |
| "We already know what caused the observation." | Then it should survive distinct competing explanations and distinct killer predictions. |
| "Two alternatives can share the same disconfirming test." | Then they are not separated explanations yet. Tighten or delete one. |
| "I'll just ask for all the fields at once." | Then you will get polished vagueness all at once. |
| "The claim is directionally clear." | Direction is not a metric, comparator, or falsifier. |
| "We can define the falsifier later." | Then the claim will drift to protect itself. |
| "The alternatives don't need to be saved." | Unwritten rejected explanations come back later as convenient excuses. |
| "The baseline is obvious." | If it is not named and sourced, it is folklore. |
| "`n` depends on how the first runs look." | That is optional stopping in a lab coat. |
| "`bestCaseConclusion` is just wording." | It is the ceiling that prevents post-hoc marketing. |
| "`computeTarget` is implied." | Hidden infrastructure assumptions are still assumptions. Record them. |
| "We'll decide local vs Docker vs Modal after a smoke run." | Environment choice changes cost, runtime, and reproducibility. Decide before evidence exists. |
| "Docker is overkill for a small experiment." | If reproducibility matters, the overhead is the point. |
| "Modal is just more cores." | Remote infrastructure changes billing, secrets, startup, and failure modes. |
| "The registry can stay compact; we'll remember the rest." | If it is not in the record, it will drift. |
| "The gates will catch mistakes later." | Gates do not rescue vague thinking. |

## Red Flags - STOP

- You only have one favored explanation for the observation.
- Two competing explanations share the same disconfirming prediction.
- You are about to ask multiple unresolved questions in one message.
- The claim still uses words like `better`, `smarter`, or `more robust` without a metric.
- The falsifier cannot answer "What would disprove this?" in one empirical sentence.
- `n` is still `TBD`, `until stable`, or `whatever fits`.
- The judge config still contains `latest`, `default`, or a mutable scratch prompt.
- The baseline reference is a brand name with no source URL or version.
- `getBaselineAgeDays(entry)` shows the only local comparator is stale and you are ignoring it.
- `computeTarget` is blank, implied, or `later`.
- The budget only works on `local` but the planned run is actually `modal`.
- The non-chosen explanations exist only in chat and not in `experiments/{id}/alternatives/`.
- `bestCaseConclusion` is broader than the claim.
- `getActiveHypothesis(entries)` points at a different live idea and you are still about to overwrite it.
- You feel pressure to run code before the rivals are separated and archived.

## Good vs Bad

### Good: competing hypotheses from one observation

```md
Observation:
Prompt B beat Prompt A on GSM8K in three pilot traces.

| Explanation | Unique disconfirming prediction | Falsifiability | Cost | Prior |
| --- | --- | --- | --- | --- |
| Reasoning scaffold helps multi-step arithmetic | Gain persists under exact-match and concentrates on multi-step items | 5/5 | $0.60 | 4/5 |
| Judge prefers verbose answers | Gain disappears under exact-match or a terse-answer rubric | 5/5 | $0.40 | 3/5 |
| Prompt B leaks answer templates | Gain disappears when demonstrations are length-matched but content-swapped | 4/5 | $0.80 | 2/5 |
```

Why it is good:
- one observation generated multiple live explanations
- each explanation has a distinct killer prediction
- the ranking is explicit
- the researcher can choose one without pretending the others never existed

**Bad**

```md
Observation:
Prompt B looks smarter.

Explanation 1:
Prompt B is better.

Explanation 2:
Maybe the judge liked it.

Explanation 3:
Maybe randomness.
```

Why it is bad:
- the observation is already a conclusion
- none of the explanations is precise
- none has a unique disconfirming prediction
- there is no ranking and nothing to archive honestly

### Good: compute target question

```text
Q: Where will experiments run? local, Docker, or Modal?
A: Docker. The run is CPU-only, dependency-sensitive, and another researcher must be able to rerun it unchanged.
```

Why it is good:
- the question is explicit
- the answer is tied to actual constraints
- `computeTarget` now has real methodological meaning

**Bad**

```text
We'll start local and move it wherever if the numbers look good.
```

Why it is bad:
- the environment can now drift after peeking
- budget and runtime assumptions are fake
- `wherever` is not a registered compute target

### Good: draft write to `HYPOTHESES.md`

```ts
const entries = await loadHypotheses(cwd);

entries.push({
  id: "prompt-b-vs-prompt-a-gsm8k-2026-05-31",
  claim: "Prompt B improves exact-match over Prompt A on GSM8K under the named judge.",
  falsifier: "If mean exact-match improvement is less than 2 points across n=30 runs, the claim is falsified.",
  bestCaseConclusion: "Under the locked judge on GSM8K, Prompt B may outperform Prompt A by a modest margin.",
  n: 30,
  judgeRef: "model=gpt-5.4-mini,prompt=prompts/gsm8k-judge-v3.md@9f3e2c1,temp=0,seed=17",
  baselineRef: "prompt-a|url=https://example.com/prompts/a|version=2026-05-31|retrieved=2026-05-31",
  costCap: 18,
  computeTarget: "docker",
  status: "OPEN",
  timestamp: Date.now(),
});

await saveHypotheses(cwd, entries);
```

Why it is good:
- it uses the real state helpers
- it persists the actual repo fields
- it includes `bestCaseConclusion` and `computeTarget`
- it leaves a clean `OPEN` draft for preregistration

**Bad**

```md
## Hypothesis: big-win
- **Claim:** Prompting is better
- **Falsifier:** If the vibe is off
- **N:** We'll see
- **Judge:** latest
- **Baseline:** SOTA
- **Cost cap:** whatever it takes
- **Compute target:** later
- **Best-case conclusion:** This changes everything
```

Why it is bad:
- every critical field is vague, drifting, or unserious
- there are no rival explanations
- the environment is undecided
- the conclusion ceiling is marketing, not science

### Good: archive the losers

```md
# Alternative 02: judge-format-bias

- Observation: Prompt B beat Prompt A on GSM8K in three pilot traces.
- Explanation: The judge prefers verbose step-by-step answers rather than better arithmetic.
- Unique disconfirming prediction: The win disappears under exact-match or a terse-answer rubric.
- Falsifiability score: 5/5
- Cost to test: $0.40
- Prior plausibility: 3/5
- Not chosen now because: The researcher selected the reasoning-scaffold explanation as the primary claim.
```

Why it is good:
- the rejected explanation is preserved
- the disconfirming prediction stays attached to it
- later review can see what was rejected and why

**Bad**

```text
We considered some other ideas but they were weaker.
```

Why it is bad:
- nothing is auditable
- weaker by what standard is unknown
- the discarded explanations can now be reinvented whenever convenient

## Why This Matters

Most bad research does not begin with fabricated numbers.
It begins when the first plausible story becomes the only story, and nobody records what else could have explained the same observation.

Competing hypotheses make the question honest.
`bestCaseConclusion` keeps the future writeup small enough to deserve trust.
`computeTarget` stops environment drift from masquerading as methodological detail.

This stage is cheap.
That is why people try to skip it.

After the draft exists in `HYPOTHESES.md`, the non-chosen explanations are written to `experiments/{id}/alternatives/`, and the prereg-ready fields are explicit, use `/skill:preregistration`.
