import type { Board, ClearPlan, Mask, Pos, Rng } from "./engine.ts";
import type { CellSpec } from "./layout.ts";

/**
 * Turn-based ward mechanics that the game, the bot and the level creator share.
 *
 * Contagion is a layer on cells, like jelly, but it fights back: after any move that cleans none
 * of it, one infected cell spreads to an open neighbour. Clearing a tile on an infected cell
 * cleans that cell.
 *
 * Fever tiles carry a countdown that drops by one after every move. Clearing the tile treats the
 * fever. If any countdown reaches 0 the ward is lost. A level can also break out new fevers on
 * random tiles every few moves.
 *
 * After a move has fully resolved, call `afterMove` once. The order is fixed so the bot and the
 * game agree: spread, then tick, then a new outbreak.
 */

export interface FeverRule {
  /** A new fever breaks out every this many moves. */
  every: number;
  /** Countdown on a new fever. */
  fuse: number;
}

export const CONTAGION_POINTS = 60;
export const FEVER_POINTS = 200;

export function emptyLayer(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
}

export function contagionFrom(cells: CellSpec[][] | null, rows: number, cols: number): boolean[][] {
  const layer = emptyLayer(rows, cols);
  if (!cells) return layer;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) layer[r]![c] = Boolean(cells[r]?.[c]?.contagion && !cells[r]![c]!.hole);
  return layer;
}

export function countLayer(layer: boolean[][]): number {
  let n = 0;
  for (const row of layer) for (const on of row) if (on) n += 1;
  return n;
}

/** Cleans infected cells under a clear. Returns how many were cleaned. */
export function cleanContagion(layer: boolean[][], removals: Pos[]): number {
  let n = 0;
  for (const pos of removals) {
    if (layer[pos.r]?.[pos.c]) {
      layer[pos.r]![pos.c] = false;
      n += 1;
    }
  }
  return n;
}

const STEPS: Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

/** Infects one open neighbour of a random infected cell. Returns the new cell, if any. */
export function spreadContagion(layer: boolean[][], mask: Mask | undefined, rng: Rng): Pos | null {
  const rows = layer.length;
  const cols = layer[0]?.length ?? 0;
  const options: Pos[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!layer[r]![c]) continue;
      for (const step of STEPS) {
        const at = { r: r + step.r, c: c + step.c };
        if (at.r < 0 || at.c < 0 || at.r >= rows || at.c >= cols) continue;
        if (layer[at.r]![at.c] || (mask && !mask[at.r]![at.c])) continue;
        options.push(at);
      }
    }
  }
  if (!options.length) return null;
  const pick = options[Math.floor(rng() * options.length)]!;
  layer[pick.r]![pick.c] = true;
  return pick;
}

/**
 * Treats fevers on tiles a clear removes. Call before paintSpecials, which can turn a removed
 * tile into a new power piece in place. Returns how many fevers were treated.
 */
export function treatFevers(board: Board, plan: ClearPlan): number {
  let n = 0;
  for (const pos of plan.removals) {
    const tile = board[pos.r]?.[pos.c];
    if (tile?.fuse) {
      delete tile.fuse;
      n += 1;
    }
  }
  return n;
}

export function countFevers(board: Board): number {
  let n = 0;
  for (const row of board) for (const tile of row) if (tile?.fuse) n += 1;
  return n;
}

/** Lowest countdown on the board, or Infinity when there is no fever. */
export function hottestFuse(board: Board): number {
  let low = Infinity;
  for (const row of board) for (const tile of row) if (tile?.fuse && tile.fuse < low) low = tile.fuse;
  return low;
}

/** Drops every countdown by one. Returns the cells whose fever reached 0. */
export function tickFevers(board: Board): Pos[] {
  const burst: Pos[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[0]?.length ?? 0); c++) {
      const tile = board[r]![c];
      if (!tile?.fuse) continue;
      tile.fuse -= 1;
      if (tile.fuse <= 0) {
        tile.fuse = 0;
        burst.push({ r, c });
      }
    }
  }
  return burst;
}

/** Gives a random plain tile a fever. Skips wraps, powers and tiles that already burn. */
export function catchFever(board: Board, rng: Rng, fuse: number): Pos | null {
  const options: Pos[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[0]?.length ?? 0); c++) {
      const tile = board[r]![c];
      if (tile && !tile.wrap && !tile.special && !tile.fuse) options.push({ r, c });
    }
  }
  if (!options.length) return null;
  const pick = options[Math.floor(rng() * options.length)]!;
  board[pick.r]![pick.c]!.fuse = fuse;
  return pick;
}

export interface MoveOutcome {
  spread: Pos | null;
  burst: Pos[];
  outbreak: Pos | null;
}

export interface MechanicState {
  board: Board;
  contagion: boolean[][];
  /** Infected cells cleaned during the move that just resolved. */
  cleanedThisMove: number;
  /** Moves made so far, counting the one that just resolved. */
  movesMade: number;
}

export function afterMove(state: MechanicState, mask: Mask | undefined, rng: Rng, fever?: FeverRule | null): MoveOutcome {
  const spread = state.cleanedThisMove === 0 && countLayer(state.contagion) > 0 ? spreadContagion(state.contagion, mask, rng) : null;
  state.cleanedThisMove = 0;
  const burst = tickFevers(state.board);
  const outbreak = !burst.length && fever && fever.every > 0 && state.movesMade % fever.every === 0 ? catchFever(state.board, rng, fever.fuse) : null;
  return { spread, burst, outbreak };
}
