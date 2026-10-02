import { type Kind, emptyCollected, type Pos } from "./engine.ts";

export type JellyPattern = "none" | "bottom" | "checker" | "frame" | "all" | "lower";

export type Goal =
  | { type: "score"; target: number }
  | { type: "collect"; kind: Kind; count: number }
  | { type: "jelly" };

export interface LevelDef {
  id: number;
  name: string;
  rows: number;
  cols: number;
  kinds: Kind[];
  moves: number;
  goals: Goal[];
  star2: number;
  star3: number;
  jelly: JellyPattern;
}

const HOSPITAL: Kind[] = ["heart", "cross", "pill", "bandage", "nurse", "kit"];
const CLINIC: Kind[] = ["heart", "cross", "kit", "teddy", "diaper", "bottle"];
const PEDIATRIC: Kind[] = ["heart", "cross", "kit", "pacifier", "gift", "rattle"];

function longer(n: number) {
  return Math.ceil(n * 1.15);
}

export const LEVELS: LevelDef[] = [
  { id: 1, name: "Sweet Start", rows: 6, cols: 6, kinds: HOSPITAL.slice(0, 4), moves: longer(22), goals: [{ type: "collect", kind: "heart", count: longer(12) }], star2: longer(1600), star3: longer(2800), jelly: "none" },
  { id: 2, name: "Patch Job", rows: 6, cols: 6, kinds: HOSPITAL.slice(0, 4), moves: longer(22), goals: [{ type: "collect", kind: "bandage", count: longer(12) }], star2: longer(1600), star3: longer(2800), jelly: "none" },
  { id: 3, name: "Capsule Run", rows: 6, cols: 6, kinds: HOSPITAL.slice(0, 5), moves: longer(22), goals: [{ type: "collect", kind: "pill", count: longer(12) }], star2: longer(1700), star3: longer(3000), jelly: "none" },
  { id: 4, name: "Red Cross", rows: 6, cols: 6, kinds: HOSPITAL.slice(0, 5), moves: longer(22), goals: [{ type: "collect", kind: "cross", count: longer(12) }], star2: longer(1700), star3: longer(3000), jelly: "none" },
  { id: 5, name: "Night Nurse", rows: 6, cols: 6, kinds: HOSPITAL.slice(0, 5), moves: longer(20), goals: [{ type: "collect", kind: "nurse", count: longer(10) }], star2: longer(1800), star3: longer(3200), jelly: "none" },
  { id: 6, name: "Teddy Trail", rows: 6, cols: 6, kinds: CLINIC, moves: longer(22), goals: [{ type: "collect", kind: "teddy", count: longer(10) }], star2: longer(1800), star3: longer(3200), jelly: "none" },
  { id: 7, name: "Diaper Duty", rows: 6, cols: 6, kinds: CLINIC.slice(0, 5), moves: longer(28), goals: [{ type: "jelly" }], star2: longer(1800), star3: longer(3200), jelly: "bottom" },
  { id: 8, name: "Bottle Check", rows: 6, cols: 6, kinds: CLINIC.slice(0, 5), moves: longer(32), goals: [{ type: "jelly" }], star2: longer(2000), star3: longer(3600), jelly: "checker" },
  { id: 9, name: "Score Sprint", rows: 6, cols: 6, kinds: CLINIC, moves: longer(20), goals: [{ type: "score", target: longer(3500) }], star2: longer(4500), star3: longer(6200), jelly: "none" },
  { id: 10, name: "Heart Surge", rows: 6, cols: 6, kinds: CLINIC, moves: longer(26), goals: [{ type: "collect", kind: "heart", count: longer(14) }], star2: longer(2200), star3: longer(3800), jelly: "none" },
  { id: 11, name: "Picture Frame", rows: 6, cols: 6, kinds: PEDIATRIC, moves: longer(32), goals: [{ type: "jelly" }], star2: longer(2000), star3: longer(3600), jelly: "frame" },
  { id: 12, name: "Pacifier Gifts", rows: 6, cols: 6, kinds: PEDIATRIC, moves: longer(26), goals: [{ type: "collect", kind: "pacifier", count: longer(14) }, { type: "collect", kind: "gift", count: longer(14) }], star2: longer(2400), star3: longer(4000), jelly: "none" },
  { id: 13, name: "Sticky Ward", rows: 6, cols: 6, kinds: PEDIATRIC.slice(0, 5), moves: longer(36), goals: [{ type: "jelly" }], star2: longer(2400), star3: longer(4200), jelly: "all" },
  { id: 14, name: "Night Shift", rows: 6, cols: 6, kinds: PEDIATRIC, moves: longer(22), goals: [{ type: "score", target: longer(5500) }], star2: longer(6800), star3: longer(8600), jelly: "none" },
  { id: 15, name: "First Aid Rescue", rows: 6, cols: 6, kinds: PEDIATRIC, moves: longer(36), goals: [{ type: "jelly" }, { type: "collect", kind: "kit", count: longer(10) }], star2: longer(3200), star3: longer(5200), jelly: "lower" },
];

export const HOSPITAL_KINDS = HOSPITAL;

