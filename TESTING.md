# Testing the epistemic TUI

Two layers: fast pure-logic tests (always run), and agent-driven end-to-end TUI
tests (drive the real terminal app — "agent-browser, but for TUI").

## 1. Logic tests (fast, no terminal)

The navigation, key handling, action composition, and rendering are pure
functions — unit-tested with Node's built-in runner:

```bash
npm test        # tsx --test test/*.test.ts
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
