/**
 * `epistemic hooks <status|on|off|install|remove|clean|clean-superset>`
 *
 * Manage epistemic's Claude Code hooks in ~/.claude/settings.json — and clean
 * out hooks you no longer use. Every write backs up settings.json first.
 *
 *   status         show what's installed / enabled
 *   on | off       enable/disable the epistemic hooks instantly (sentinel file)
 *   install        add epistemic SessionStart + PreToolUse(Bash) hooks
 *   remove         remove the epistemic hooks
 *   clean-superset remove Superset notify hooks (anything using $SUPERSET_HOME_DIR)
 *   clean          clean-superset + prune empty hook arrays
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const SETTINGS = join(homedir(), ".claude", "settings.json");
const SENTINEL = join(homedir(), ".claude", "epistemic-hooks.disabled");
const HOOKS_DIR = join(dirname(new URL(import.meta.url).pathname), "..", "..", "hooks");
const SS_CMD = `node "${join(HOOKS_DIR, "session-start.mjs")}"`;
const GATE_CMD = `node "${join(HOOKS_DIR, "prereg-gate.mjs")}"`;

type Settings = { hooks?: Record<string, any[]> } & Record<string, any>;

function read(): Settings {
  if (!existsSync(SETTINGS)) return {};
  return JSON.parse(readFileSync(SETTINGS, "utf8"));
}
function write(s: Settings): void {
  mkdirSync(dirname(SETTINGS), { recursive: true });
  if (existsSync(SETTINGS)) copyFileSync(SETTINGS, `${SETTINGS}.bak`);
  writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + "\n");
}
const isEpistemic = (group: any) => JSON.stringify(group).includes("epistemic/hooks");
const isSuperset = (group: any) => JSON.stringify(group).includes("SUPERSET_HOME_DIR");

export async function runHooks(args: string[]): Promise<void> {
  const sub = (args[0] ?? "status").toLowerCase();
  const s = read();
  s.hooks ||= {};

  switch (sub) {
    case "on": {
      if (existsSync(SENTINEL)) rmSync(SENTINEL);
      console.log("Ξ epistemic hooks ENABLED");
      break;
    }
    case "off": {
      mkdirSync(dirname(SENTINEL), { recursive: true });
      writeFileSync(SENTINEL, "epistemic hooks disabled\n");
      console.log("Ξ epistemic hooks DISABLED (scripts exit silently; run `epistemic hooks on` to re-enable)");
      break;
    }
    case "install": {
      s.hooks.SessionStart ||= [];
      s.hooks.PreToolUse ||= [];
      if (!s.hooks.SessionStart.some(isEpistemic)) s.hooks.SessionStart.push({ hooks: [{ type: "command", command: SS_CMD }] });
      if (!s.hooks.PreToolUse.some(isEpistemic)) s.hooks.PreToolUse.push({ matcher: "Bash", hooks: [{ type: "command", command: GATE_CMD }] });
      write(s);
      console.log("Ξ installed epistemic hooks (SessionStart + PreToolUse Bash). Restart Claude Code to load.");
      break;
    }
    case "remove": {
      for (const ev of Object.keys(s.hooks)) s.hooks[ev] = s.hooks[ev].filter((g: any) => !isEpistemic(g));
      write(s);
      console.log("Ξ removed epistemic hooks. Restart Claude Code.");
      break;
    }
    case "clean-superset":
    case "clean": {
      let removed = 0;
      for (const ev of Object.keys(s.hooks)) {
        const before = s.hooks[ev].length;
        s.hooks[ev] = s.hooks[ev].filter((g: any) => !isSuperset(g));
        removed += before - s.hooks[ev].length;
        if (sub === "clean" && s.hooks[ev].length === 0) delete s.hooks[ev];
      }
      write(s);
      console.log(`Ξ removed ${removed} Superset hook group(s)${sub === "clean" ? " and pruned empty events" : ""}. Restart Claude Code.`);
      break;
    }
    case "status":
    default: {
      const enabled = !existsSync(SENTINEL);
      const groups = Object.entries(s.hooks).flatMap(([ev, arr]) => (arr as any[]).map((g) => ({ ev, g })));
      console.log(`Ξ epistemic hooks: ${enabled ? "ENABLED" : "DISABLED"}`);
      console.log(`settings: ${SETTINGS}`);
      console.log("\nHook groups in settings.json:");
      for (const { ev, g } of groups) {
        const tag = isEpistemic(g) ? "epistemic" : isSuperset(g) ? "superset" : "other";
        console.log(`  [${tag}] ${ev}${g.matcher ? ` (${g.matcher})` : ""}`);
      }
      console.log("\nCommands: status · on · off · install · remove · clean-superset · clean");
      break;
    }
  }
}
