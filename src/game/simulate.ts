import {
  KINDS,
  cloneBoard,
  collapse,
  commitSwap,
  countWraps,
  createBoard,
  diveFavor,
  trackAssist,
  eraseIds,
  hasMove,
  mulberry32,
  paintSpecials,
  planAfterSwap,
  planFromMatches,
  shuffleBoard,
  type Board,
  type ClearPlan,
  type Kind,
  type Pos,
  type Rng,
} from "./engine.ts";
import { applyLayout } from "./layout.ts";
import { breakJelly, countJelly, freshCollected, goalsMet, levelCells, levelMask, makeJelly, type LevelDef } from "./levels.ts";

/**
 * A headless player for level design. It plays a level the way the game does (same cascades,
 * jelly, wraps, holes, refill assist and move bonus) and picks the swap that does the most for
 * the goals right now. It is greedy, not clever, so its win rate is a floor: a human with
 * boosters wins more often. That makes it a fair yardstick to compare levels with each other.
 */

export interface RunResult {
  won: boolean;
  score: number;
  movesLeft: number;
  /** Moves the bot spent before the goals were met, or all moves on a loss. */
  used: number;
  /** Score when the goals were met, before the move bonus. */
  goalScore: number;
}

export interface Report {
  runs: number;
  wins: number;
  winRate: number;
  avgScore: number;
  avgMovesLeft: number;
  /** Median moves used on wins. */
  medianUsed: number;
  /** Score thresholds that roughly half and a sixth of winning runs reach. */
  star2: number;
  star3: number;
  difficulty: Difficulty;
}

export type Difficulty = "Gentle" | "Fair" | "Tricky" | "Hard" | "Brutal";

export function difficultyOf(winRate: number): Difficulty {
  if (winRate >= 0.9) return "Gentle";
  if (winRate >= 0.7) return "Fair";
  if (winRate >= 0.45) return "Tricky";
  if (winRate >= 0.2) return "Hard";
  return "Brutal";
}

/** Only goal levels can be simulated. Bosses and encounters run on a clock. */
export function canSimulate(level: LevelDef): boolean {
  return !level.bossHp && !level.encounter && level.goals.length > 0;
}

interface SimState {
  level: LevelDef;
  board: Board;
  jelly: boolean[][];
  rng: Rng;
  score: number;
  moves: number;
  collected: Record<Kind, number>;
  assist: boolean;
  form: number;
}

function needs(state: SimState) {
  const kinds = new Set<Kind>();
  let jelly = false;
  let wraps = false;
  for (const goal of state.level.goals) {
    if (goal.type === "collect" && state.collected[goal.kind] < goal.count) kinds.add(goal.kind);
    if (goal.type === "jelly") jelly = true;
    if (goal.type === "wraps") wraps = true;
  }
  return { kinds, jelly, wraps };
}

function value(state: SimState, plan: ClearPlan): number {
  const want = needs(state);
  let v = plan.removals.length + plan.spawns.length * 3;
  for (const pos of plan.removals) {
    const tile = state.board[pos.r]?.[pos.c];
    if (tile && want.kinds.has(tile.kind)) v += 4;
    if (want.jelly && state.jelly[pos.r]?.[pos.c]) v += 5;
  }
  if (want.wraps) v += plan.peels.length * 5;
  // Clearing low on the board stirs more cascades.
  for (const pos of plan.removals) v += pos.r / Math.max(1, state.board.length) * 0.4;
  return v;
}

function pickSwap(state: SimState): [Pos, Pos] | null {
  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;
  let best: [Pos, Pos] | null = null;
  let bestV = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const options: Pos[] = [
        { r, c: c + 1 },
        { r: r + 1, c },
      ];
      for (const b of options) {
        if (b.r >= rows || b.c >= cols) continue;
        const a = { r, c };
        const trial = cloneBoard(state.board);
        if (!commitSwap(trial, a, b)) continue;
        const plan = planAfterSwap(trial, a, b, 1);
        if (!plan) continue;
        const v = value({ ...state, board: trial }, plan) + state.rng() * 0.5;
        if (v > bestV) {
          bestV = v;
          best = [a, b];
        }
      }
    }
  }
  return best;
}

function play(state: SimState, plan: ClearPlan, mask: ReturnType<typeof levelMask>) {
  const broken = breakJelly(state.jelly, plan.removals);
  state.score += plan.score + broken * 40;
  for (const kind of KINDS) state.collected[kind] += plan.collected[kind];
  const painted = paintSpecials(state.board, plan);
  eraseIds(state.board, painted.dyingIds);
  const spent = state.assist;
  state.board = collapse(state.board, state.rng, state.level.kinds, diveFavor(state.level.id, spent), mask).board;
  if (spent) state.assist = false;
}

function progressOf(state: SimState) {
  return {
    score: state.score,
    collected: state.collected,
    jellyLeft: countJelly(state.jelly),
    wrapsLeft: countWraps(state.board),
  };
}

