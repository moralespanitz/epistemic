# Epistemic Cockpit (TUI)

A spatial research cockpit for epistemic. Renders your research program as
navigable lenses, launches and kills parallel experiments, and summons a
context-aware agent — all from the terminal.

## Run

From the root of a research repo (where `HYPOTHESES.md` / `experiments/` live):

```bash
npx tsx packages/tui/src/main.tsx
# or, once linked:
epistemic-tui
```

## Keys

| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Tree / Missions / Focus lens |
| `↑` / `↓` | Move selection |
| `s` | Spawn experiment for the selected hypothesis |
| `k` | Kill the selected experiment |
| `Ctrl+K` | Ask the context-aware agent |
| `q` | Quit |

## Design

This package does not modify the epistemic extension. The filesystem is the
single source of truth: actions write to disk, a watcher rebuilds the model,
and Ink re-renders. See `docs/superpowers/specs/2026-05-31-epistemic-cockpit-design.md`.
