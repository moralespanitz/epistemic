# Ξ epistemic

**A research-discipline coding agent.**

epistemic turns a terminal coding agent into a rigorous research assistant.
Instead of running experiments, eyeballing a number, and moving on, it forces a
real method: **pre-register a hypothesis, reproduce the baseline, run the
experiment, attack your own claim, and decide to ship or kill** — with an
interactive monitor of every experiment and gates that enforce the rules.

Inspired by the norms of good ML research and the *superpowers* skill format:
the **skills** are the portable manual the agent follows step by step; the
**harnesses** inject that manual into Claude Code, Codex, or OMP; and the
**gates** are the safety net that enforces it where the harness supports runtime
hooks.

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

Authenticate the Hugging Face CLI to unlock gated models and datasets:

```bash
hf auth login       # paste a token from huggingface.co/settings/tokens
```

Run from any research repo:

```bash
epistemic           # 3D intro → research agent (defaults to OpenAI Codex)
epistemic monitor   # full-screen interactive experiment monitor
epistemic fleet     # parallel agent fleet runner
```

---

## What's inside

### 3D intro + persistent header

On launch, epistemic plays a real-time 3D animation of the Ξ mark — a
software rasterizer (donut.c technique) with per-cell Z-buffer, Lambert +
ambient shading, and a depth-modulated amber glow — then transitions to the
main TUI where the Ξ mark persists as a live 3D header at the top of every
session, showing the active model and quick-reference tips.

The renderer lives in `src/tui/render3d.ts` and is shared between the startup
animation (`src/cli/intro.ts`) and the persistent header extension
(`.pi/extensions/welcome-header/`).

### Default model: OpenAI Codex

epistemic defaults to `openai-codex/gpt-5.5` when you have a ChatGPT Plus/Pro
subscription (OAuth via `/login`). Fallback priority: Codex → OpenRouter →
OpenAI → Anthropic.

### Hugging Face research stack

Six HF skills are bundled in `skills/` and auto-discovered at startup. Load any
with `/skill:<name>` or by describing the task:

| Skill | What it unlocks |
|---|---|
| `huggingface-papers` | Read any arXiv paper as markdown; structured metadata (authors, linked models, citations) |
| `hf-cli` | Download/upload models & datasets, manage repos, run HF Jobs |
| `huggingface-datasets` | Paginate rows, full-text search, filter predicates, get Parquet URLs |
| `huggingface-community-evals` | Run evals locally with `inspect-ai` or `lighteval` |
| `huggingface-trackio` | Log metrics + alerts during training, sync real-time dashboard to HF Space |
| `huggingface-llm-trainer` | Fine-tune with TRL (SFT/DPO/GRPO) on HF Jobs cloud GPUs |

The session-start hook announces auth status and available skills at the top of
every research session, so the agent knows what tools exist without being told.

---

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

The Claude harness includes a Superpowers-style bootstrap skill,
**`using-epistemic`**. In research repos it is injected at `SessionStart` and
tells Claude to load the umbrella **`epistemic`** skill before empirical work,
then the correct stage skill.

Local install without the marketplace (symlink, stays in sync with this repo):

```bash
for s in using-epistemic epistemic research-question preregistration baseline-reproduction \
  experiment-execution statistical-rigor falsification-review surprise-triage \
  kill-or-ship verification-before-publication; do
  ln -sfn "$PWD/skills/$s" "$HOME/.claude/skills/$s"
done
```

**Superpowers-style enforcement (hooks).** The Claude plugin ships hooks that
make the discipline active, not just available:
- **SessionStart** — in a research repo (has `HYPOTHESES.md` / `experiments/`),
  injects the full `using-epistemic` bootstrap so every session routes through
  the mechanism (silent elsewhere).
- **PreToolUse (Bash)** — a *prereg gate*: if an experiment-shaped command runs
  with no `experiments/<id>/prereg.md`, it interrupts and asks you to
  pre-register first (flip `ASK→"deny"` in `hooks/prereg-gate.mjs` to hard-block).

Installed via the marketplace automatically, or locally by adding `hooks/*.mjs`
to `~/.claude/settings.json` (`SessionStart` + `PreToolUse` matcher `Bash`).

Manage them with `epistemic hooks`:

```bash
epistemic hooks status          # what's installed / enabled
epistemic hooks on | off        # enable/disable instantly (no restart)
epistemic hooks install|remove  # add/remove the epistemic hooks in settings.json
epistemic hooks clean           # remove unused hooks + prune empties
```

Activate/deactivate the skills anytime with `epistemic skills`:

