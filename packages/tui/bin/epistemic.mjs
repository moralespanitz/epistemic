#!/usr/bin/env node
// epistemic — your own coding agent: the pi/omp agent core with a spatial
// research interface. Launches the cockpit in the current directory.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "main.tsx");

// Use the locally-installed tsx so we run TypeScript sources directly.
const result = spawnSync("npx", ["tsx", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});
process.exit(result.status ?? 0);
