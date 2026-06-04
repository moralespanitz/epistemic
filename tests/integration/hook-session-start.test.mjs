#!/usr/bin/env node
/**
 * Integration tests for hooks/session-start.mjs
 *
 * Runs the real hook against temp directories and asserts the output.
 * No mocking — tests the actual hook logic end-to-end.
 *
 *   node tests/integration/hook-session-start.test.mjs
 */
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "../../hooks/session-start.mjs");
let pass = 0, fail = 0;

async function runHook(cwd) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [HOOK], { cwd });
    proc.stdin.end(JSON.stringify({ cwd }));
    let out = "";
    proc.stdout.on("data", d => out += d);
    proc.on("close", code => resolve({ code, out }));
  });
}

function check(label, condition) {
  if (condition) { console.log(`  ✔ ${label}`); pass++; }
  else           { console.log(`  ✘ ${label}`); fail++; }
}

// ── Test 1: non-git directory → silent (exit 0, no output) ──────────────────
console.log("\nTest 1: non-git directory → silent");
{
  const dir = await mkdtemp(join(tmpdir(), "ep-hook-"));
  const { code, out } = await runHook(dir);
  check("exit 0",        code === 0);
  check("no output",     out === "");
  await rm(dir, { recursive: true });
}

// ── Test 2: empty git repo → bootstrap message (not full preamble) ───────────
console.log("\nTest 2: empty git repo → lightweight bootstrap");
{
  const dir = await mkdtemp(join(tmpdir(), "ep-hook-"));
  await mkdir(join(dir, ".git"));   // fake git repo marker
  const { code, out } = await runHook(dir);
  check("exit 0",                     code === 0);
  check("produces output",            out.length > 0);
  const parsed = JSON.parse(out);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  check("mentions /new",              ctx.includes("/new"));
  check("says do not answer directly",ctx.toLowerCase().includes("do not answer"));
  check("does not include full skill",!ctx.includes("## The Rule"));  // full using-epistemic not injected
  await rm(dir, { recursive: true });
}

// ── Test 3: repo with HYPOTHESES.md → full preamble ─────────────────────────
console.log("\nTest 3: repo with HYPOTHESES.md → full preamble");
{
  const dir = await mkdtemp(join(tmpdir(), "ep-hook-"));
  await mkdir(join(dir, ".git"));
  await writeFile(join(dir, "HYPOTHESES.md"), "# Hypotheses\n\n## Hypothesis: RS-001\n");
  const { code, out } = await runHook(dir);
  check("exit 0",                  code === 0);
  check("produces output",         out.length > 0);
  const parsed = JSON.parse(out);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  check("mentions Epistemic",      ctx.includes("Epistemic"));
  check("includes using-epistemic",ctx.includes("The Rule") || ctx.includes("using-epistemic") || ctx.includes("epistemic skill"));
  check("not bootstrap only",      !ctx.includes("do not answer") || ctx.includes("The Rule"));
  await rm(dir, { recursive: true });
}

// ── Test 4: repo with RESEARCH.md → full preamble ───────────────────────────
console.log("\nTest 4: repo with RESEARCH.md → full preamble");
{
  const dir = await mkdtemp(join(tmpdir(), "ep-hook-"));
  await mkdir(join(dir, ".git"));
  await writeFile(join(dir, "RESEARCH.md"), "# RD: Test\n");
  const { code, out } = await runHook(dir);
  check("exit 0",          code === 0);
  check("produces output", out.length > 0);
  const parsed = JSON.parse(out);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  check("RESEARCH.md triggers full preamble", ctx.includes("Epistemic"));
  await rm(dir, { recursive: true });
}

// ── Test 5: repo with experiments/ → full preamble ──────────────────────────
console.log("\nTest 5: repo with experiments/ → full preamble");
{
  const dir = await mkdtemp(join(tmpdir(), "ep-hook-"));
  await mkdir(join(dir, ".git"));
  await mkdir(join(dir, "experiments"));
  const { code, out } = await runHook(dir);
  check("exit 0",          code === 0);
  check("produces output", out.length > 0);
  const parsed = JSON.parse(out);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  check("experiments/ triggers full preamble", ctx.includes("Epistemic"));
  await rm(dir, { recursive: true });
}

// ── Test 6: valid JSON output structure ──────────────────────────────────────
console.log("\nTest 6: output is valid hook JSON");
{
  const dir = await mkdtemp(join(tmpdir(), "ep-hook-"));
  await mkdir(join(dir, ".git"));
  await writeFile(join(dir, "HYPOTHESES.md"), "# Hypotheses\n");
  const { out } = await runHook(dir);
  let parsed;
  try { parsed = JSON.parse(out); } catch { parsed = null; }
  check("parses as JSON",       parsed !== null);
  check("has hookSpecificOutput", parsed?.hookSpecificOutput != null);
  check("has additionalContext",  typeof parsed?.hookSpecificOutput?.additionalContext === "string");
  await rm(dir, { recursive: true });
}

console.log(`\nhook-session-start: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
