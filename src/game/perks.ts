/**
 * Combo perks: small, themed rewards for playing a move well. They are judged once a move has
 * fully resolved, so they reward the whole cascade, not one clear.
 *
 *   Good Vitals  a chain of 3+           +300 points
 *   Adrenaline   a chain of 4+           +1 move
 *   Sugar Rush   3+ powers set off       a candy turns into a stripe
 *   Defib        a chain of 5+           "Clear!": a cross zap through the busiest tile
 *   Miracle      a chain of 8+           a rainbow candy and +1 move
 *   Bedside      3 cascading moves in a row   the next move pays a 50% bonus
 *
 * At most one board perk fires per move (the best one earned), each has a cooldown in moves, and
 * the whole thing is pure and seeded so the bot in simulate.ts plays with the same rules.
 */

import { isOpen, planCross, type Board, type ClearPlan, type Mask, type Pos, type Rng } from "./engine.ts";

export type PerkId = "vitals" | "adrenaline" | "sugar-rush" | "defib" | "miracle" | "bedside";

export interface PerkInfo {
  id: PerkId;
  name: string;
  /** What earned it, for the toast and the help screen. */
  trigger: string;
  /** What it did. */
  effect: string;
  /** Moves before it can fire again. */
  cooldown: number;
  icon: string;
}

export const PERKS: Record<PerkId, PerkInfo> = {
  vitals: { id: "vitals", name: "Good Vitals", trigger: "Chain of 3", effect: "+300 points", cooldown: 2, icon: "/sprites/scope.png" },
  adrenaline: { id: "adrenaline", name: "Adrenaline", trigger: "Chain of 4", effect: "+1 move", cooldown: 4, icon: "/sprites/heart.png" },
  "sugar-rush": { id: "sugar-rush", name: "Sugar Rush", trigger: "3 powers in one move", effect: "A free stripe", cooldown: 5, icon: "/sprites/pill.png" },
  defib: { id: "defib", name: "Defib", trigger: "Chain of 5", effect: "Clear! Cross zap", cooldown: 4, icon: "/sprites/kit.png" },
  miracle: { id: "miracle", name: "Miracle", trigger: "Chain of 8", effect: "Rainbow +1 move", cooldown: 6, icon: "/sprites/rainbow.png" },
  bedside: { id: "bedside", name: "Bedside Manner", trigger: "3 cascades in a row", effect: "Next move +50%", cooldown: 0, icon: "/sprites/nurse.png" },
};

/** Board perks, best first. Only the first one earned fires. */
const LADDER: PerkId[] = ["miracle", "defib", "sugar-rush", "adrenaline", "vitals"];

export const VITALS_POINTS = 300;

export const STREAK_FOR_BEDSIDE = 3;
export const SUGAR_RUSH_POWERS = 3;
export const DEFIB_CHAIN = 5;
export const BEDSIDE_BONUS = 0.5;

export interface PerkState {
  /** Moves left on each perk's cooldown. */
  cooldown: Record<PerkId, number>;
  /** Cascading moves in a row. */
  streak: number;
  /** Bedside is armed for the next move. */
  armed: boolean;
  /** Every perk fired this ward, in order. */
  fired: PerkId[];
}

export interface MoveStats {
  /** Clear steps in the move: 1 for a plain match, 2+ for a cascade. */
  steps: number;
  /** Power pieces set off during the move. */
  powers: number;
  /** Points the move scored, before any perk bonus. */
  score: number;
}

export interface PerkResult {
  /** The board perk that fired, if any. */
  perk: PerkId | null;
  /** Bedside just armed for the next move. */
  armedBedside: boolean;
  /** Points paid on this move: the Bedside bonus plus Good Vitals. */
  bonus: number;
  extraMoves: number;
  /** A follow-up clear to run as part of this move (Defib). */
  plan: ClearPlan | null;
  /** Cells whose tile was turned into a power (Sugar Rush, Miracle). */
  planted: Pos[];
  /** Cells the zap hit, for the effect. */
  zap: Pos | null;
}

export function createPerks(): PerkState {
  return { cooldown: { vitals: 0, adrenaline: 0, "sugar-rush": 0, defib: 0, miracle: 0, bedside: 0 }, streak: 0, armed: false, fired: [] };
}

