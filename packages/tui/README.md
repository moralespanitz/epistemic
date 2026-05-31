# Epistemic Cockpit (TUI)

A spatial research cockpit for epistemic. It works like Claude Code or pi.dev —
a persistent prompt at the bottom you can always type into — but with spatial
views of your research program: a conversation, a research tree, live mission
control, and per-experiment focus.

## Run

From the root of a research repo (where `HYPOTHESES.md` / `experiments/` live):

```bash
npx tsx packages/tui/src/main.tsx
# or, once linked:
epistemic-tui
```

## How you interact

The box at the bottom is always focused. Two ways to use it:

- **Type a message and press Enter** → it goes to the agent. The reply streams
  into the conversation.
- **Type a `/command` and press Enter** → it runs an action.

| Command | What it does |
|---------|--------------|
| `/chat` | Conversation view (default) |
| `/tree` | Research tree — parallel trees, conditional plans, alternatives, killed branches |
| `/missions` | Live grid of parallel experiments with cost/accuracy sparklines |
| `/focus` | Deep view of the selected experiment |
| `/spawn [id]` | Launch the selected (or named) experiment |
| `/kill [id]` | Stop the selected (or named) experiment |
| `/review` | Ask the agent for the cheapest disconfirming experiment |
| `/help` | List commands |
| `/quit` | Exit |

Other keys: `↑` / `↓` select a hypothesis (the Inspector on the right follows
the selection), `Ctrl+C` quits.

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
