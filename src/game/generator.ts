import type { Kind } from "./engine.ts";
import { LEVELS, type Goal, type JellyPattern, type LevelDef } from "./levels.ts";
import { formatGrid, parseGrid, type CellSpec } from "./layout.ts";
import { SHAPES, shapesFor } from "./shapes.ts";
import { hashText, shiftById, type ShiftId } from "./shifts.ts";
import { targetRate, tune } from "./simulate.ts";

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

const cache = new Map<string, LevelDef>();

/**
 * Tutorial and boss wards stay scripted (a boss ward's emergency lives on its LevelDef). Every
 * other ward is rolled from the attempt seed, then tuned by the bot.
 */
export function generateWard(id: number, seed: number, shiftId: ShiftId = "fully-staffed"): LevelDef {
  const key = `${id}|${seed}|${shiftId}`;
  const hit = cache.get(key);
  if (hit) return structuredClone(hit);
  const level = rollWardDef(id, seed, shiftId);
  if (cache.size > 64) cache.clear();
  cache.set(key, level);
  return structuredClone(level);
}

function rollWardDef(id: number, seed: number, shiftId: ShiftId): LevelDef {
  const base = LEVELS[id - 1] ?? LEVELS[0]!;
  if (id <= 2 || base.bossHp) {
    const shift = shiftById(shiftId);
    return { ...base, seed, shiftId: shift.id, shiftLabel: shift.label, boss: base.boss ?? null, startSpecial: null };
  }

  const rng = rngOf(seed ^ (id * 997));
  const shift = shiftById(shiftId);
  let kinds = wingKinds(id).slice();
  if (shift.id === "float-pool") kinds = otherWing(id, seed % 7).slice();
  let kindCount = shift.id === "short-staffed" ? 4 : id < 6 ? 5 : id >= 11 && seed % 3 === 0 ? 6 : 5;
  if (shift.id === "visitor-hour") {
    kinds = ["gift", ...kinds.filter((kind) => kind !== "gift")];
    kindCount += 1;
  }
  kinds = kinds.slice(0, Math.min(kinds.length, kindCount));

  const shape = pick(rng, shapesFor(id));
  const cells = parseGrid(shape.grid, base.rows, base.cols);
  let goals: Goal[];
  let jelly: JellyPattern = "none";
  const name = base.name;
  let wraps = 0;

  if (shift.id === "night-shift") {
    goals = [{ type: "score", target: 7000 + id * 700 + (seed % 6) * 200 }];
  } else if (shift.id === "spill-risk") {
    jelly = jellyFor(rng);
    goals = [{ type: "jelly" }];
    if (rng() < 0.45) goals.push({ type: "collect", kind: pick(rng, kinds), count: 16 + (seed % 5) });
  } else {
    const family = id >= 7 ? seed % 6 : seed % 5;
    if (family === 0) {
      goals = [{ type: "collect", kind: pick(rng, kinds), count: 26 + id * 2 + (seed % 4) }];
    } else if (family === 1) {
      const a = pick(rng, kinds);
      const b = pick(rng, kinds.filter((kind) => kind !== a));
      goals = [
        { type: "collect", kind: a, count: 16 + id + (seed % 4) },
        { type: "collect", kind: b, count: 16 + id + ((seed >> 3) % 4) },
      ];
    } else if (family === 2) {
      jelly = jellyFor(rng);
      goals = [{ type: "jelly" }];
    } else if (family === 3) {
      goals = [{ type: "score", target: 6000 + id * 700 }];
    } else if (family === 4) {
      jelly = pick(rng, ["bottom", "checker", "lower"] as const);
      goals = [
        { type: "jelly" },
        { type: "collect", kind: pick(rng, kinds), count: 16 + id + (seed % 4) },
      ];
    } else {
      wraps = 6 + Math.floor(id / 2) + (seed % 3);
      goals = [{ type: "wraps" }];
      if (rng() < 0.5) goals.push({ type: "collect", kind: pick(rng, kinds), count: 14 + id + (seed % 4) });
    }
  }

  if (!wraps && id >= 9 && rng() < 0.4) wraps = 2 + (seed % 3);
  if (wraps) scatterWraps(cells, wraps, id >= 12 ? 0.35 : 0, rng);

  const scarce = shift.id === "supply-shortage" ? goalKind(goals) : null;
  const dealt = weighted(kinds, scarce);
  const startSpecial = shift.id === "in-service" ? pick(rng, ["row", "col", "bomb"] as const) : null;
  const draft: LevelDef = {
    id,
    name,
    rows: base.rows,
    cols: base.cols,
    kinds: dealt,
    moves: 30,
    goals,
    star2: 0,
    star3: 0,
    jelly,
    grid: formatGrid(cells),
    seed,
    shiftId: shift.id,
    shiftLabel: shift.label,
    boss: null,
    startSpecial,
  };
  let target = targetRate(id);
  if (shift.id === "short-staffed") target -= 0.08;
  const tuned = tune(draft, Math.max(0.4, target), 10, seed % 9973);
  const lift = shift.id === "night-shift" ? 1.12 : 1;
  return {
    ...draft,
    moves: tuned.moves,
    star2: Math.round(tuned.star2 * lift),
    star3: Math.round(tuned.star3 * lift),
  };
}

/** Wraps go in mirrored pairs so a board reads as designed, not sprinkled. */
function scatterWraps(cells: CellSpec[][], count: number, doubleChance: number, rng: () => number) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const spots: { r: number; c: number }[] = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 0; c < Math.ceil(cols / 2); c++) if (!cells[r]![c]!.hole) spots.push({ r, c });
  let placed = 0;
  for (let guard = 0; placed < count && guard < 80 && spots.length; guard++) {
    const spot = spots.splice(Math.floor(rng() * spots.length), 1)[0]!;
    const layers: 1 | 2 = rng() < doubleChance ? 2 : 1;
    const twin = { r: spot.r, c: cols - 1 - spot.c };
    for (const at of twin.c === spot.c ? [spot] : [spot, twin]) {
      const cell = cells[at.r]![at.c]!;
      if (cell.hole || cell.wrap) continue;
      cell.wrap = layers;
      placed += 1;
    }
  }
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