/** Which board perk this move earned, ignoring cooldowns. */
export function earned(stats: MoveStats): PerkId[] {
  const out: PerkId[] = [];
  if (stats.steps >= 8) out.push("miracle");
  if (stats.steps >= DEFIB_CHAIN) out.push("defib");
  if (stats.powers >= SUGAR_RUSH_POWERS) out.push("sugar-rush");
  if (stats.steps >= 4) out.push("adrenaline");
  if (stats.steps >= 3) out.push("vitals");
  return LADDER.filter((id) => out.includes(id));
}

/** Counts the power pieces a clear sets off. Call before the plan is applied to the board. */
export function powersIn(board: Board, plan: ClearPlan): number {
  let n = 0;
  for (const pos of plan.removals) if (board[pos.r]?.[pos.c]?.special) n += 1;
  return n;
}

function plainCells(board: Board, mask: Mask | undefined): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[0]?.length ?? 0); c++) {
      const tile = board[r]![c];
      if (tile && !tile.special && !tile.wrap && !tile.fuse && isOpen(mask, r, c)) out.push({ r, c });
    }
  }
  return out;
}

function takeRandom<T>(list: T[], rng: Rng): T | undefined {
  if (list.length === 0) return undefined;
  const index = Math.floor(rng() * list.length);
  return list.splice(Math.min(list.length - 1, index), 1)[0];
}

/** The cell whose row and column hold the most tiles. Ties broken by the rng. */
function busiest(board: Board, rng: Rng, mask: Mask | undefined): Pos | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let best: Pos | null = null;
  let bestN = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r]![c] || !isOpen(mask, r, c)) continue;
      let n = 0;
      for (let k = 0; k < cols; k++) if (board[r]![k]) n += 1;
      for (let k = 0; k < rows; k++) if (board[k]![c]) n += 1;
      const score = n + rng() * 0.9;
      if (score > bestN) {
        bestN = score;
        best = { r, c };
      }
    }
  }
  return best;
}

/**
 * Judges a finished move and applies its perk to the board. Mutates `state` and `board`
 * (Sugar Rush and Miracle paint powers onto tiles). Run the returned plan, if any, as a
 * follow-up clear of the same move.
 */
export function judgeMove(state: PerkState, stats: MoveStats, board: Board, rng: Rng, mask?: Mask): PerkResult {
  const result: PerkResult = { perk: null, armedBedside: false, bonus: 0, extraMoves: 0, plan: null, planted: [], zap: null };
  for (const id of Object.keys(state.cooldown) as PerkId[]) state.cooldown[id] = Math.max(0, state.cooldown[id] - 1);
  if (state.armed) {
    result.bonus = Math.round(stats.score * BEDSIDE_BONUS);
    state.armed = false;
  }
  state.streak = stats.steps >= 2 ? state.streak + 1 : 0;
  if (state.streak >= STREAK_FOR_BEDSIDE) {
    state.streak = 0;
    state.armed = true;
    result.armedBedside = true;
    state.fired.push("bedside");
  }
  const pick = earned(stats).find((id) => state.cooldown[id] <= 0);
  if (!pick) return result;
  if (pick === "defib") {
    const at = busiest(board, rng, mask);
    const plan = at ? planCross(board, at) : null;
    if (!plan) return result;
    plan.banner = "Clear!";
    result.plan = plan;
    result.zap = at;
  } else if (pick === "sugar-rush" || pick === "miracle") {
    const free = plainCells(board, mask);
    const count = 1;
    for (let i = 0; i < count; i++) {
      const cell = takeRandom(free, rng);
      if (!cell) break;
      const tile = board[cell.r]![cell.c]!;
      tile.special = pick === "miracle" ? "rainbow" : rng() < 0.5 ? "row" : "col";
      result.planted.push(cell);
    }
    if (result.planted.length === 0) return result;
    if (pick === "miracle") result.extraMoves = 1;
  } else if (pick === "adrenaline") {
    result.extraMoves = 1;
  } else if (pick === "vitals") {
    result.bonus += VITALS_POINTS;
  }
  result.perk = pick;
  state.cooldown[pick] = PERKS[pick].cooldown;
  state.fired.push(pick);
  return result;
}
