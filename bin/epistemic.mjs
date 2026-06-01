#!/usr/bin/env node
// epistemic — a research-discipline coding agent. Launches the interactive
// agent + the epistemic extension behind a branded intro.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "cli", "epistemic.ts");

const result = spawnSync("npx", ["tsx", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
  // Suppress the underlying framework's update/version banner — only epistemic shows.
  env: { ...process.env, PI_SKIP_VERSION_CHECK: "1", PI_TELEMETRY: process.env.PI_TELEMETRY ?? "0" },
});
process.exit(result.status ?? 0);
