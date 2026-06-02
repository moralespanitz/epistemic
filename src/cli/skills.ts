/**
 * `epistemic skills <status|on|off>` — activate/deactivate the epistemic skills
 * in Claude Code by adding/removing symlinks in ~/.claude/skills/.
 *
 * Claude Code has no per-skill "disabled" flag for personal skills (presence =
 * active), so "off" removes our symlinks and "on" re-creates them. It only ever
 * touches symlinks that point back into this repo — never your other skills.
 *
 *   status   show which epistemic skills are active
 *   on       activate (symlink all into ~/.claude/skills)
 *   off      deactivate (remove our symlinks)
 */
import { existsSync, lstatSync, readlinkSync, symlinkSync, rmSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";

const SKILL_NAMES = [
  "epistemic",
  "research-question",
  "preregistration",
  "baseline-reproduction",
  "experiment-execution",
  "statistical-rigor",
  "falsification-review",
  "surprise-triage",
  "kill-or-ship",
  "verification-before-publication",
];

const REPO_SKILLS = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "skills");
const DEST_DIR = join(homedir(), ".claude", "skills");

type State = "active" | "inactive" | "conflict";

function stateOf(name: string): State {
  const dest = join(DEST_DIR, name);
  if (!existsSync(dest) && !isBrokenSymlink(dest)) return "inactive";
  try {
    const st = lstatSync(dest);
    if (st.isSymbolicLink()) {
      const target = resolve(dirname(dest), readlinkSync(dest));
      return target === join(REPO_SKILLS, name) ? "active" : "conflict";
    }
    return "conflict"; // a real dir owned by someone else
  } catch { return "inactive"; }
}
function isBrokenSymlink(p: string): boolean {
  try { lstatSync(p); return true; } catch { return false; }
}

export async function runSkills(args: string[]): Promise<void> {
  const sub = (args[0] ?? "status").toLowerCase();

  switch (sub) {
    case "on": {
      mkdirSync(DEST_DIR, { recursive: true });
      let added = 0;
      for (const name of SKILL_NAMES) {
        const dest = join(DEST_DIR, name);
        const s = stateOf(name);
        if (s === "active") continue;
        if (s === "conflict") { console.log(`  ! ${name}: a different skill already owns this name — skipped`); continue; }
        symlinkSync(join(REPO_SKILLS, name), dest);
        added++;
      }
      console.log(`Ξ epistemic skills ACTIVATED (${added} linked). Restart Claude Code to pick up new ones.`);
      break;
    }
    case "off": {
      let removed = 0;
      for (const name of SKILL_NAMES) {
        if (stateOf(name) !== "active") continue; // only remove OUR symlinks
        rmSync(join(DEST_DIR, name));
        removed++;
      }
      console.log(`Ξ epistemic skills DEACTIVATED (${removed} unlinked). Restart Claude Code.`);
      break;
    }
    case "status":
    default: {
      const active = SKILL_NAMES.filter((n) => stateOf(n) === "active").length;
      console.log(`Ξ epistemic skills: ${active}/${SKILL_NAMES.length} active`);
      console.log(`dest: ${DEST_DIR}\n`);
      for (const name of SKILL_NAMES) {
        const s = stateOf(name);
        const mark = s === "active" ? "✓" : s === "conflict" ? "!" : "·";
        console.log(`  ${mark} ${name}${s === "conflict" ? "  (name taken by another skill)" : ""}`);
      }
      console.log("\nCommands: status · on · off");
      break;
    }
  }
}
