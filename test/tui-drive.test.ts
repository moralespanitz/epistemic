import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// @ts-expect-error — plain .mjs driver
import { launch } from "./tui-driver.mjs";

/**
 * Agent-driven TUI test that runs HERE (pipes, no pty/tmux): launch the real
 * `epistemic monitor`, send arrow keys, assert the screen reacts.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(ROOT, "src", "cli", "epistemic.ts");

let app: ReturnType<typeof launch>;
before(() => { app = launch(process.execPath, ["--import", "tsx", ENTRY, "monitor"], { cwd: ROOT }); });
after(() => app?.kill());

test("monitor renders mission control + the experiment tree", async () => {
  await app.waitFor("mission control");
  await app.waitFor("H-001");
  // The monitor is a centered top-down tree: nodes carry a status bullet.
  assert.match(app.screen(), /[●▸]/);
});

test("↓ then → opens the detail interface", async () => {
  app.send("down");
  await new Promise((r) => setTimeout(r, 120));
  app.send("right");
  await app.waitFor("claim:");
  assert.match(app.screen(), /falsifier:/);
});

test("← returns to the tree", async () => {
  app.send("left");
  await app.waitFor("↑↓ select");
});

test("q quits and the process exits", async () => {
  app.send("q");
  const code = await app.exited();
  assert.equal(code, 0);
});
