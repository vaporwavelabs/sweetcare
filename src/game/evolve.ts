import { mulberry32, type Kind, type Power, type Rng } from "./engine.ts";
import { DEFAULT_FUSE, MAX_FUSE, MIN_FUSE, formatGrid, holeCell, parseGrid, plainCell, type CellSpec } from "./layout.ts";
import { makeJelly, type Goal, type LevelDef } from "./levels.ts";
import type { FeverRule } from "./mechanics.ts";
import { MAX_MOVES, MIN_MOVES, simulateOnce, tune, type RunResult } from "./simulate.ts";

/**
 * The level evolve engine.
 *
 * A level is a genome: its board layout (holes, jelly, wraps, starting powers, contagion, fever
 * tiles), its goals, its supplies and its fever outbreak rule. The engine keeps a small
 * population, breeds it with crossover and mutation, and scores every candidate by letting the
 * playtest bot in simulate.ts play it. Fitness rewards a level that:
 *
 * - lands on the asked bot win rate at a sensible move count,
 * - is tense: many runs finish within a few moves of the limit, either way,
 * - is fair: the moves a run needs do not swing wildly from seed to seed,
 * - uses about as many mechanics as asked (later wards ask for more),
 * - reads as designed (mirror symmetry).
 *
 * Every candidate in one evolve call is played on the same bot seeds, so two candidates are
 * compared on the same luck. The winner is retuned on fresh seeds before it is returned.
 */

export type Mechanic = "holes" | "jelly" | "wraps" | "powers" | "contagion" | "fever";

export const MECHANICS: Mechanic[] = ["holes", "jelly", "wraps", "powers", "contagion", "fever"];

export const MECHANIC_LABEL: Record<Mechanic, string> = {
  holes: "Holes",
  jelly: "Jelly",
  wraps: "Wraps",
  powers: "Starting powers",
  contagion: "Contagion",
  fever: "Fevers",
};

export interface EvolveOptions {
  /** Bot win rate to aim for, 0 to 1. */
  target: number;
  seed: number;
  population?: number;
  generations?: number;
  /** Bot runs per candidate. More is steadier and slower. */
  runs?: number;
  /** Mechanics the engine may add. Ones already on the start level can always be tuned or removed. */
  allow?: Mechanic[];
  /** How many distinct mechanics a good level should use. */
  complexity?: number;
  lockGoals?: boolean;
  lockKinds?: boolean;
  /** Supplies that may be swapped in when kinds are not locked. */
  kindPool?: readonly Kind[];
  maxHoles?: number;
  /** Mechanics to try introducing in the first generation. */
  introduce?: Mechanic[];
  /** Mechanics a level must keep. A candidate without one scores far lower. */
  require?: Mechanic[];
  /** Comfortable move range. Outside it fitness drops. */
  moveBand?: [number, number];
}

export interface Fitness {
  score: number;
  winRate: number;
  moves: number;
  star2: number;
  star3: number;
  /** Share of runs that finished within 3 moves of the limit, won or lost. */
  tension: number;
  /** Spread of the moves runs needed, relative to the median. Lower is fairer. */
  luck: number;
  /** Share of runs that never won, even with a long clock (stuck boards or burned fevers). */
  dud: number;
  mechanics: Mechanic[];
}

export interface Candidate {
  level: LevelDef;
  fitness: Fitness;
  /** What differs from the start level, in plain words. */
  changes: string[];
}

export interface EvolveProgress {
  generation: number;
  generations: number;
  evaluated: number;
  total: number;
  best: number;
}

export interface EvolveResult {
  start: Candidate;
  best: Candidate;
  /** Up to three distinct good levels, best first. The first is `best`. */
  top: Candidate[];
  /** Best fitness after each generation. */
  history: number[];
  evaluated: number;
}

type Opts = Required<Omit<EvolveOptions, "kindPool" | "introduce" | "require">> & { kindPool: readonly Kind[]; introduce: Mechanic[]; require: Mechanic[] };

function withDefaults(options: EvolveOptions): Opts {
  return {
    population: 8,
    generations: 6,
    runs: 8,
    allow: MECHANICS,
    complexity: 2,
    lockGoals: false,
    lockKinds: false,
    maxHoles: 12,
    moveBand: [16, 36],
    ...options,
    kindPool: options.kindPool ?? [],
    introduce: [...new Set([...(options.introduce ?? []), ...(options.require ?? [])])],
    require: options.require ?? [],
  };
}

