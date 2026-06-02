# Ξ epistemic

**A research-discipline coding agent.**

epistemic turns a terminal coding agent into a rigorous research assistant.
Instead of running experiments, eyeballing a number, and moving on, it forces a
real method: **pre-register a hypothesis, reproduce the baseline, run the
experiment, attack your own claim, and decide to ship or kill** — with an
interactive monitor of every experiment and gates that enforce the rules.

Inspired by the norms of good ML research and the *superpowers* skill format:
the **skills** are the manual the agent follows step by step; the **gates** are
the safety net that enforces it.

```bash
epistemic
```

---

## Install

```bash
git clone git@github.com:moralespanitz/epistemic.git && cd epistemic
npm install
npm link            # makes `epistemic` available everywhere
```

Set a model API key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or
`OPENROUTER_API_KEY`), then run it from any research repo:

```bash
epistemic           # the agent + epistemic discipline
epistemic monitor   # full-screen interactive experiment monitor
```

### …or just the skills, in Claude Code

The same research-discipline skills are published as a Claude Code plugin —
an **add-on**, like [superpowers](https://github.com/obra/superpowers), not a
replacement. You get the methodology (`research-question`, `preregistration`,
`baseline-reproduction`, … `kill-or-ship`) inside Claude Code without running
the pi agent:

```
/plugin marketplace add moralespanitz/epistemic
/plugin install epistemic-skills@epistemic
```

Then Claude Code surfaces the skills automatically (or invoke one explicitly,
e.g. *"use the preregistration skill"*). Note: the hard **gate enforcement**
(blocking experiments before prereg, judge-lock, cost ledger) lives in the pi
agent above — in Claude Code the skills are methodology guidance.

---

## How it works

| Layer | What it does |
|-------|-------------|
| **Skills** | Detailed manuals the agent follows step by step — the primary UX. |
| **Gates** | Invisible enforcement that blocks rule violations automatically. |
| **Monitor** | `/monitor` — navigate the experiment tree, drill into a hypothesis, approve / reject / modify. Arrow keys. |
| **State** | File-based ledger: `HYPOTHESES.md`, `.epistemic/cost-ledger.jsonl`, `experiments/{id}/`. |
| **Tools** | HuggingFace dataset metadata, paper search, cross-run lessons. |

If the skills are well written, the gates never fire — the agent follows the
manual. The gates are the safety net.

---

## The pipeline

```
research-question
    ↓
preregistration
    ↓
baseline-reproduction
    ↓
experiment-execution
    ↓
statistical-rigor
    ↓
falsification-review
    ↓
surprise-triage (if needed)
    ↓
kill-or-ship
    ↓
verification-before-publication
```

### 1. `/skill:research-question` — idea → testable hypothesis

The agent asks one question at a time, Socratic-style, until the claim is
falsifiable, the falsifier is concrete, and the budget is realistic. **Before
settling on one hypothesis**, it generates 2–3 competing explanations, each with
a unique disconfirming prediction; you pick one, the others are archived in
`experiments/{id}/alternatives/`.

| Field | What it is |
|-------|------------|
| Claim | "X outperforms Y by Z on benchmark W" |
| Falsifier | "If we see A under conditions B, the claim is wrong" |
| Best-case conclusion | What success actually looks like (low expectations prevent over-investment) |
| Sample size (n) | Number of runs (default 30) |
| Judge config | Model, prompt, temperature, seed |
| Baseline reference | Competitor name + source + score + version + date |
| Cost cap | USD budget (default $50) |
| Compute target | Where experiments run: `local`, `docker`, or `modal` |

If the falsifier isn't empirically testable, the agent rejects it and asks you to reframe.

### 2. `/skill:preregistration` — lock it before running

Validates all fields, then creates `experiments/{id}/prereg.md`, hashes the
judge config → `judge.lock`, generates the execution scaffold for the compute
target (Dockerfile / modal-app.py / environment.lock), and commits it. After
this, the **prereg gate** blocks unregistered experiments and the **judge/env
locks** block drift.

### 3. `/skill:baseline-reproduction` — you can't beat what you can't run

Finds and reads the competitor's paper, validates any HuggingFace datasets,
reproduces the result under *your locked judge*, and records the exact score,
pinned revision, version, date, and command. Baselines older than 30 days must
be refreshed; if you can't reproduce a number, the discrepancy is documented and
your claim becomes relative to what you *can* reproduce.

### 4. `/skill:experiment-execution` — run with discipline

Confirms `prereg.md` + locks match, routes execution by compute target, logs
every API/compute cost to `.epistemic/cost-ledger.jsonl`, runs the full sample
size, and writes results to `experiments/{id}/smokes/` — **provisional only**. No
mid-run methodology changes.

### 5. `/skill:statistical-rigor` — no number leaves smokes/ unjustified

Assumption checking (normality, variance, independence, ceiling/floor) → test
selection → effect sizes (Cohen's d, η², R²) alongside p-values → multiple-
comparison correction → APA reporting with exact p-values.

### 6. `/skill:falsification-review` — guilty until proven defensible

The claim is dispatched to ≥2 adversary models, each returning the cheapest
experiment that would disprove it.

| Result | What happens |
|--------|-------------|
| All defensible | Promoted from `smokes/` to `RESULTS.md` |
| Any falsified | **Blocked** — the claim can't ship |
| Mixed | Allowed with a caveat tag |

If the cheapest disconfirming experiment is <$1 and unrun, the agent insists on running it first.

### 7. `/skill:surprise-triage` — when results diverge >15%, stop

Produces ranked explanations (sampling, judge mismatch, data leakage, ceiling
effects, prompt drift, version change, bugs) and the cheapest disambiguating
test for each. Surprising numbers are blocked from `RESULTS.md` until triage completes.

### 8. `/skill:kill-or-ship` — decide

| Option | When | Effect |
|--------|------|--------|
| **KILL** | Spend > 1.5× cap, or >21 days stale | Write `KILLED.md`, record a lesson |
| **PIVOT** | Failed but suggests a new direction | Kill old, open a new hypothesis |
| **REFINE** | Same claim, adjusted method | Re-run from execution (needs override) |
| **RECOMMIT** | Continue past kill criteria | New cap + override |
| **SHIP** | All gates pass, falsification clean | Tag and publish |

Sunk-cost rule: killed hypotheses can't be silently revived. Expected
kill-to-ship ratio is ~5:1 — killing fast is the point.

### 9. `/skill:verification-before-publication` — evidence before claims

A full checklist before any claim of completion: locks present and matching,
baselines fresh and reproduced, falsifier verdicts evaluated, cost ledger
current, stats done, alternatives documented, and `RESULTS.md` containing only
confirmed, falsification-passed results.

---

## The monitor

`/monitor` (or `epistemic monitor`) opens a full-screen interactive view — your
research program as a decision tree, with live experiment status:

```
Ξ epistemic · mission control   [████░░ 16%] $34/$210   2 running · 1 shipped · 1 killed

● ✓ H-001  LoRA fine-tuning…
├─▶ ▶ H-004  Scaling LoRA to 7B…
│   ◇ if acc ≥ 0.80 → ship / H-006 pivot
└─▶ ☓ H-002  High learning rate…
```

| Key | Action |
|-----|--------|
| `↑` / `↓` | select an experiment |
| `→` / `←` | open detail / back to tree |
| `enter` | actions: chat / approve (ship) / reject (kill) / modify |
| `q` | back to the chat |

Author the tree with optional `- **Parent:** <id>` and
`- **Decision:** <cond> → <ifTrue> | else → <ifFalse>` fields in `HYPOTHESES.md`.

---

## The gates (automatic)

| Gate | Blocks |
|------|--------|
| Prereg | running experiments before pre-registration |
| Judge / Environment lock | changing the judge or environment mid-run |
| Smoke | quoting provisional numbers as results |
| Cost ledger | (transparent — logs every call with cost + category) |
| Claim intercept | comparing to an unreproduced baseline |
| Kill criteria | overrunning 1.5× the cost cap, or going stale |
| Baseline staleness | comparing to a >30-day-old baseline |

Overrides go in `OVERRIDES.md` with a mandatory reason.

---

## More

- **[GUIDE.md](./GUIDE.md)** — prompt-driven walkthrough and use cases
- **[TESTING.md](./TESTING.md)** — the agent-driven TUI test suite (`npm run verify`)