export interface MapSpot {
  id: number;
  x: number;
  y: number;
}

/** Pins on the island, in percent of the map image. */
export const MAP_SPOTS: MapSpot[] = [
  { id: 1, x: 24, y: 44 },
  { id: 2, x: 31, y: 56 },
  { id: 3, x: 37, y: 48 },
  { id: 4, x: 43, y: 57 },
  { id: 5, x: 49, y: 46 },
  { id: 6, x: 56, y: 38 },
  { id: 7, x: 61, y: 50 },
  { id: 8, x: 66, y: 42 },
  { id: 9, x: 70, y: 52 },
  { id: 10, x: 74, y: 44 },
  { id: 11, x: 83, y: 46 },
  { id: 12, x: 77, y: 58 },
  { id: 13, x: 87, y: 58 },
  { id: 14, x: 70, y: 68 },
  { id: 15, x: 79, y: 74 },
];

export function journeyFor(levelId: number): { fromX: number; fromY: number; toX: number; toY: number; title: string } | null {
  if (levelId === 1) return { fromX: 16, fromY: 80, toX: 24, toY: 44, title: "Heading to the hospital" };
  if (levelId === 6) return { fromX: 24, fromY: 44, toX: 56, toY: 38, title: "Heading to the clinic" };
  if (levelId === 11) return { fromX: 56, fromY: 38, toX: 83, toY: 46, title: "Heading to the pediatric clinic" };
  return null;
}

export function getLevel(id: number): LevelDef {
  return LEVELS[id - 1] ?? LEVELS[0]!;
}

export function makeJelly(level: LevelDef): boolean[][] {
  const grid = Array.from({ length: level.rows }, () => Array<boolean>(level.cols).fill(false));
  if (level.jelly === "none") return grid;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (level.jelly === "all") grid[r]![c] = true;
      else if (level.jelly === "bottom") grid[r]![c] = r >= level.rows - 3;
      else if (level.jelly === "lower") grid[r]![c] = r >= Math.floor(level.rows / 2);
      else if (level.jelly === "checker") grid[r]![c] = (r + c) % 2 === 0;
      else if (level.jelly === "frame") {
        grid[r]![c] = r === 0 || c === 0 || r === level.rows - 1 || c === level.cols - 1;
      }
    }
  }
  return grid;
}

export function countJelly(jelly: boolean[][]): number {
  let n = 0;
  for (const row of jelly) for (const cell of row) if (cell) n += 1;
  return n;
}

export interface Progress {
  score: number;
  collected: Record<Kind, number>;
  jellyLeft: number;
}

export function goalsMet(level: LevelDef, progress: Progress): boolean {
  return level.goals.every((goal) => {
    if (goal.type === "score") return progress.score >= goal.target;
    if (goal.type === "collect") return progress.collected[goal.kind] >= goal.count;
    return progress.jellyLeft === 0;
  });
}

export function starsFor(level: LevelDef, score: number, won: boolean): number {
  if (!won) return 0;
  if (score >= level.star3) return 3;
  if (score >= level.star2) return 2;
  return 1;
}

export function goalFraction(level: LevelDef, progress: Progress, jellyTotal: number): number {
  if (!level.goals.length) return 0;
  const parts = level.goals.map((goal) => {
    if (goal.type === "score") return Math.min(1, progress.score / goal.target);
    if (goal.type === "collect") return Math.min(1, progress.collected[goal.kind] / goal.count);
    if (!jellyTotal) return 1;
    return Math.min(1, (jellyTotal - progress.jellyLeft) / jellyTotal);
  });
  return parts.reduce((sum, n) => sum + n, 0) / parts.length;
}

export interface GoalChip {
  key: string;
  label: string;
  kind: Kind | null;
  jelly: boolean;
  done: boolean;
}

export function goalChips(level: LevelDef, progress: Progress, jellyTotal: number): GoalChip[] {
  return level.goals.map((goal, index) => {
    if (goal.type === "score") {
      return {
        key: `score-${index}`,
        label: `${Math.min(progress.score, goal.target)}/${goal.target}`,
        kind: null,
        jelly: false,
        done: progress.score >= goal.target,
      };
    }
    if (goal.type === "collect") {
      const have = progress.collected[goal.kind];
      return {
        key: `${goal.kind}-${index}`,
        label: `${Math.min(have, goal.count)}/${goal.count}`,
        kind: goal.kind,
        jelly: false,
        done: have >= goal.count,
      };
    }
    const cleared = jellyTotal - progress.jellyLeft;
    return {
      key: `jelly-${index}`,
      label: `${cleared}/${jellyTotal}`,
      kind: null,
      jelly: true,
      done: progress.jellyLeft === 0,
    };
  });
}

export function freshCollected(): Record<Kind, number> {
  return emptyCollected();
}

export function breakJelly(jelly: boolean[][], cells: Pos[]): number {
  let n = 0;
  for (const cell of cells) {
    if (jelly[cell.r]?.[cell.c]) {
      jelly[cell.r]![cell.c] = false;
      n += 1;
    }
  }
  return n;
}