/* ---------- genome helpers ---------- */

/** Folds a jelly pattern into the grid so every layer lives in one place. */
export function normalize(level: LevelDef): LevelDef {
  const cells = parseGrid(level.grid, level.rows, level.cols);
  const jelly = makeJelly(level);
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) if (jelly[r]![c] && !cells[r]![c]!.hole) cells[r]![c]!.jelly = true;
  return { ...structuredClone(level), jelly: "none", grid: formatGrid(cells), kinds: [...level.kinds], goals: structuredClone(level.goals) };
}

function cellsOf(level: LevelDef) {
  return parseGrid(level.grid, level.rows, level.cols);
}

interface Census {
  holes: number;
  open: number;
  jelly: number;
  wraps: number;
  powers: number;
  contagion: number;
  fevers: number;
}

function census(cells: CellSpec[][]): Census {
  const out: Census = { holes: 0, open: 0, jelly: 0, wraps: 0, powers: 0, contagion: 0, fevers: 0 };
  for (const row of cells) {
    for (const cell of row) {
      if (cell.hole) {
        out.holes += 1;
        continue;
      }
      out.open += 1;
      if (cell.jelly) out.jelly += 1;
      if (cell.wrap) out.wraps += cell.wrap;
      if (cell.special) out.powers += 1;
      if (cell.contagion) out.contagion += 1;
      if (cell.fuse) out.fevers += 1;
    }
  }
  return out;
}

export function mechanicsOf(level: LevelDef): Mechanic[] {
  const n = census(cellsOf(normalize(level)));
  const out: Mechanic[] = [];
  if (n.holes) out.push("holes");
  if (n.jelly) out.push("jelly");
  if (n.wraps) out.push("wraps");
  if (n.powers || level.startSpecial) out.push("powers");
  if (n.contagion) out.push("contagion");
  if (n.fevers || level.fever) out.push("fever");
  return out;
}

function symmetry(cells: CellSpec[][]): number {
  let same = 0;
  let total = 0;
  for (const row of cells) {
    for (let c = 0; c < Math.floor(row.length / 2); c++) {
      total += 1;
      const a = row[c]!;
      const b = row[row.length - 1 - c]!;
      if (a.hole === b.hole && a.jelly === b.jelly && a.wrap === b.wrap && a.contagion === b.contagion) same += 1;
    }
  }
  return total ? same / total : 1;
}

function signature(level: LevelDef): string {
  return JSON.stringify([level.grid, level.goals, level.kinds, level.fever ?? null, level.startSpecial ?? null]);
}

/* ---------- fitness ---------- */

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;
}

function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step);
}

/** Bot runs on a long clock, so each run tells how many moves it needed. Run `from` onwards. */
function playRuns(level: LevelDef, seed: number, from: number, count: number): RunResult[] {
  const long = { ...level, moves: MAX_MOVES + 20 };
  const results: RunResult[] = [];
  for (let i = from; i < from + count; i++) results.push(simulateOnce(long, (seed * 7919 + i * 104729) >>> 0));
  return results;
}

export function evaluate(level: LevelDef, options: EvolveOptions): Fitness {
  const opts = withDefaults(options);
  return fitnessOf(level, playRuns(level, opts.seed, 0, opts.runs), opts);
}

