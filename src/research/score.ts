/**
 * Gamification for the research program — pure, unit-tested.
 *
 * The methodology rewards killing fast (the README targets a ~5:1 kill:ship
 * ratio), so the scoring leans into that: kills earn real XP and a high
 * kill:ship ratio raises your "discipline" rank. This makes the discipline the
 * game — you level up by running experiments and killing bad ideas decisively,
 * not by hoarding open hypotheses.
 */
import type { Fleet } from "../monitor/fleet.js";

export interface Score {
  xp: number;
  level: number;
  rank: string;
  ksRatio: number;       // kill : ship
  discipline: string;    // qualitative label from ksRatio
  badges: string[];
}

const RANKS = [
  "Novice", "Apprentice", "Field Researcher", "Investigator",
  "Senior Investigator", "Principal", "Luminary",
];

const XP = { ship: 100, kill: 40, run: 15 } as const;

/** Level grows ~with the square root of XP, so early levels come fast. */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

export function computeScore(fleet: Fleet): Score {
  const { shipped, killed, running } = fleet;
  const xp = shipped * XP.ship + killed * XP.kill + running * XP.run;
  const level = levelForXp(xp);
  const rank = RANKS[Math.min(level - 1, RANKS.length - 1)];

  const ksRatio = shipped > 0 ? killed / shipped : killed;
  const discipline =
    killed + shipped === 0 ? "warming up" :
    ksRatio >= 5 ? "ruthless" :
    ksRatio >= 3 ? "disciplined" :
    ksRatio >= 1 ? "balanced" :
    "trigger-shy";

  const badges: string[] = [];
  if (shipped >= 1) badges.push("🏆");          // first ship
  if (killed >= 5) badges.push("🔪");           // serial killer
  if (shipped > 0 && ksRatio >= 3) badges.push("🎯"); // disciplined
  if (running > 0) badges.push("🚀");           // experiments in flight

  return { xp, level, rank, ksRatio, discipline, badges };
}

/** XP needed to reach the next level (for a progress hint). */
export function xpToNextLevel(xp: number): number {
  const next = levelForXp(xp) + 1;
  const needed = 50 * (next - 1) * (next - 1);
  return Math.max(0, needed - xp);
}
