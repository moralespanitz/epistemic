# Testing the epistemic TUI

Two layers: fast pure-logic tests (always run), and agent-driven end-to-end TUI
tests (drive the real terminal app — "agent-browser, but for TUI").

## 1. Logic tests (fast, no terminal)

The navigation, key handling, action composition, and rendering are pure
functions — unit-tested with Node's built-in runner:

```bash
npm test        # non-TUI unit tests
```

Covers: arrow-key parsing, selection bounds, view switching, the
approve/reject/modify prompt composition, and both monitor interfaces.

## 2. Agent-driven TUI tests (drive the real app)

A TUI is tested the way `agent-browser` tests a webpage: launch it, **send
keystrokes**, **read/assert the screen**. We ship a tiny driver
(`test/tui-driver.mjs`) that does this over plain `child_process` pipes — no
pty, no tmux — so it runs anywhere, including CI:

```bash
npx tsx --test test/tui-drive.test.ts
```

Run it directly:

```bash
npm run test:tui:pipe
```

It launches the real `epistemic monitor`, sends `↓ → ←`, asserts the screen
moves between the tree and detail interfaces, then `q` and asserts a clean exit.
The monitor is read-only (no auth), so it runs fully headless.

The driver is reusable for ad-hoc agent control:

```js
import { launch } from "./test/tui-driver.mjs";
const app = launch(process.execPath, ["--import", "tsx", "src/cli/epistemic.ts", "monitor"]);
await app.waitFor("mission control");
app.send("down", "right");          // navigate
await app.waitFor("claim:");        // detail interface
app.send("q");
```

There's also a tmux harness (`npm run test:tui`, needs `brew install tmux`) for
driving the full chat-side TUI where a real PTY is wanted.

## 3. Validate with agent-tui (the agent-browser for TUI)

[agent-tui](https://github.com/pproenca/agent-tui) drives the TUI through a real
PTY (Rust — works on Node 25, unlike node-pty). Verified working against the
monitor:

```bash
npm i -g agent-tui          # one-time
npm run test:agent-tui      # test/agent-tui-validate.sh → 5/5 pass
```

It launches `epistemic monitor`, screenshots, presses `ArrowDown`/`ArrowRight`/
`ArrowLeft`, and asserts the detail interface and tree appear. Manual driving:

```bash
agent-tui run --cwd "$PWD" -- node --import tsx src/cli/epistemic.ts monitor
agent-tui wait "mission control"
agent-tui press ArrowDown ArrowRight   # navigate into a hypothesis
agent-tui screenshot                   # see the detail interface
agent-tui press q ; agent-tui kill
```

## 4. UX/UI validation & visual regression

Catch UX failures and layout drift, driven through agent-tui:

```bash
npm run test:agent-tui:ux    # 24 checks: nav, edge cases, glitch/overflow detection, resize
npm run test:snapshot        # visual regression vs saved baselines (test/snapshots/)
```

The UX suite asserts both that the right things render AND that failure markers
(`truncated`, `undefined`, `NaN`, `Error`, width overflow, header scroll-off) do
NOT appear. It already caught a real bug: the monitor scrolled its header off on
short terminals — now it fits the viewport.

Snapshot tests diff the normalized screen (ANSI stripped, `$`/`%` values masked)
against `test/snapshots/*.txt`. To update baselines after an intended change:

```bash
UPDATE_SNAPSHOTS=1 npm run test:snapshot
```

## "agent-browser for TUI" — published tools

If you want an agent to drive/inspect the TUI interactively (not just scripted
tests), these are the equivalents of `agent-browser`:

| Tool | Form | Notes |
|------|------|-------|
| [agent-tui](https://github.com/pproenca/agent-tui) | **skill** ([Smithery](https://smithery.ai/skills/neversight/agent-tui)) | Closest drop-in to agent-browser — drive any terminal app, screenshot + input |
| [mcp-tui-test](https://github.com/GeorgePearse/mcp-tui-test) | **MCP server** | "Playwright for TUI" — launch, send keys, capture, assert; multiple sessions |
| [tuistory](https://github.com/remorses/tuistory) | CLI | "Like Playwright & agent-browser but for TUIs"; reactive waiting (~75ms) |
| [termwright](https://github.com/fcoury/termwright) | library | PTY wrap, screen reading, wait conditions, box detection |
| [tui-use](https://github.com/onesuper/tui-use) | CLI | Agents drive REPLs/debuggers/TUIs |

All wrap the same primitive our harness uses (PTY/tmux + send-keys +
capture-screen). To test the read-only monitor with no auth:

```bash
epistemic monitor   # launch this under the tool, then send ↑↓ → ← enter q
```