function fitnessOf(level: LevelDef, results: RunResult[], opts: Opts): Fitness {
  const needed = results.map((run) => (run.won ? run.used : Infinity)).sort((a, b) => a - b);
  const n = needed.length;
  const at = Math.min(n - 1, Math.max(0, Math.ceil(opts.target * n) - 1));
  const raw = needed[at]!;
  const moves = Math.max(MIN_MOVES, Math.min(MAX_MOVES, Number.isFinite(raw) ? raw : MAX_MOVES));
  const winRate = needed.filter((need) => need <= moves).length / n;
  const finite = needed.filter(Number.isFinite);
  const dud = (n - finite.length) / n;
  const tension = needed.filter((need) => Number.isFinite(need) && Math.abs(need - moves) <= 3).length / n;
  const median = quantile(finite, 0.5) || moves;
  const luck = finite.length >= 2 ? (quantile(finite, 0.75) - quantile(finite, 0.25)) / Math.max(1, median) : 1;

  const winners = results.filter((run) => run.won && run.used <= moves);
  const scores = winners.map((run) => run.goalScore + (moves - run.used) * 100).sort((a, b) => a - b);
  const star2 = roundTo(quantile(scores, 0.5), 50);
  const star3 = Math.max(star2 + 150, roundTo(quantile(scores, 0.85), 50));

  const mechanics = mechanicsOf(level);
  const [lo, hi] = opts.moveBand;
  const pacing = moves < lo ? Math.max(0, 1 - (lo - moves) * 0.1) : moves > hi ? Math.max(0, 1 - (moves - hi) * 0.08) : 1;
  const onTarget = 1 - Math.min(1, Math.abs(winRate - opts.target) * 3);
  const fair = 1 - Math.min(1, Math.max(0, luck - 0.3) * 1.5);
  const variety = 1 - Math.min(1, Math.abs(mechanics.length - opts.complexity) * 0.3);
  const shape = symmetry(cellsOf(level));
  // Runs that can never win (a fever burned, or the board stalled) cap the win rate whatever the
  // clock says, so a few are fine and many sink the level.
  const stuck = Math.max(0, dud - 0.5 * (1 - opts.target)) * 1.2;
  const missing = opts.require.filter((mechanic) => !mechanics.includes(mechanic)).length;
  const score = 0.3 * onTarget + 0.2 * pacing + 0.2 * tension + 0.12 * fair + 0.12 * variety + 0.06 * shape - 0.8 * stuck - 0.3 * missing;
  return { score: Math.round(score * 1000) / 1000, winRate, moves, star2, star3, tension, luck, dud, mechanics };
}

/* ---------- mutation ---------- */

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function int(rng: Rng, lo: number, hi: number) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

interface Spot {
  r: number;
  c: number;
}

function spots(cells: CellSpec[][], test: (cell: CellSpec, r: number, c: number) => boolean): Spot[] {
  const out: Spot[] = [];
  cells.forEach((row, r) => row.forEach((cell, c) => test(cell, r, c) && out.push({ r, c })));
  return out;
}

/** The spot and, with a mirror, its twin across the middle column. */
function withTwin(cells: CellSpec[][], at: Spot, mirror: boolean): Spot[] {
  const cols = cells[0]?.length ?? 0;
  const twin = { r: at.r, c: cols - 1 - at.c };
  return mirror && twin.c !== at.c ? [at, twin] : [at];
}

type Op = (level: LevelDef, cells: CellSpec[][], rng: Rng, opts: Opts) => boolean;

function allowed(level: LevelDef, opts: Opts, mechanic: Mechanic) {
  return opts.allow.includes(mechanic) || mechanicsOf(level).includes(mechanic);
}

const toggleHole: Op = (level, cells, rng, opts) => {
  if (!allowed(level, opts, "holes")) return false;
  const n = census(cells);
  const carve = n.holes < opts.maxHoles && (n.holes === 0 || rng() < 0.55);
  const mirror = rng() < 0.8;
  if (carve) {
    const options = spots(cells, (cell) => !cell.hole);
    if (!options.length) return false;
    const group = withTwin(cells, pick(rng, options), mirror);
    if (n.holes + group.length > opts.maxHoles || n.open - group.length < Math.max(16, Math.ceil(n.open * 0.6))) return false;
    // Never leave a column with no open cell.
    const carved = new Set(group.map((at) => `${at.r},${at.c}`));
    for (let c = 0; c < (cells[0]?.length ?? 0); c++) if (cells.every((row, r) => row[c]!.hole || carved.has(`${r},${c}`))) return false;
    for (const at of group) cells[at.r]![at.c] = holeCell();
    return true;
  }
  const holes = spots(cells, (cell) => cell.hole);
  if (!holes.length) return false;
  for (const at of withTwin(cells, pick(rng, holes), mirror)) cells[at.r]![at.c] = plainCell();
  return true;
};

