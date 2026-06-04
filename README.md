<p align="center">
  <strong>Ξ epistemic</strong>
</p>
<p align="center">The open source research-discipline coding agent.</p>
<p align="center">
  <a href="./GUIDE.md"><img alt="Docs" src="https://img.shields.io/badge/docs-GUIDE.md-amber?style=flat-square" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/moralespanitz/epistemic?style=flat-square" /></a>
</p>

---

epistemic gives your coding agent the norms of good ML research. Instead of running experiments, eyeballing a number, and moving on, it enforces a real method: **pre-register a hypothesis, reproduce the baseline, run the experiment, attack your own claim, then decide to ship or kill** — with an interactive monitor and gates that make the rules automatic.

The **skills** are the portable manual the agent follows step by step. The **harnesses** inject that manual into Claude Code, Codex, or the epistemic TUI. The **gates** are the safety net that enforces it where the harness supports runtime hooks.

## Quickstart

Give your agent epistemic: [Claude Code](#claude-code), [Codex CLI](#codex-cli), [Codex App](#codex-app), [epistemic TUI](#epistemic-tui).

## How it works

It starts from the moment your agent picks up an empirical task. Instead of jumping straight to running code, it steps back and asks what you're really trying to prove.

Once it has a rough claim, it asks one question at a time — Socratic-style — until the hypothesis is falsifiable, the falsifier is concrete, and the budget is realistic. Before locking in, it generates 2–3 competing explanations with unique disconfirming predictions so you pick the strongest one.

After you sign off, the agent locks the hypothesis in a pre-registration file before touching any experiment code. The **prereg gate** then blocks any experiment-shaped command that has no matching `prereg.md` — so there's no way to accidentally run something unregistered.

From there it reproduces the competitor's baseline under your locked judge, runs the full experiment, applies proper statistics, and sends the claim to adversary models that each try to disprove it. If any adversary succeeds, the result is blocked. If all pass, it lands in `RESULTS.md` and you decide: ship, kill, pivot, or refine.

Because the skills trigger automatically, you don't need to orchestrate anything. Your coding agent just has epistemic.

---

## What you type → what happens

```bash
$ epistemic "does LoRA at rank 8 outperform rank 4 on math benchmarks"
→ Opens research-question skill, refines to a falsifiable hypothesis

$ epistemic "run the registered experiment H-003"
→ Checks prereg gate, routes to the correct compute target, logs costs

$ epistemic monitor
→ Full-screen experiment tree: running, shipped, killed, pending

$ epistemic fleet
→ Launches a parallel agent fleet across all pending hypotheses

$ /skill:falsification-review
→ Sends the current claim to ≥2 adversary models; blocks if any falsify it

$ /skill:kill-or-ship
→ Decision gate: KILL / PIVOT / REFINE / RECOMMIT / SHIP
```

---

## Workflows

Ask naturally or use slash commands as shortcuts.

| Command | What it does |
|---|---|
| `/skill:research-question` | Refine a rough idea into a falsifiable, pre-registerable hypothesis |
| `/skill:preregistration` | Lock hypothesis, judge config, and compute scaffold before running |
| `/skill:baseline-reproduction` | Reproduce the competitor's result under your locked judge |
| `/skill:experiment-execution` | Run with discipline — locked env, full sample, cost logging |
| `/skill:statistical-rigor` | Effect sizes, test selection, multiple-comparison correction, APA reporting |
| `/skill:falsification-review` | Adversary models try to disprove the claim; blocks if any succeed |
| `/skill:surprise-triage` | Diagnose results that diverge >15% before they reach `RESULTS.md` |
| `/skill:kill-or-ship` | Final decision gate with five outcomes |
| `/skill:verification-before-publication` | Full pre-publish checklist |

---

## Installation

### Claude Code

epistemic is available via the [official Claude plugin marketplace](https://claude.com/plugins/epistemic).

#### Official Marketplace

```bash
/plugin install epistemic@claude-plugins-official
```

#### Epistemic Marketplace

```bash
/plugin marketplace add moralespanitz/epistemic
/plugin install epistemic-skills@epistemic
```

#### Local install (symlink, stays in sync with this repo)

```bash
git clone git@github.com:moralespanitz/epistemic.git && cd epistemic

# Core methodology skills
for s in using-epistemic epistemic research-question preregistration baseline-reproduction \
  experiment-execution statistical-rigor falsification-review surprise-triage \
  kill-or-ship verification-before-publication; do
  ln -sfn "$PWD/skills/$s" "$HOME/.claude/skills/$s"
done

# Optional: Hugging Face research stack
for s in huggingface-papers hf-cli huggingface-datasets \
  huggingface-community-evals huggingface-trackio huggingface-llm-trainer; do
  ln -sfn "$PWD/skills/$s" "$HOME/.claude/skills/$s"
done
```

Hooks (prereg gate + session bootstrap) install automatically via the marketplace, or manually:

```bash
epistemic hooks install   # add hooks to ~/.claude/settings.json
epistemic hooks status    # check what's active
epistemic hooks on | off  # toggle without restart
```

### Codex CLI

- Open the plugin search interface: `/plugins`
- Search for `epistemic` and select **Install Plugin**.

### Codex App

- In the Codex app, click **Plugins** in the sidebar.
- Find `epistemic` in the Research section and click `+`.

### epistemic TUI

The full TUI — 3D Ξ header, monitor, fleet runner — requires the local install:

```bash
git clone git@github.com:moralespanitz/epistemic.git && cd epistemic
npm install
npm link            # makes `epistemic` available everywhere
```

Default model: `openrouter/deepseek/deepseek-v4-pro`. If you have OpenAI Codex authed, it uses that instead. If nothing is authed, pi prompts `/login`.

---

## Skills Library

### Research Methodology

- **research-question** — Socratic refinement from rough idea to falsifiable hypothesis. Generates 2–3 competing alternatives with unique disconfirming predictions; archives the ones you don't pick.
- **preregistration** — Validates all fields, writes `experiments/{id}/prereg.md`, hashes the judge config → `judge.lock`, generates the compute scaffold (Dockerfile / modal-app.py / environment.lock), and commits. Locks in the rules before code runs.
- **baseline-reproduction** — Reads the competitor's paper, validates HuggingFace datasets, reproduces the result under your locked judge. Baselines older than 30 days must be refreshed.
- **experiment-execution** — Confirms prereg + locks match, routes by compute target (`local` / `docker` / `modal`), logs every API/compute cost to `.epistemic/cost-ledger.jsonl`, writes results to `experiments/{id}/smokes/` — **provisional only**.
- **statistical-rigor** — Assumption checking → test selection → effect sizes (Cohen's d, η², R²) alongside p-values → multiple-comparison correction → APA reporting with exact p-values.
- **falsification-review** — Sends the claim to ≥2 adversary models. Each returns the cheapest experiment that would disprove it. If that experiment is <$1 and unrun, the agent insists on running it first.
- **surprise-triage** — Triggered when results diverge >15%. Produces ranked explanations (sampling, judge mismatch, data leakage, ceiling effects, prompt drift, version change, bugs) and the cheapest disambiguating test for each.
- **kill-or-ship** — Decision gate. Sunk-cost rule: killed hypotheses can't be silently revived. Expected kill-to-ship ratio ~5:1 — killing fast is the point.
- **verification-before-publication** — Full pre-publish checklist: locks present and matching, baselines fresh, falsifier verdicts evaluated, cost ledger current, stats done, alternatives documented.

**kill-or-ship outcomes**

| Option | When | Effect |
|--------|------|--------|
| **KILL** | Spend > 1.5× cap, or >21 days stale | Write `KILLED.md`, record a lesson |
| **PIVOT** | Failed but suggests a new direction | Kill old, open a new hypothesis |
| **REFINE** | Same claim, adjusted method | Re-run from execution (needs override) |
| **RECOMMIT** | Continue past kill criteria | New cap + override |
| **SHIP** | All gates pass, falsification clean | Tag and publish |

### Meta

- **using-epistemic** — Bootstrap skill injected at `SessionStart` in research repos (has `HYPOTHESES.md` / `experiments/`). Tells the agent to load the correct stage skill before any empirical work.
- **epistemic** — Umbrella skill: the shared method contract loaded by all harnesses.

---

## Agents

Four bundled research agents, dispatched automatically.

- **Researcher** — gather evidence across papers, HuggingFace, web, repos, and docs
- **Adversary** — simulated peer review with the cheapest disconfirming experiment per claim
- **Statistician** — assumption checking, test selection, effect sizes, APA reporting
- **Verifier** — pre-publish checklist, lock matching, baseline freshness, cost ledger audit

---

## The Monitor

`epistemic monitor` (or `/monitor` in the TUI) opens a full-screen interactive view of every experiment:

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

## The Gates (automatic)

If the skills are well written, the gates never fire — the agent follows the manual. The gates are the safety net.

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

## Tools

Internal tools the agent can call during research workflows.

- **Docker** — isolated container execution for reproducible experiment environments
- **Modal** — serverless GPU compute for burst training and inference
- **Web search** — evidence gathering across papers, docs, and repos

**Hugging Face** (optional, requires `hf auth login`)

| Tool | What it does |
|---|---|
| `huggingface-papers` | Read any arXiv paper as markdown; structured metadata (authors, linked models, citations) |
| `hf-cli` | Download/upload models & datasets, manage repos, run HF Jobs |
| `huggingface-datasets` | Paginate rows, full-text search, filter predicates, get Parquet URLs |
| `huggingface-community-evals` | Run evals locally with `inspect-ai` or `lighteval` |
| `huggingface-trackio` | Log metrics + alerts during training, sync real-time dashboard to HF Space |
| `huggingface-llm-trainer` | Fine-tune with TRL (SFT/DPO/GRPO) on HF Jobs cloud GPUs |

---

## Plugin API

`@epistemic/omp` exposes a typed plugin API to extend epistemic with your own commands, event handlers, and gates:

```typescript
import type { EpistemicPlugin } from "@epistemic/omp";

export const myPlugin: EpistemicPlugin = (api) => {
  api.registerCommand("my-cmd", {
    description: "My custom command",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Running my-cmd with: ${args}`, "info");
    },
  });

  api.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus?.("my-plugin", "● active");
  });

  api.gate(async (event, ctx) => {
    // Return { block: true, reason: "..." } to interrupt
  });
};
```

| Method | What it does |
|--------|-------------|
| `registerCommand(name, opts)` | Registers a `/name` slash command in the agent chat |
| `on(event, handler)` | Subscribes to `session_start`, `session_shutdown`, `before_agent_start`, or `tool_call` |
| `gate(handler)` | Registers a `tool_call` gate — return `{ block, reason }` to interrupt |

---

## How it works (layers)

Built on Pi for the agent runtime, with the epistemic skill core as the shared method contract across all harnesses. Runtime resources follow Pi's package, extension, and skill model.

| Layer | What it does |
|-------|-------------|
| **Portable skill core** | `using-epistemic`, `epistemic`, and stage skills — the shared method across harnesses |
| **Harness bootstrap** | Claude `SessionStart`, Codex manifest inject the skill core at the right time |
| **Runtime gates** | Invisible enforcement that blocks rule violations automatically |
| **Monitor** | Navigate the experiment tree, drill into a hypothesis, approve / reject / modify |
| **Fleet** | Parallel agent fleet runner for multi-experiment orchestration |
| **HF stack** | 6 HF skills (papers, datasets, evals, training, tracking, CLI) auto-discovered |
| **State** | File-based ledger: `HYPOTHESES.md`, `.epistemic/cost-ledger.jsonl`, `experiments/{id}/` |

---

## Repo Layout

| Path | What it is |
|------|-----------|
| `packages/omp/` | `@epistemic/omp` — forked oh-my-pi TUI shell (Amber Lab theme, ResearchSidebar) |
| `src/` | Extension: gates, commands, monitor, board |
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

## Philosophy

- **Pre-registration** — lock the hypothesis before running a single line
- **Reproducibility** — you can't beat what you can't run
- **Falsification over confirmation** — guilty until proven defensible
- **Evidence over claims** — verify before publishing

---

## Contributing

1. Fork the repository
2. Create a branch for your work
3. Follow the `writing-skills` skill for creating and testing new and modified skills
4. Submit a PR

Every skill must work across all supported harnesses (Claude Code, Codex, TUI).

---

## More

- **[GUIDE.md](./GUIDE.md)** — prompt-driven walkthrough and use cases
- **[TESTING.md](./TESTING.md)** — the agent-driven TUI test suite (`npm run verify`)
- **Issues**: https://github.com/moralespanitz/epistemic/issues