```bash
epistemic skills status   # which epistemic skills are active in Claude Code
epistemic skills on       # activate (symlink all into ~/.claude/skills)
epistemic skills off      # deactivate (removes only our symlinks)
```

### Codex plugin metadata

The portable skill core is also packaged for Codex via `.codex-plugin/plugin.json`.
Codex gets the same `skills/` library and should use `using-epistemic` as the
bootstrap contract. Runtime gates and dashboards remain harness-specific.

---

### Repo layout

| Path | What it is |
|------|-----------|
| `packages/omp/` | `@epistemic/omp` — forked oh-my-pi TUI shell (Amber Lab theme, ResearchSidebar) |
| `src/` | Extension wired into omp: gates, commands, monitor, board |
| `src/tui/render3d.ts` | Shared software 3D renderer (Z-buffer, Lambert shading, amber glow) |
| `src/cli/intro.ts` | Startup animation (3D spin → name reveal) |
| `skills/` | Research methodology skills + 6 HF skills |
| `hooks/` | Claude Code hooks (SessionStart, prereg gate) |
| `.pi/extensions/welcome-header/` | Persistent 3D Ξ header in the TUI |
| `.pi/settings.json` | Project settings (Codex default, theme, extensions) |
| `.claude-plugin/` | Claude Code plugin manifest and marketplace metadata |
| `.codex-plugin/` | Codex plugin manifest for the portable skill core |
| `themes/epistemic.json` | Amber-on-transparent dark theme |
| `tests/claude-code/` | Headless Claude Code harness tests for skill triggering |

---

## How it works

| Layer | What it does |
|-------|-------------|
| **Portable skill core** | `using-epistemic`, `epistemic`, and stage skills. This is the shared method across harnesses. |
| **Harness bootstrap** | Claude `SessionStart`, Codex manifest, and future adapters load the skill core at the right time. |
| **Runtime gates** | Invisible enforcement that blocks rule violations automatically where the harness supports hooks. |
| **Monitor** | `/monitor` — navigate the experiment tree, drill into a hypothesis, approve / reject / modify. Arrow keys. |
| **Fleet** | `/fleet` — parallel agent fleet runner for multi-experiment orchestration. |
| **HF stack** | 6 HF skills (papers, datasets, evals, training, tracking, CLI) bundled and auto-discovered. |
| **State** | File-based ledger: `HYPOTHESES.md`, `.epistemic/cost-ledger.jsonl`, `experiments/{id}/`. |

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

Socratic-style questioning until the claim is falsifiable, the falsifier is
concrete, and the budget is realistic. Generates 2–3 competing explanations
before settling; alternatives archived in `experiments/{id}/alternatives/`.

### 2. `/skill:preregistration` — lock it before running

Validates all fields, creates `experiments/{id}/prereg.md`, hashes the judge
config → `judge.lock`, generates the execution scaffold, commits it. After
this, the **prereg gate** blocks unregistered experiments.

### 3. `/skill:baseline-reproduction` — you can't beat what you can't run

Reads the competitor's paper (use `huggingface-papers` to fetch it), validates
any HF datasets, reproduces the result under your locked judge, records the
exact score, pinned revision, version, date, and command.

### 4. `/skill:experiment-execution` — run with discipline

Confirms `prereg.md` + locks match, routes execution by compute target, logs
every cost to `.epistemic/cost-ledger.jsonl`, writes provisional results.

### 5. `/skill:statistical-rigor` — no number leaves smokes/ unjustified

Assumption checking → test selection → effect sizes + p-values →
multiple-comparison correction → APA reporting.

### 6. `/skill:falsification-review` — guilty until proven defensible

Dispatches the claim to ≥2 adversary models, each returning the cheapest
experiment that would disprove it. Promoted to `RESULTS.md` only if all
defenses pass.

### 7. `/skill:surprise-triage` — when results diverge >15%, stop

Ranked explanations + cheapest disambiguating test for each. Surprising numbers
blocked from `RESULTS.md` until triage completes.

### 8. `/skill:kill-or-ship` — decide

| Option | When | Effect |
|--------|------|--------|
| **KILL** | Spend > 1.5× cap, or >21 days stale | Write `KILLED.md`, record a lesson |
| **PIVOT** | Failed but suggests a new direction | Kill old, open a new hypothesis |
| **SHIP** | All gates pass, falsification clean | Tag and publish |

### 9. `/skill:verification-before-publication` — evidence before claims

Full checklist: locks match, baselines fresh, falsifier verdicts evaluated,
cost ledger current, stats done, alternatives documented.

---

## The monitor

`/monitor` (or `epistemic monitor`) opens a full-screen interactive view:

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
| `enter` | actions: chat / approve / reject / modify |
| `q` | back to the chat |

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