const shiftJelly: Op = (level, cells, rng, opts) => {
  if (!allowed(level, opts, "jelly")) return false;
  const n = census(cells);
  // Jelly nobody has to clear is only decoration, so new jelly comes with its goal.
  const wanted = level.goals.some((goal) => goal.type === "jelly");
  if (!wanted && (opts.lockGoals || level.goals.length >= 3)) return false;
  if (n.jelly === 0 || rng() < 0.6) {
    if (!wanted) level.goals.push({ type: "jelly" });
    const seed = pick(rng, spots(cells, (cell) => !cell.hole && !cell.jelly).concat({ r: 0, c: 0 }));
    let added = 0;
    for (const at of withTwin(cells, seed, true)) {
      for (const d of [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 0, c: 1 }]) {
        const cell = cells[at.r + d.r]?.[at.c + d.c];
        if (cell && !cell.hole && !cell.jelly) {
          cell.jelly = true;
          added += 1;
        }
      }
    }
    return added > 0;
  }
  const jelly = spots(cells, (cell) => cell.jelly);
  for (const at of withTwin(cells, pick(rng, jelly), true)) cells[at.r]![at.c]!.jelly = false;
  return true;
};

const shiftWraps: Op = (level, cells, rng, opts) => {
  if (!allowed(level, opts, "wraps")) return false;
  const n = census(cells);
  const roll = rng();
  if (n.wraps === 0 || roll < 0.5) {
    const options = spots(cells, (cell, r) => !cell.hole && !cell.wrap && !cell.fuse && r > 0);
    if (!options.length) return false;
    for (const at of withTwin(cells, pick(rng, options), true)) {
      const cell = cells[at.r]![at.c]!;
      if (!cell.fuse) cell.wrap = 1;
    }
    return true;
  }
  const wrapped = spots(cells, (cell) => cell.wrap > 0);
  const at = pick(rng, wrapped);
  const cell = cells[at.r]![at.c]!;
  if (roll < 0.75 && cell.wrap === 1) cell.wrap = 2;
  else cell.wrap = 0;
  return true;
};

const shiftPowers: Op = (level, cells, rng, opts) => {
  if (!allowed(level, opts, "powers")) return false;
  const placed = spots(cells, (cell) => Boolean(cell.special));
  if (placed.length && rng() < 0.5) {
    const at = pick(rng, placed);
    cells[at.r]![at.c]!.special = null;
    return true;
  }
  if (placed.length >= 2) return false;
  const options = spots(cells, (cell) => !cell.hole && !cell.special && !cell.wrap);
  if (!options.length) return false;
  const at = pick(rng, options);
  cells[at.r]![at.c]!.special = pick<Power>(rng, ["row", "col", "bomb"]);
  return true;
};

const shiftContagion: Op = (level, cells, rng, opts) => {
  if (!allowed(level, opts, "contagion")) return false;
  const n = census(cells);
  if (n.contagion === 0 || (rng() < 0.55 && n.contagion * 4 < n.open)) {
    const options = spots(cells, (cell) => !cell.hole && !cell.contagion);
    if (!options.length) return false;
    for (const at of withTwin(cells, pick(rng, options), rng() < 0.7)) cells[at.r]![at.c]!.contagion = true;
    return true;
  }
  const infected = spots(cells, (cell) => cell.contagion);
  const at = pick(rng, infected);
  cells[at.r]![at.c]!.contagion = false;
  return true;
};

const shiftFever: Op = (level, cells, rng, opts) => {
  if (!allowed(level, opts, "fever")) return false;
  const tiles = spots(cells, (cell) => cell.fuse > 0);
  const roll = rng();
  if (roll < 0.3) {
    // Outbreak rule: add, retime, or remove.
    if (!level.fever) level.fever = { every: int(rng, 4, 8), fuse: int(rng, 7, 12) };
    else if (rng() < 0.3 && tiles.length) level.fever = null;
    else level.fever = { every: Math.max(3, Math.min(12, level.fever.every + pick(rng, [-1, 1]))), fuse: Math.max(MIN_FUSE + 2, Math.min(MAX_FUSE, level.fever.fuse + pick(rng, [-2, -1, 1, 2]))) };
    return true;
  }
  if (tiles.length && roll < 0.55) {
    const at = pick(rng, tiles);
    const cell = cells[at.r]![at.c]!;
    cell.fuse = rng() < 0.3 ? 0 : Math.max(MIN_FUSE + 2, Math.min(MAX_FUSE, cell.fuse + pick(rng, [-2, -1, 1, 2])));
    return true;
  }
  if (tiles.length >= 4) return false;
  const options = spots(cells, (cell) => !cell.hole && !cell.wrap && !cell.fuse && !cell.special);
  if (!options.length) return false;
  const at = pick(rng, options);
  cells[at.r]![at.c]!.fuse = int(rng, 6, 12);
  return true;
};

