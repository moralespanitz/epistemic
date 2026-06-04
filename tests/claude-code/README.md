# Claude Code Skill Tests

These tests verify the portable Claude Code harness, not the OMP runtime or TUI.
They invoke Claude Code headlessly with `claude -p` and assert that Epistemic's
bootstrap and skills shape the response.

## Requirements

- Claude Code CLI installed and authenticated
- Epistemic plugin installed, or local skills/hooks activated with:

```bash
npm run start -- skills on
npm run start -- hooks install
```

## Run

```bash
npm run test:claude-skills
```

Run one test:

```bash
bash tests/claude-code/run-skill-tests.sh --test test-epistemic-trigger.sh
```

## What This Covers

- A research repo triggers Epistemic behavior before experiment commands.
- The response mentions the umbrella `epistemic` mechanism and preregistration.
- The agent does not jump straight to running a benchmark.

These are behavioral smoke tests. They complement the TypeScript unit tests in
`test/` and the OMP gates in `src/gates/`.
