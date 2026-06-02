/**
 * `epistemic fleet` — PROOF OF CONCEPT for the parallel subagent tree.
 *
 * The terminal splits (quadtree-style) into one pane per in-flight experiment.
 * Each pane is a coordinator subagent; inside it, child subagents (sweep
 * variants) run concurrently in their own sandboxes, advancing through the
 * epistemic stages and getting KILLED the moment they fall behind. It's a tree
 * of subagents-of-subagents experimenting in parallel — visualized live.
 *
 * This POC SIMULATES the subagents (progress ticks, kills) so the experience is
 * real even though the recursive spawning + real sandboxes aren't wired yet.
 * The layout/render core (panes.ts) is exactly what the real version would use.
 */
import { loadFleet } from "../monitor/fleet.js";
import { renderForest, type PaneTree } from "./panes.js";

const ESC = "\x1b[";
const ALT_ON = `${ESC}?1049h`, ALT_OFF = `${ESC}?1049l`;
const HIDE = `${ESC}?25l`, SHOW = `${ESC}?25h`;
const HOME = `${ESC}H${ESC}2J`;

const SANDBOXES = ["worktree", "modal", "docker"] as const;
const VARIANTS = ["lr=1e-4", "lr=3e-4", "prompt-A", "rank=8", "rank=16", "seed=7"];
const BAR = "▁▂▃▄▅▆▇█";

interface SubAgent {
  label: string;
  sandbox: string;
  progress: number; // 0..1
  total: number;
  status: "running" | "shipped" | "killed";
  acc: number;
  subs?: SubAgent[]; // sub-subagents — the third level of the tree
}
interface ExpNode {
  id: string;
  claim: string;
  stage: string;
  kids: SubAgent[];
}

function bar(p: number, width = 8): string {
  const filled = Math.round(p * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** A subagent → its own pane (leaf, or a parent of sub-subagents). */
function subPane(k: SubAgent): PaneTree {
  const trials = `${Math.round(k.progress * k.total)}/${k.total}`;
  const tag = k.status === "shipped" ? "✓ ship" : k.status === "killed" ? "✗ kill" : bar(k.progress);
  const spark = BAR[Math.min(7, Math.round(k.acc * 7))];
  const title = `${k.label} [${k.sandbox}]`;
  if (k.subs?.length) {
    return { title, children: k.subs.map(subPane) };
  }
  return { title, lines: [`${tag} ${trials}`, `acc ${spark}`] };
}

/** An experiment → a pane subdividing into its child subagents. */
function expPane(node: ExpNode): PaneTree {
  const alive = node.kids.filter((k) => k.status === "running").length;
  return {
    title: `${node.id}  ${node.stage}  (${alive}↻ ${node.kids.length - alive}■)`,
    children: node.kids.map(subPane),
  };
}

export async function runFleetApp(cwd: string): Promise<void> {
  const out = process.stdout;
  const fleet = await loadFleet(cwd);

  // Build the (simulated) subagent tree from the real in-flight hypotheses.
  const inFlight = fleet.entries.filter((e) => e.status === "OPEN" || e.status === "RUNNING");
  const seed = inFlight.length ? inFlight : fleet.entries.slice(0, 4);
  const nodes: ExpNode[] = (seed.length ? seed : [{ id: "RD-A-H1", claim: "demo hypothesis", status: "RUNNING" } as any]).map((e, i) => {
    const kidCount = 2 + (i % 3); // 2–4 parallel child subagents per experiment
    const mkAgent = (j: number, total: number): SubAgent => ({
      label: VARIANTS[(i + j) % VARIANTS.length],
      sandbox: SANDBOXES[(i + j) % SANDBOXES.length],
      progress: 0.02 + ((i * 7 + j * 13) % 20) / 100,
      total,
      status: "running",
      acc: 0.5 + ((i + j) % 5) / 10,
    });
    const kids: SubAgent[] = Array.from({ length: kidCount }, (_, j) => mkAgent(j, 30));
    // The first child is a coordinator that itself fans out into sub-subagents
    // (the third level of the tree): e.g. a variant exploring two seeds.
    kids[0].subs = [mkAgent(10, 15), mkAgent(11, 15)];
    return { id: e.id, claim: e.claim, stage: e.status === "RUNNING" ? "experiment-execution" : "preregistration", kids };
  });

  let stop = false;
  let tick = 0;

  const advance = (k: SubAgent) => {
    if (k.subs) k.subs.forEach(advance); // sub-subagents run in parallel too
    if (k.status !== "running") return;
    // Parallel, independent progress; epistemic kill if a variant stalls/diverges.
    k.progress = Math.min(1, k.progress + 0.03 + Math.random() * 0.04);
    k.acc = Math.max(0, Math.min(1, k.acc + (Math.random() - 0.45) * 0.05));
    if (k.acc < 0.35 && k.progress > 0.3) k.status = "killed";       // diverged → killed
    else if (k.progress >= 1) k.status = k.acc >= 0.6 ? "shipped" : "killed";
  };

  const step = () => {
    tick++;
    for (const node of nodes) node.kids.forEach(advance);
  };

  const draw = () => {
    const w = out.columns ?? 100;
    const h = out.rows ?? 40;
    const flat: SubAgent[] = [];
    const collect = (k: SubAgent) => { flat.push(k); k.subs?.forEach(collect); };
    nodes.forEach((n) => n.kids.forEach(collect));
    const shipped = flat.filter((k) => k.status === "shipped").length;
    const killed = flat.filter((k) => k.status === "killed").length;
    const running = flat.filter((k) => k.status === "running").length;
    const header = `Ξ epistemic · fleet (POC)   ${running}↻ running · ${shipped}✓ shipped · ${killed}✗ killed   subagent tree in parallel sandboxes   ·  q quit`;
    const grid = renderForest(nodes.map(expPane), w, h - 1);
    out.write(HOME + header.slice(0, w) + "\n" + grid.join("\n"));
  };

  const cleanup = () => {
    out.write(SHOW + ALT_OFF);
    if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
    process.stdin.pause();
  };

  if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data: string) => {
    if (data === "q" || data === "\x03") { stop = true; cleanup(); process.exit(0); }
  });

  out.write(ALT_ON + HIDE);
  draw();
  const onResize = () => { if (!stop) draw(); };
  out.on("resize", onResize);
  const timer = setInterval(() => {
    if (stop) { clearInterval(timer); return; }
    step();
    draw();
  }, 400);

  await new Promise<void>((resolve) => {
    const check = setInterval(() => { if (stop) { clearInterval(check); clearInterval(timer); out.off("resize", onResize); resolve(); } }, 100);
  });
}