const tweakGoal: Op = (level, _cells, rng, opts) => {
  if (opts.lockGoals || !level.goals.length) return false;
  const i = Math.floor(rng() * level.goals.length);
  const goal = level.goals[i]!;
  const scale = pick(rng, [0.8, 0.9, 1.1, 1.2]);
  if (goal.type === "collect") level.goals[i] = { ...goal, count: Math.max(6, Math.min(80, Math.round(goal.count * scale))) };
  else if (goal.type === "score") level.goals[i] = { ...goal, target: Math.max(2000, Math.round((goal.target * scale) / 500) * 500) };
  else if (goal.type === "fevers") level.goals[i] = { ...goal, count: Math.max(1, Math.min(20, goal.count + pick(rng, [-1, 1, 2]))) };
  else return false;
  return true;
};

const swapGoal: Op = (level, cells, rng, opts) => {
  if (opts.lockGoals) return false;
  const n = census(cells);
  const options: Goal[] = [{ type: "collect", kind: pick(rng, level.kinds), count: int(rng, 14, 30) }];
  if (n.jelly) options.push({ type: "jelly" });
  if (n.wraps) options.push({ type: "wraps" });
  if (n.contagion) options.push({ type: "contagion" });
  if (n.fevers || level.fever) options.push({ type: "fevers", count: Math.max(1, n.fevers + (level.fever ? 2 : 0)) });
  const next = pick(rng, options);
  if (level.goals.some((goal) => goal.type === next.type && (goal.type !== "collect" || (next.type === "collect" && goal.kind === next.kind)))) return false;
  if (level.goals.length < 3 && (level.goals.length === 1 || rng() < 0.35)) level.goals.push(next);
  else if (level.goals.length > 1 && rng() < 0.3) level.goals.splice(Math.floor(rng() * level.goals.length), 1);
  else level.goals[Math.floor(rng() * level.goals.length)] = next;
  return true;
};

const shiftKinds: Op = (level, _cells, rng, opts) => {
  if (opts.lockKinds) return false;
  const pool = opts.kindPool.filter((kind) => !level.kinds.includes(kind));
  const roll = rng();
  if (roll < 0.45 && pool.length) {
    level.kinds[Math.floor(rng() * level.kinds.length)] = pick(rng, pool);
  } else if (roll < 0.7 && pool.length && level.kinds.length < 7) {
    level.kinds.push(pick(rng, pool));
  } else if (level.kinds.length > 4) {
    level.kinds.splice(Math.floor(rng() * level.kinds.length), 1);
  } else return false;
  return true;
};

const OPS: { op: Op; weight: number }[] = [
  { op: toggleHole, weight: 3 },
  { op: shiftJelly, weight: 2 },
  { op: shiftWraps, weight: 2 },
  { op: shiftPowers, weight: 1 },
  { op: shiftContagion, weight: 2 },
  { op: shiftFever, weight: 2 },
  { op: tweakGoal, weight: 3 },
  { op: swapGoal, weight: 2 },
  { op: shiftKinds, weight: 1 },
];

const OP_FOR: Record<Mechanic, Op> = {
  holes: toggleHole,
  jelly: shiftJelly,
  wraps: shiftWraps,
  powers: shiftPowers,
  contagion: shiftContagion,
  fever: shiftFever,
};

function mutate(level: LevelDef, rng: Rng, opts: Opts, count: number): LevelDef {
  const next = structuredClone(level);
  const cells = cellsOf(next);
  const total = OPS.reduce((sum, item) => sum + item.weight, 0);
  let done = 0;
  for (let guard = 0; done < count && guard < count * 8; guard++) {
    let roll = rng() * total;
    const chosen = OPS.find((item) => (roll -= item.weight) < 0) ?? OPS[0]!;
    if (chosen.op(next, cells, rng, opts)) done += 1;
  }
  next.grid = formatGrid(cells);
  return repair(next, rng, opts);
}

