import type { Kind } from "./engine.ts";
import { LEVELS, type Goal, type JellyPattern, type LevelDef } from "./levels.ts";
import { hashText, shiftById, type ShiftId } from "./shifts.ts";

const HOSPITAL: Kind[] = ["heart", "cross", "pill", "bandage", "nurse", "kit"];
const CLINIC: Kind[] = ["heart", "cross", "kit", "teddy", "diaper", "bottle"];
const PEDIATRIC: Kind[] = ["heart", "cross", "kit", "pacifier", "gift", "rattle"];

export interface WardRoll {
  level: LevelDef;
  seed: number;
  shiftId: ShiftId;
}

function wingKinds(id: number): Kind[] {
  if (id <= 5) return HOSPITAL;
  if (id <= 10) return CLINIC;
  return PEDIATRIC;
}

function otherWing(id: number, salt: number): Kind[] {
  const wings = [HOSPITAL, CLINIC, PEDIATRIC];
  const here = id <= 5 ? 0 : id <= 10 ? 1 : 2;
  return wings[(here + 1 + (salt % 2)) % wings.length]!;
}

function rngOf(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function bossOf(id: number): string | null {
  if (id === 5) return "Code Blue";
  if (id === 10) return "The Overflow";
  if (id === 15) return "Audit";
  return null;
}

function jellyFor(rng: () => number): JellyPattern {
  return pick(rng, ["bottom", "checker", "frame", "lower", "all"] as const);
}

function weighted(kinds: Kind[], scarce: Kind | null): Kind[] {
  if (!scarce) return kinds;
  const bag: Kind[] = [];
  for (const kind of kinds) {
    bag.push(kind);
    if (kind !== scarce) bag.push(kind);
  }
  return bag;
}

/** Tutorial wards stay scripted. Every later ward is rolled from the attempt seed. */
export function generateWard(id: number, seed: number, shiftId: ShiftId = "fully-staffed"): LevelDef {
  const base = LEVELS[id - 1] ?? LEVELS[0]!;
  if (id <= 2) {
    const shift = shiftById(shiftId);
    return { ...base, seed, shiftId: shift.id, shiftLabel: shift.label, boss: null, startSpecial: null };
  }

  const rng = rngOf(seed ^ (id * 997));
  const shift = shiftById(shiftId);
  const boss = bossOf(id);
  let kinds = wingKinds(id).slice();
  if (shift.id === "float-pool") kinds = otherWing(id, seed % 7).slice();
  if (shift.id === "visitor-hour" && !kinds.includes("gift")) kinds = [...kinds, "gift"];
  const kindCount = shift.id === "short-staffed" ? 4 : id < 8 ? 4 + (seed % 2) : 5;
  kinds = kinds.slice(0, Math.min(kinds.length, kindCount));

  let goals: Goal[];
  let jelly: JellyPattern = "none";
  let moves = 18 + Math.floor(id * 0.8) + Math.floor(rng() * 5);
  let name = base.name;

  if (boss === "Code Blue") {
    name = "Code Blue";
    goals = [{ type: "collect", kind: "heart", count: 16 + (seed % 5) }];
    moves -= 3;
  } else if (boss === "The Overflow") {
    name = "The Overflow";
    jelly = "lower";
    goals = [
      { type: "jelly" },
      { type: "collect", kind: kinds.includes("kit") ? "kit" : kinds[0]!, count: 10 + (seed % 4) },
    ];
    moves += 4;
  } else if (boss === "Audit") {
    name = "Audit";
    goals = [{ type: "score", target: 5200 + (seed % 8) * 250 }];
    moves -= 4;
  } else if (shift.id === "night-shift") {
    goals = [{ type: "score", target: 2800 + id * 180 + (seed % 6) * 200 }];
    moves -= 1;
  } else if (shift.id === "spill-risk") {
    jelly = jellyFor(rng);
    goals = [{ type: "jelly" }];
    if (rng() < 0.45) goals.push({ type: "collect", kind: pick(rng, kinds), count: 8 + (seed % 5) });
    moves += 4;
  } else {
    const family = seed % 5;
    if (family === 0) {
      goals = [{ type: "collect", kind: pick(rng, kinds), count: 12 + (id % 5) }];
    } else if (family === 1) {
      const a = pick(rng, kinds);
      const b = pick(rng, kinds.filter((kind) => kind !== a).concat(kinds));
      goals = [
        { type: "collect", kind: a, count: 8 + (seed % 4) },
        { type: "collect", kind: b, count: 8 + ((seed >> 3) % 4) },
      ];
    } else if (family === 2) {
      jelly = jellyFor(rng);
      goals = [{ type: "jelly" }];
      moves += 3;
    } else if (family === 3) {
      goals = [{ type: "score", target: 2400 + id * 160 }];
    } else {
      jelly = pick(rng, ["bottom", "checker", "lower"] as const);
      goals = [
        { type: "jelly" },
        { type: "collect", kind: pick(rng, kinds), count: 8 + (seed % 4) },
      ];
      moves += 5;
    }
  }

  if (shift.id === "short-staffed") moves -= 2;
  moves = clamp(moves, 16, 42);

  const scarce = shift.id === "supply-shortage" ? goalKind(goals) : null;
  const dealt = weighted(kinds, scarce);
  const star2 = Math.round(moves * (shift.id === "night-shift" ? 150 : 120));
  const star3 = Math.round(star2 * (shift.id === "night-shift" ? 1.55 : 1.45));

  return {
    id,
    name,
    rows: base.rows,
    cols: base.cols,
    kinds: dealt,
    moves,
    goals,
    star2,
    star3,
    jelly,
    seed,
    shiftId: shift.id,
    shiftLabel: shift.label,
    boss,
    startSpecial: shift.id === "in-service" ? pick(rng, ["row", "col", "bomb"] as const) : null,
  };
}

function goalKind(goals: Goal[]): Kind | null {
  const collect = goals.find((goal) => goal.type === "collect");
  return collect && collect.type === "collect" ? collect.kind : null;
}

export function previewSeed(levelId: number, day: string, clears: number): number {
  return hashText(`${levelId}|${day}|${clears}|sweetcare-ward`);
}

export function rollWard(id: number, seed: number, shiftId: ShiftId): WardRoll {
  return { level: generateWard(id, seed, shiftId), seed, shiftId };
}
