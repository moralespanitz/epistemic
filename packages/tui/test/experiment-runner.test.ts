import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ExperimentRunner } from "../src/experiment-runner.js";
import { makeRepo } from "./fixtures.js";

// A fake job: prints two telemetry lines then exits 0.
const FAKE_JOB = [
  "node", "-e",
  "console.log('TRIAL 1/2');console.log('COST 1.5');console.log('ACC 0.6');" +
  "console.log('TRIAL 2/2');console.log('COST 3.0');console.log('ACC 0.8')",
];

test("runner writes telemetry.jsonl and run-status done on success", async () => {
  const cwd = await makeRepo();
  const runner = new ExperimentRunner(cwd);
  await runner.spawnWith("H-001", FAKE_JOB);
  await runner.waitFor("H-001");

  const smokes = join(cwd, "experiments", "H-001", "smokes");
  const tel = await readFile(join(smokes, "telemetry.jsonl"), "utf8");
  const points = tel.trim().split("\n").map((l) => JSON.parse(l));
  expect(points).toHaveLength(2);
  expect(points[1]).toMatchObject({ trial: 2, total: 2, cost: 3.0, acc: 0.8 });

  const rs = JSON.parse(await readFile(join(smokes, "run-status.json"), "utf8"));
  expect(rs.status).toBe("done");
});

test("runner marks failed when the job exits nonzero", async () => {
  const cwd = await makeRepo();
  const runner = new ExperimentRunner(cwd);
  await runner.spawnWith("H-002", ["node", "-e", "process.exit(3)"]);
  await runner.waitFor("H-002");

  const rs = JSON.parse(
    await readFile(join(cwd, "experiments", "H-002", "smokes", "run-status.json"), "utf8"),
  );
  expect(rs.status).toBe("failed");
  expect(rs.exit).toBe(3);
});

test("kill marks run-status killed", async () => {
  const cwd = await makeRepo();
  const runner = new ExperimentRunner(cwd);
  await runner.spawnWith("H-003", ["node", "-e", "setTimeout(()=>{}, 10000)"]);
  await new Promise((r) => setTimeout(r, 100));
  runner.kill("H-003");
  await runner.waitFor("H-003");

  const rs = JSON.parse(
    await readFile(join(cwd, "experiments", "H-003", "smokes", "run-status.json"), "utf8"),
  );
  expect(rs.status).toBe("killed");
});