export function simulateOnce(level: LevelDef, seed: number): RunResult {
  const rng = mulberry32(seed >>> 0);
  const mask = levelMask(level);
  const cells = levelCells(level);
  const board = createBoard(rng, level.rows, level.cols, level.kinds, mask);
  if (cells) applyLayout(board, cells);
  if (level.startSpecial) {
    const mid = board[Math.floor(level.rows / 2)]?.[Math.floor(level.cols / 2)];
    if (mid) mid.special = level.startSpecial;
  }
  const state: SimState = {
    level,
    board,
    jelly: makeJelly(level),
    rng,
    score: 0,
    moves: level.moves,
    collected: freshCollected(),
    assist: false,
    form: 0,
  };
  let shuffles = 0;
  let guard = 0;
  while (state.moves > 0 && guard++ < 500) {
    if (goalsMet(level, progressOf(state))) break;
    if (!hasMove(state.board)) {
      if (shuffles >= 2) {
        const tile = state.board.flat().find((item) => item && !item.wrap && item.special !== "rainbow");
        if (tile) tile.special = "rainbow";
        shuffles = 0;
      } else {
        shuffles += 1;
        state.board = shuffleBoard(state.board, state.rng);
        let follow = planFromMatches(state.board, 1);
        let combo = 1;
        while (follow) {
          play(state, follow, mask);
          combo += 1;
          follow = planFromMatches(state.board, combo);
        }
      }
      continue;
    }
    shuffles = 0;
    const swap = pickSwap(state);
    if (!swap) break;
    commitSwap(state.board, swap[0], swap[1]);
    state.moves -= 1;
    let plan = planAfterSwap(state.board, swap[0], swap[1], 1);
    let combo = 1;
    while (plan) {
      play(state, plan, mask);
      combo += 1;
      plan = planFromMatches(state.board, combo);
    }
    trackAssist(state, level.id, combo > 2);
  }
  const won = goalsMet(level, progressOf(state));
  const goalScore = state.score;
  if (won) state.score += state.moves * 100;
  return { won, score: state.score, movesLeft: won ? state.moves : 0, used: level.moves - state.moves, goalScore };
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[at]!;
}

function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step);
}

export function summarize(level: LevelDef, results: RunResult[]): Report {
  const wins = results.filter((run) => run.won);
  const winScores = wins.map((run) => run.score).sort((a, b) => a - b);
  const used = wins.map((run) => run.used).sort((a, b) => a - b);
  const winRate = results.length ? wins.length / results.length : 0;
  const allScores = results.map((run) => run.score).sort((a, b) => a - b);
  const pool = winScores.length >= 3 ? winScores : allScores;
  const star2 = roundTo(quantile(pool, 0.5), 50);
  const star3 = Math.max(star2 + 100, roundTo(quantile(pool, 0.83), 50));
  return {
    runs: results.length,
    wins: wins.length,
    winRate,
    avgScore: results.length ? Math.round(results.reduce((sum, run) => sum + run.score, 0) / results.length) : 0,
    avgMovesLeft: wins.length ? wins.reduce((sum, run) => sum + run.movesLeft, 0) / wins.length : 0,
    medianUsed: quantile(used, 0.5) || level.moves,
    star2,
    star3,
    difficulty: difficultyOf(winRate),
  };
}

export function simulate(level: LevelDef, runs = 24, baseSeed = 1): Report {
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) results.push(simulateOnce(level, (baseSeed * 7919 + i * 104729) >>> 0));
  return summarize(level, results);
}

/**
 * Runs the simulation in slices so a browser stays responsive. Resolves with the same report
 * as simulate() for the same arguments.
 */
export function simulateAsync(level: LevelDef, runs = 24, baseSeed = 1, onProgress?: (done: number) => void): Promise<Report> {
  return new Promise((resolve) => {
    const results: RunResult[] = [];
    const step = () => {
      const until = Math.min(runs, results.length + 3);
      while (results.length < until) {
        const i = results.length;
        results.push(simulateOnce(level, (baseSeed * 7919 + i * 104729) >>> 0));
      }
      onProgress?.(results.length);
      if (results.length >= runs) resolve(summarize(level, results));
      else setTimeout(step, 0);
    };
    setTimeout(step, 0);
  });
}

export interface Tuning {
  moves: number;
  star2: number;
  star3: number;
  /** Bot win rate at the tuned move count. */
  winRate: number;
}

export const MIN_MOVES = 12;
export const MAX_MOVES = 50;

/**
 * Picks a move count so the bot wins about `target` of its runs, and star scores to match.
 *
 * The bot plays the same way whatever the clock says and a run ends when the goals are met, so
 * one batch with a long clock tells us how many moves each run needed. The win rate at any move
 * count M is then the share of runs that needed M or fewer, and a winner's score at M is the
 * score it had at the goal plus 100 for every move it had left.
 */
export function tune(level: LevelDef, target = 0.75, runs = 12, baseSeed = 1): Tuning {
  const long = { ...level, moves: MAX_MOVES + 20 };
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) results.push(simulateOnce(long, (baseSeed * 7919 + i * 104729) >>> 0));
  const needed = results.map((run) => (run.won ? run.used : Infinity)).sort((a, b) => a - b);
  const at = Math.min(needed.length - 1, Math.max(0, Math.ceil(target * needed.length) - 1));
  const raw = needed[at]!;
  const moves = Math.max(MIN_MOVES, Math.min(MAX_MOVES, Number.isFinite(raw) ? raw : MAX_MOVES));
  const winners = results.filter((run) => run.won && run.used <= moves);
  const scores = winners.map((run) => run.goalScore + (moves - run.used) * 100).sort((a, b) => a - b);
  const star2 = roundTo(quantile(scores, 0.5), 50);
  const star3 = Math.max(star2 + 150, roundTo(quantile(scores, 0.85), 50));
  return { moves, star2, star3, winRate: winners.length / Math.max(1, results.length) };
}

/** Bot win rate the campaign aims for at each level. A gentle sawtooth: ramps, then a breather. */
export function targetRate(levelId: number): number {
  if (levelId <= 2) return 1;
  if (levelId >= 16) return 0.82 - ((levelId - 16) % 5) * 0.05;
  if (levelId <= 4) return 0.9;
  const inBand = (levelId - 1) % 5;
  const band = Math.floor((levelId - 1) / 5);
  const base = Math.max(0.55, 0.86 - band * 0.05);
  return Math.max(0.45, base - inBand * 0.04);
}
