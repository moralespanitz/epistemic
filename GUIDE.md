# Ξ epistemic — User Guide

A practical, prompt-driven guide. The README explains *what* epistemic is; this
shows you *how to use it*, with copy-paste prompts and concrete use cases.

epistemic is **pi.dev's real coding agent + a research-discipline extension.**
The chat is the full pi agent (model picker, markdown, tools, MCP, memory). On
top, epistemic adds methodology gates and an interactive **monitor** of your
experiments.

---

## Keys & auth

epistemic uses a few kinds of credentials. Two ways to provide them:

1. **Agent model** (the chat) — run **`/login`** inside epistemic (stored in
   `~/.pi/agent/auth.json`, persists across sessions). Default model is
   `openrouter/deepseek/deepseek-v4-pro`, so log into **OpenRouter** (or set
   `OPENROUTER_API_KEY`). `/login` to Anthropic too if you want Claude on demand.

2. **Experiment & gate keys** — copy `.env.example` → **`.env`** (gitignored,
   auto-loaded on start) and fill in what you use:

| Key | Used for |
|-----|----------|
| `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` | the agent model (or use `/login`) |
| `OPENAI_API_KEY`, `GOOGLE_API_KEY` | falsification-review adversaries (needs ≥2 providers) |
| `HF_TOKEN` | HuggingFace baselines / gated datasets |
| **Modal** | compute target `modal`: run `modal setup` once, or set `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` |

```bash
cp .env.example .env   # then edit
```

## Start

```bash
cd your-research-repo      # has (or will have) HYPOTHESES.md, experiments/
epistemic                  # branded intro → the real pi chat + epistemic
```

Everything in pi works as normal: `/model` to switch models, `/help`, `!` for
bash, `$` for python, file references, etc. epistemic just adds to it.

---

## The 60-second loop

1. **Describe an idea** (plain chat):
   > I think fine-tuning a LoRA adapter beats few-shot prompting for our SQL-generation task. Help me turn this into a testable hypothesis.

2. **Let it pre-register** — the agent walks you through claim, falsifier,
   baseline, cost cap, compute target, and writes `HYPOTHESES.md`.

3. **Open the monitor** to see your experiment tree:
   > /monitor

   `↑↓` select · `→` open detail · `enter` actions · `q` back to chat.

4. **Run / decide** — execute experiments, then approve (ship) or reject (kill)
   from the monitor or in chat.

---

## Use cases & prompts

### 1. Turn a vague idea into a hypothesis
> /skill:research-question

or just:
> Help me design a rigorous experiment to test whether retrieval-augmented
> prompting beats fine-tuning for rare-API code generation.

The agent asks one question at a time and generates 2–3 competing hypotheses
before you commit to one.

### 2. Pre-register (lock it before running)
> /skill:preregistration

Locks the claim, judge config (hash), and environment. After this, the **prereg
gate** blocks experiments that aren't registered.

### 3. Reproduce the baseline you're claiming to beat
> /skill:baseline-reproduction
>
> The baseline is "base CodeLlama-7B" — reproduce its score under our judge before we compare.

### 4. Run the experiment
> /skill:experiment-execution
>
> Run all 30 trials for H-004 on Modal and log costs.

Watch it live in the monitor (`/monitor`, switch to the experiments column).

### 5. Check it survives attack
> /skill:falsification-review
>
> Send H-004's claim to the adversary models and give me the cheapest disconfirming experiment.

### 6. Decide: ship or kill
> /skill:kill-or-ship

or from the monitor: select the hypothesis → `enter` → **approve (ship)** or
**reject (kill)**. The action is prefilled into the chat for you to send.

### 7. Inspect everything spatially
> /monitor      # interactive: tree of experiments + per-experiment detail
> /map          # just the decision tree, as a quick glance below the editor
> /view         # cycle compact views (off → monitor → tree → cost)

---

## The monitor (interactive)

`/monitor` takes over the screen with a full, scrollable view (it returns to
chat when you press `q`):

```
Ξ epistemic · mission control   [████░░ 16%] $34/$210   2 running · 1 shipped · 1 killed

● ✓ H-001  LoRA fine-tuning…
├─▶ ▶ H-004  Scaling LoRA to 7B…
│   ◇ if acc ≥ 0.80 → ship / H-006 pivot
└─▶ ☓ H-002  High learning rate…

experiments
  ▸▶ H-004   18/30  $12  acc ▃▄▅▆█
```

| Key | Action |
|-----|--------|
| `↑` / `↓` | select an experiment |
| `→` | open its detail (claim, falsifier, cost, decision plan) |
| `←` | back to the tree |
| `enter` | action menu: chat / approve (ship) / reject (kill) / modify |
| `q` / `esc` | back to the chat |

A standalone full-screen version (for a second pane) is also available:
```bash
epistemic monitor
```

---

## Authoring the experiment tree

The tree in `/monitor` and `/map` is built from `HYPOTHESES.md`. Add optional
fields under any `## Hypothesis: <id>` heading:

```markdown
## Hypothesis: H-004
- **Status:** RUNNING
- **Claim:** Scaling LoRA to 7B doubles the gain
- **Parent:** H-001
- **Decision:** acc ≥ 0.80 → ship | else → H-006 pivot
- **Cost cap:** 80
- **Compute target:** modal
```

- `Parent` nests it under another hypothesis (omit → it's a new root tree).
- `Decision` renders a fork: `◇ if … → yes / no`.
- Folders under `experiments/<id>/alternatives/` show as `↳ alt:` branches.

---

## The gates (they protect you automatically)

You don't invoke these — they fire when a rule would be broken:

| Gate | Stops you from… |
|------|-----------------|
| Prereg | running experiments before pre-registering |
| Judge / Environment lock | silently changing the judge or environment mid-run |
| Smoke | quoting provisional numbers in headline files |
| Claim intercept | comparing to a baseline you haven't reproduced |
| Kill criteria | overrunning 1.5× the cost cap or going stale |
| Baseline staleness | comparing to a >30-day-old baseline |

Override (with a reason) is recorded in `OVERRIDES.md`.

---

## Tips

- The chat is the full pi agent — use `/model` to pick a cheaper model for
  routine steps and a stronger one for falsification review.
- Keep `HYPOTHESES.md` tidy with `Parent` / `Decision` fields — the monitor
  visualizes them as a real decision tree.
- Expected kill-to-ship ratio is ~5:1. Killing fast is the point.
