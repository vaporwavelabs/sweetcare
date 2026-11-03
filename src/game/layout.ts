import type { Board, Mask, Power } from "./engine.ts";

/**
 * One board cell in a level layout.
 *
 * A layout is written as rows of space-separated tokens so a level reads well in source and in
 * share codes. Each token is a set of flags:
 *
 *   .  plain cell        #  hole (no tile, tiles fall through)
 *   j  jelly under it    w  one bandage wrap    W  two bandage wraps
 *   r  row stripe        c  column stripe       b  bomb    *  rainbow
 *
 * Flags combine, so "jw" is a wrapped tile on jelly and "jb" is a bomb on jelly.
 */
export interface CellSpec {
  hole: boolean;
  jelly: boolean;
  wrap: 0 | 1 | 2;
  special: Power | null;
}

export const MIN_SIDE = 4;
export const MAX_SIDE = 9;

const SPECIAL_OF: Record<string, Power> = { r: "row", c: "col", b: "bomb", "*": "rainbow" };
const CHAR_OF: Record<Power, string> = { row: "r", col: "c", bomb: "b", rainbow: "*" };

export function plainCell(): CellSpec {
  return { hole: false, jelly: false, wrap: 0, special: null };
}

export function parseToken(token: string): CellSpec {
  const cell = plainCell();
  for (const ch of token) {
    if (ch === "#") cell.hole = true;
    else if (ch === "j") cell.jelly = true;
    else if (ch === "w") cell.wrap = Math.max(cell.wrap, 1) as 1 | 2;
    else if (ch === "W") cell.wrap = 2;
    else if (SPECIAL_OF[ch]) cell.special = SPECIAL_OF[ch]!;
  }
  if (cell.hole) return { hole: true, jelly: false, wrap: 0, special: null };
  return cell;
}

export function formatToken(cell: CellSpec): string {
  if (cell.hole) return "#";
  let out = "";
  if (cell.jelly) out += "j";
  if (cell.wrap === 1) out += "w";
  if (cell.wrap === 2) out += "W";
  if (cell.special) out += CHAR_OF[cell.special];
  return out || ".";
}

/** Reads a layout. Missing rows or cells become plain cells, extra ones are dropped. */
export function parseGrid(grid: readonly string[] | undefined, rows: number, cols: number): CellSpec[][] {
  return Array.from({ length: rows }, (_, r) => {
    const tokens = (grid?.[r] ?? "").trim().split(/\s+/).filter(Boolean);
    return Array.from({ length: cols }, (_, c) => parseToken(tokens[c] ?? "."));
  });
}

export function formatGrid(cells: CellSpec[][]): string[] {
  return cells.map((row) => row.map(formatToken).join(" "));
}

export function emptyGrid(rows: number, cols: number): CellSpec[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, plainCell));
}

export function maskOf(cells: CellSpec[][]): Mask {
  return cells.map((row) => row.map((cell) => !cell.hole));
}

export function hasHoles(cells: CellSpec[][]): boolean {
  return cells.some((row) => row.some((cell) => cell.hole));
}

export function openCount(cells: CellSpec[][]): number {
  let n = 0;
  for (const row of cells) for (const cell of row) if (!cell.hole) n += 1;
  return n;
}

/** Places wraps and starting powers on a freshly dealt board. */
export function applyLayout(board: Board, cells: CellSpec[][]) {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[0]?.length ?? 0); c++) {
      const tile = board[r]![c];
      const cell = cells[r]?.[c];
      if (!tile || !cell) continue;
      if (cell.wrap) tile.wrap = cell.wrap;
      if (cell.special) tile.special = cell.special;
    }
  }
}

/** Resizes a layout, keeping what still fits in the top-left corner. */
export function resizeGrid(cells: CellSpec[][], rows: number, cols: number): CellSpec[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (cells[r]?.[c] ? { ...cells[r]![c]! } : plainCell())),
  );
}

/** Mirrors the left half onto the right half. Good for quick symmetric boards. */
export function mirrorGrid(cells: CellSpec[][]): CellSpec[][] {
  return cells.map((row) => row.map((cell, c) => ({ ...(c < row.length / 2 ? cell : row[row.length - 1 - c]!) })));
}