/** Brings in a mechanic the level does not have yet, with a goal for it about half the time. */
function introduce(level: LevelDef, mechanic: Mechanic, rng: Rng, opts: Opts): LevelDef {
  const next = structuredClone(level);
  const cells = cellsOf(next);
  const op = OP_FOR[mechanic];
  for (let i = 0; i < 3; i++) op(next, cells, rng, { ...opts, allow: [...opts.allow, mechanic] });
  next.grid = formatGrid(cells);
  if (!opts.lockGoals && rng() < 0.5) {
    const n = census(cells);
    const goal: Goal | null =
      mechanic === "contagion" && n.contagion ? { type: "contagion" } :
      mechanic === "fever" && (n.fevers || next.fever) ? { type: "fevers", count: Math.max(2, n.fevers + 1) } :
      mechanic === "jelly" && n.jelly ? { type: "jelly" } :
      mechanic === "wraps" && n.wraps ? { type: "wraps" } : null;
    if (goal && !next.goals.some((item) => item.type === goal.type)) {
      if (next.goals.length >= 3) next.goals[next.goals.length - 1] = goal;
      else next.goals.push(goal);
    }
  }
  return repair(next, rng, opts);
}

function crossover(a: LevelDef, b: LevelDef, rng: Rng): LevelDef {
  const ca = cellsOf(a);
  const cb = cellsOf(b);
  const cut = 1 + Math.floor(rng() * Math.max(1, a.rows - 1));
  const cells = ca.map((row, r) => (r < cut ? row : cb[r] ?? row).map((cell) => ({ ...cell })));
  const head = rng() < 0.5 ? a : b;
  return { ...structuredClone(head), grid: formatGrid(cells), fever: structuredClone(rng() < 0.5 ? a.fever : b.fever) ?? null };
}

/** Makes every goal winnable and keeps the board inside the rules after blind edits. */
export function repair(level: LevelDef, rng: Rng, options: EvolveOptions): LevelDef {
  const opts = withDefaults(options);
  const cells = cellsOf(level);
  for (const row of cells) for (const cell of row) if (cell.wrap) cell.fuse = 0;
  const n = census(cells);
  const kinds = [...new Set(level.kinds)];
  const goals: Goal[] = [];
  for (const goal of level.goals) {
    let next: Goal | null = goal;
    if (goal.type === "collect" && !kinds.includes(goal.kind)) next = { ...goal, kind: pick(rng, kinds) };
    if (goal.type === "jelly" && n.jelly < 3) next = null;
    if (goal.type === "wraps" && n.wraps < 1) next = null;
    if (goal.type === "contagion" && n.contagion < 1) next = null;
    if (goal.type === "fevers") {
      const supply = n.fevers + (level.fever ? 99 : 0);
      next = supply < 1 ? null : { ...goal, count: Math.min(goal.count, supply) };
    }
    if (!next) continue;
    const same = goals.some((item) => item.type === next.type && (item.type !== "collect" || (next.type === "collect" && item.kind === next.kind)));
    if (!same) goals.push(next);
  }
  if (opts.lockGoals && goals.length !== level.goals.length) return { ...level, goals: level.goals };
  if (!goals.length) goals.push({ type: "collect", kind: kinds[0]!, count: 20 });
  return { ...level, goals: goals.slice(0, 3), grid: formatGrid(cells) };
}

/* ---------- describing a change ---------- */

function goalText(goal: Goal): string {
  if (goal.type === "collect") return `collect ${goal.count} ${goal.kind}`;
  if (goal.type === "score") return `score ${goal.target}`;
  if (goal.type === "jelly") return "clear jelly";
  if (goal.type === "wraps") return "unwrap all";
  if (goal.type === "contagion") return "disinfect";
  return `treat ${goal.count} fevers`;
}

export function describeChanges(from: LevelDef, to: LevelDef): string[] {
  const a = census(cellsOf(normalize(from)));
  const b = census(cellsOf(normalize(to)));
  const out: string[] = [];
  const delta = (label: string, x: number, y: number) => {
    if (y > x) out.push(`+${y - x} ${label}`);
    else if (y < x) out.push(`−${x - y} ${label}`);
  };
  delta("holes", a.holes, b.holes);
  delta("jelly", a.jelly, b.jelly);
  delta("wraps", a.wraps, b.wraps);
  delta("powers", a.powers, b.powers);
  delta("contagion", a.contagion, b.contagion);
  delta("fever tiles", a.fevers, b.fevers);
  const fa = from.fever ? `${from.fever.every}/${from.fever.fuse}` : "";
  const fb = to.fever ? `${to.fever.every}/${to.fever.fuse}` : "";
  if (fa !== fb) out.push(to.fever ? `fever outbreak every ${to.fever.every} moves (${to.fever.fuse} to burn)` : "no fever outbreaks");
  const ga = from.goals.map(goalText).join(", ");
  const gb = to.goals.map(goalText).join(", ");
  if (ga !== gb) out.push(`goals: ${gb}`);
  const added = to.kinds.filter((kind) => !from.kinds.includes(kind));
  const dropped = from.kinds.filter((kind) => !to.kinds.includes(kind));
  if (added.length) out.push(`+ ${[...new Set(added)].join(", ")}`);
  if (dropped.length) out.push(`− ${[...new Set(dropped)].join(", ")}`);
  if (from.moves !== to.moves) out.push(`${to.moves} moves`);
  return out;
}

