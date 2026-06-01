# epistemic — your own coding agent

`epistemic` is a coding agent built on the **pi/omp agent core** (the same engine
omp runs — real tools, MCP, memory, skills) with a **spatial research interface**
on top: a conversation, a hypothesis tree, live mission control, per-experiment
focus, and per-hypothesis threads. The methodology gates (preregistration,
kill-or-ship, cost ledger, falsification) load into the same session.

It's not a wrapper around omp — it embeds the real agent via `createAgentSession`
from `@earendil-works/pi-coding-agent`, and falls back to `omp -p` only if the SDK
isn't available.

## Install & run

```bash
cd packages/tui && npm install && npm link   # makes `epistemic` global
epistemic                                     # run it from any research repo
```

Or without linking:

```bash
npx tsx packages/tui/src/main.tsx
```

Run it from the root of a research repo (where `HYPOTHESES.md` / `experiments/`
live, and a `.pi/` with your epistemic extension + settings).

## How you interact

The box at the bottom is always focused. Two ways to use it:

- **Type a message and press Enter** → it goes to the agent. The reply streams
  into the conversation.
- **Type a `/command` and press Enter** → it runs an action.

Type `/help` to see the full list. Commands mirror pi.dev / omp:

**Views** — `/chat` (default) · `/tree` · `/missions` · `/focus`

**Cockpit actions** (run natively):
| Command | What it does |
|---------|--------------|
| `/model [id]` | Show or switch the agent model (`/model gpt-5.2`) |
| `/spawn [id]` | Launch the selected (or named) experiment |
| `/kill [id]` | Stop the selected (or named) experiment |
| `/clear` | Clear the conversation |
| `/compact` | Compact the conversation, keeping a short summary |
| `/cost` | Show spend so far across hypotheses |
| `/review` | Ask the agent for the cheapest disconfirming experiment |
| `/help` `/quit` | List commands · exit |

**Forwarded to omp** — `/commit` `/branch` `/python` `/export` `/mcp` `/memory`
`/agents` `/plan` `/goal` `/loop` `/fast` `/todo` `/session` `/share` `/settings`
are sent to the agent as a turn (they're omp session features). While the cockpit
runs omp in print mode, these reach the agent rather than a live omp session.

Other keys: `↑` / `↓` select a hypothesis (the Inspector on the right follows
the selection), `Ctrl+C` quits.

## Drilling into a hypothesis (per-experiment workspace)

Select a hypothesis with `↑↓` and press **Enter on an empty prompt** to *enter*
it — like opening an agent thread. Inside, you get its details, an action bar,
and a conversation scoped to that hypothesis:

| In a hypothesis | What it does |
|-----------------|--------------|
| `/approve` | Ship it — runs kill-or-ship + verification via the agent |
| `/reject [reason]` | Kill it — runs kill-or-ship KILL and records the lesson |
| `/modify <what>` | Propose a refine/pivot |
| type text | Chat with the agent, scoped to this hypothesis |
| `/back` (or Esc) | Return to the tree |

Each hypothesis keeps its own conversation thread, so you can move between
experiments without losing context. `/open H-004` jumps straight in by id.

## Authoring the research tree

The Tree view is built from `HYPOTHESES.md`. Add these optional fields under a
`## Hypothesis: <id>` heading to shape the tree:

```markdown
## Hypothesis: H-004
- **Parent:** H-001
- **Decision:** acc ≥ 0.80 → ship | else → H-006 pivot
```

- `Parent` nests this hypothesis under another (omit it to start a new parallel tree).
- `Decision` renders a conditional plan as `if … → … / else → …`.
- Directories under `experiments/<id>/alternatives/` render as `↳ alt:` branches.

## Design

This package does not modify the epistemic extension. The filesystem is the
single source of truth: actions write to disk, a watcher rebuilds the model,
and Ink re-renders. See `docs/superpowers/specs/2026-05-31-epistemic-cockpit-design.md`.
