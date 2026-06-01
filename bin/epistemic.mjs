#!/usr/bin/env node
// epistemic — a branded variation of the pi/omp coding agent.
// Runs the real pi interactive agent (with the epistemic extension) behind a
// custom intro animation.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "cli", "epistemic.ts");

const result = spawnSync("npx", ["tsx", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});
process.exit(result.status ?? 0);