/* ---------- the search ---------- */

function finalize(level: LevelDef, fitness: Fitness): LevelDef {
  return { ...level, moves: fitness.moves, star2: fitness.star2, star3: fitness.star3 };
}

/**
 * The search as a generator: it yields after each candidate is played, so a caller can spread
 * the work over frames. `evolve` and `evolveAsync` drive it.
 */
export function* evolveSteps(startLevel: LevelDef, options: EvolveOptions): Generator<EvolveProgress, EvolveResult> {
  const opts = withDefaults(options);
  const rng = mulberry32((opts.seed ^ 0x9e3779b9) >>> 0);
  const seen = new Map<string, Fitness>();
  const samples = new Map<string, RunResult[]>();
  const total = opts.population * (opts.generations + 1) + opts.generations * 2;
  let evaluated = 0;
  let bestScore = -Infinity;
  let generation = 0;

  function* score(level: LevelDef): Generator<EvolveProgress, Candidate> {
    const key = signature(level);
    let fitness = seen.get(key);
    if (!fitness) {
      const results = playRuns(level, opts.seed, 0, opts.runs);
      samples.set(key, results);
      fitness = fitnessOf(level, results, opts);
      seen.set(key, fitness);
      evaluated += 1;
      bestScore = Math.max(bestScore, fitness.score);
      yield { generation, generations: opts.generations, evaluated, total, best: bestScore };
    }
    return { level, fitness, changes: [] };
  }

  const origin = repair(normalize(startLevel), rng, opts);
  const start = yield* score(origin);
  let population: Candidate[] = [start];
  const fresh = opts.introduce.filter((mechanic) => !start.fitness.mechanics.includes(mechanic));
  while (population.length < opts.population) {
    const i = population.length;
    const child = fresh.length && i % 2 === 1 ? introduce(origin, fresh[(i >> 1) % fresh.length]!, rng, opts) : mutate(origin, rng, opts, 1 + Math.floor(rng() * 3));
    population.push(yield* score(child));
  }
  const history: number[] = [Math.max(...population.map((item) => item.fitness.score))];

  const tournament = () => {
    const a = pick(rng, population);
    const b = pick(rng, population);
    return a.fitness.score >= b.fitness.score ? a : b;
  };

  /**
   * The leaders get played again on new seeds each generation, so a level that only looked good
   * on lucky seeds sinks back once it has more runs behind it.
   */
  function* resample(item: Candidate): Generator<EvolveProgress, Candidate> {
    const key = signature(item.level);
    const have = samples.get(key) ?? [];
    if (have.length >= opts.runs * 4) return item;
    const more = [...have, ...playRuns(item.level, opts.seed, have.length, opts.runs)];
    samples.set(key, more);
    const fitness = fitnessOf(item.level, more, opts);
    seen.set(key, fitness);
    evaluated += 1;
    yield { generation, generations: opts.generations, evaluated, total, best: bestScore };
    return { ...item, fitness };
  }

  for (generation = 1; generation <= opts.generations; generation++) {
    population.sort((a, b) => b.fitness.score - a.fitness.score);
    for (let i = 0; i < Math.min(2, population.length); i++) population[i] = yield* resample(population[i]!);
    population.sort((a, b) => b.fitness.score - a.fitness.score);
    const next: Candidate[] = population.slice(0, 2);
    let guard = 0;
    while (next.length < opts.population && guard++ < opts.population * 6) {
      const mum = tournament();
      const dad = tournament();
      const base = mum !== dad && rng() < 0.5 ? repair(crossover(mum.level, dad.level, rng), rng, opts) : mum.level;
      const child = mutate(base, rng, opts, 1 + Math.floor(rng() * 2));
      if (next.some((item) => signature(item.level) === signature(child))) continue;
      next.push(yield* score(child));
    }
    population = next;
    history.push(Math.max(...population.map((item) => item.fitness.score)));
  }

  // The start level competes in the final too, so evolving never hands back something worse.
  if (!population.some((item) => signature(item.level) === signature(start.level))) population.push({ ...start, fitness: seen.get(signature(start.level)) ?? start.fitness });
  population.sort((a, b) => b.fitness.score - a.fitness.score);
  for (let i = 0; i < Math.min(3, population.length); i++) population[i] = yield* resample(population[i]!);
  // The final population, best first, skipping near copies.
  const ranked: Candidate[] = [];
  for (const item of population.sort((a, b) => b.fitness.score - a.fitness.score)) {
    if (ranked.length >= 3) break;
    if (ranked.some((other) => similar(other.level, item.level))) continue;
    ranked.push(item);
  }
  if (!ranked.length) ranked.push(start);

  // Retune the finalists on fresh seeds so their moves and stars are not fitted to the search luck.
  const top = ranked.map((item) => {
    const tuned = tune(item.level, opts.target, Math.max(16, opts.runs * 2), (opts.seed + 7717) % 9973);
    const level = finalize(item.level, { ...item.fitness, moves: tuned.moves, star2: tuned.star2, star3: tuned.star3 });
    return { level, fitness: { ...item.fitness, moves: tuned.moves, star2: tuned.star2, star3: tuned.star3, winRate: tuned.winRate }, changes: describeChanges(startLevel, level) };
  });
  const startFit = seen.get(signature(start.level)) ?? start.fitness;
  const startOut = { ...start, fitness: startFit, level: finalize(start.level, startFit), changes: [] };
  return { start: startOut, best: top[0]!, top, history, evaluated };
}

