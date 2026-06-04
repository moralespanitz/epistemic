# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript ESM CLI and plugin repository. Main source lives in `src/`: `cli/` for command entrypoints, `fleet/` for agent orchestration, `monitor/` and `research/` for TUI state and rendering, `gates/` for methodology checks, `state/` for repository data, and `tui/` for UI helpers. The executable wrapper is `bin/epistemic.mjs`. Tests are in `test/`, with snapshots in `test/snapshots/`. Workspace packages live under `packages/`, currently `packages/omp`. Skills, themes, hooks, and docs are in `skills/`, `themes/`, `hooks/`, and `docs/`.

## Build, Test, and Development Commands

- `npm run start` or `npm start`: run the local `epistemic` CLI.
- `npm run typecheck`: run `tsc --noEmit`.
- `npm test`: run non-TUI `test/*.test.ts` unit tests through `tsx --test`.
- `npm run verify`: run typecheck and the unit test suite.
- `npm run test:tui:pipe`: run the pipe-driven TUI test; `npm run test:tui` runs the tmux-based TUI harness.
- `npm run test:agent-tui`, `npm run test:agent-tui:ux`, `npm run test:snapshot`: validate terminal UI behavior and snapshots.

Use `UPDATE_SNAPSHOTS=1 npm run test:snapshot` only for intentional TUI rendering changes.

## Coding Style & Naming Conventions

Use strict TypeScript and ESM imports with explicit `.js` extensions for local modules. Prefer small domain modules over broad utility files. Keep indentation at two spaces. Use `camelCase` for functions and variables, `PascalCase` for classes and interfaces, and kebab-case filenames such as `fleet-controller.test.ts` or `claim-interceptor.ts`. There is no separate formatter or linter configured; preserve existing style and run `npm run typecheck` before submitting.

## Testing Guidelines

Tests use Node's built-in `node:test` API with `node:assert/strict`. Name test files `*.test.ts` and keep them in `test/`. Prefer fast unit tests for parsing, state, prompt, and rendering logic. For TUI behavior, use the provided driver and scripts. Update snapshots only for deliberate visual changes.

## Commit & Pull Request Guidelines

Recent history uses conventional prefixes such as `feat:`, `fix:`, `docs:`, and `refactor:`, for example `feat: fleet prompt builder`. Keep commits focused and describe the user-visible or behavioral change. Pull requests should include a short summary, commands run, linked issues or design docs when relevant, and screenshots or snapshot notes for TUI-facing changes.

## Security & Configuration Tips

Use `.env.example` as the reference for local configuration and avoid committing secrets. Generated worktrees, logs, and temporary files should stay out of source control unless they are intentional fixtures or snapshots.
