# Ξ epistemic

**A research-discipline coding agent.**

epistemic is a terminal coding agent that makes you do research *properly*.
Instead of running experiments, eyeballing a number, and moving on, it forces a
real method: pre-register a hypothesis, reproduce the baseline, run the
experiment, attack your own claim, and decide to **ship or kill** — with an
interactive monitor of every experiment and gates that enforce the rules.

```bash
epistemic
```

---

## Install

```bash
git clone <this repo> && cd epistemic
npm install
npm link            # makes `epistemic` available everywhere
```

Then run it from any research repo:

```bash
epistemic           # the agent + epistemic discipline
epistemic monitor   # full-screen interactive experiment monitor
```

Set an API key for your model provider (e.g. `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY`) before first run.

---

## What you get

| | |
|---|---|
| **Chat** | A full coding agent — ask anything, it reads/edits files, runs commands, uses tools. |
| **Monitor** | `/monitor` (or `epistemic monitor`) — navigate your experiment tree, drill into any hypothesis, approve / reject / modify. Arrow keys. |
| **Skills** | A guided research pipeline: question → preregister → baseline → run → falsify → ship/kill. |
| **Gates** | Invisible rules that block sloppy moves (unregistered experiments, unreproduced baselines, cost overruns, stale baselines). |

---

## 60-second start

1. Describe an idea in the chat:
   > Help me test whether a LoRA adapter beats few-shot prompting for SQL generation.
2. Let it pre-register the hypothesis (it writes `HYPOTHESES.md`).
3. Open the monitor to see your experiments as a decision tree:
   > /monitor
   `↑↓` select · `→` open detail · `enter` actions · `q` back.
4. Run experiments, then approve (ship) or reject (kill) — from the monitor or the chat.

Full walkthrough with copy-paste prompts: **[GUIDE.md](./GUIDE.md)**.

---

## The research pipeline

```
research-question → preregistration → baseline-reproduction → experiment-execution
→ statistical-rigor → falsification-review → surprise-triage → kill-or-ship
→ verification-before-publication
```

Invoke any step with `/skill:<name>` (e.g. `/skill:research-question`). Each
skill cross-references the next — you don't need to memorize the flow.

---

## The gates (automatic)

| Gate | Blocks |
|------|--------|
| Prereg | running experiments before pre-registration |
| Judge / Environment lock | silently changing the judge or environment mid-run |
| Smoke | quoting provisional numbers as results |
| Claim intercept | comparing to a baseline you haven't reproduced |
| Kill criteria | overrunning 1.5× the cost cap, or going stale |
| Baseline staleness | comparing to a >30-day-old baseline |

Overrides go in `OVERRIDES.md` with a mandatory reason.

---

## Testing

epistemic ships with an agent-driven TUI test suite (it drives the real terminal
UI, sends keys, asserts the screen). See **[TESTING.md](./TESTING.md)**.

```bash
npm run verify              # typecheck + unit/e2e tests
npm run test:agent-tui:ux   # UX/UI checks (needs: npm i -g agent-tui)
npm run test:snapshot       # visual-regression snapshots
```

---

## Files

| Path | What it's for |
|------|---------------|
| `bin/epistemic.mjs` | the `epistemic` command |
| `src/cli/` | launcher + intro animation |
| `src/index.ts` | extension entry: gates, tools, research commands |
| `src/monitor/`, `src/research/` | the interactive monitor + decision-tree rendering |
| `src/gates/` | methodology gates |
| `skills/*/SKILL.md` | the research pipeline manuals |
| `HYPOTHESES.md`, `experiments/`, `.epistemic/` | your research state |