/** Two levels count as the same pick if their boards differ in under three cells and their goals match. */
function similar(a: LevelDef, b: LevelDef): boolean {
  if (JSON.stringify(a.goals) !== JSON.stringify(b.goals) || JSON.stringify(a.fever ?? null) !== JSON.stringify(b.fever ?? null)) return false;
  const ga = a.grid ?? [];
  const gb = b.grid ?? [];
  let diff = 0;
  for (let r = 0; r < Math.max(ga.length, gb.length); r++) {
    const ta = (ga[r] ?? "").split(" ");
    const tb = (gb[r] ?? "").split(" ");
    for (let c = 0; c < Math.max(ta.length, tb.length); c++) if (ta[c] !== tb[c]) diff += 1;
  }
  return diff < 3;
}

export function evolve(start: LevelDef, options: EvolveOptions): EvolveResult {
  const steps = evolveSteps(start, options);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/** Runs the search in short slices so a page stays responsive. Same result as evolve(). */
export function evolveAsync(
  start: LevelDef,
  options: EvolveOptions,
  onProgress?: (progress: EvolveProgress) => void,
  signal?: { cancelled: boolean },
  sliceMs = 14,
): Promise<EvolveResult | null> {
  return new Promise((resolve, reject) => {
    const steps = evolveSteps(start, options);
    const tick = () => {
      if (signal?.cancelled) return resolve(null);
      const until = Date.now() + sliceMs;
      try {
        for (;;) {
          const next = steps.next();
          if (next.done) return resolve(next.value);
          onProgress?.(next.value);
          if (Date.now() >= until) break;
        }
      } catch (error) {
        return reject(error);
      }
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  });
}

/* ---------- campaign wards ---------- */

/**
 * What the evolve engine may use on a campaign ward. Mechanics arrive in step with the map:
 * the hospital wing tunes what it has, the clinic adds holes and contagion, the pediatric wing
 * adds fevers. Later wards also ask for more mechanics at once.
 */
export function wardPlan(id: number): Pick<EvolveOptions, "allow" | "complexity" | "maxHoles" | "introduce" | "require"> {
  if (id < 6) return { allow: ["jelly", "wraps", "powers"], complexity: 1, maxHoles: 0, introduce: [], require: [] };
  if (id < 11) return { allow: ["holes", "jelly", "wraps", "powers", "contagion"], complexity: 2, maxHoles: 4, introduce: [], require: ["contagion"] };
  return { allow: MECHANICS, complexity: 3, maxHoles: 10, introduce: ["contagion"], require: ["fever"] };
}

export { DEFAULT_FUSE };
export type { FeverRule };
