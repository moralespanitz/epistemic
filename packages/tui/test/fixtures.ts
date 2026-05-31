import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeRepo(): Promise<string> {
  return mkdtemp(join(tmpdir(), "epistemic-tui-"));
}

export async function writeHypotheses(cwd: string, body: string): Promise<void> {
  await writeFile(join(cwd, "HYPOTHESES.md"), body, "utf8");
}

export async function writeTelemetry(
  cwd: string, id: string, lines: object[],
): Promise<void> {
  const dir = join(cwd, "experiments", id, "smokes");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "telemetry.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    "utf8",
  );
}

export async function writeRunStatus(
  cwd: string, id: string, status: object,
): Promise<void> {
  const dir = join(cwd, "experiments", id, "smokes");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "run-status.json"), JSON.stringify(status), "utf8");
}

export function sampleHypotheses(): string {
  return `# Hypotheses

## Hypothesis: H-001
- **Status:** RUNNING
- **Claim:** LoRA improves accuracy
- **Cost cap:** 50
- **Compute target:** local
- **N:** 30
`;
}
