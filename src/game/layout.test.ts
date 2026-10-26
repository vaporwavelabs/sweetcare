import test from "node:test";
import assert from "node:assert/strict";
import { collapse, countWraps, createBoard, findGroups, hasMove, makeTile, mulberry32, paintSpecials, planFromMatches, shuffleBoard, swapWouldMatch, type Board } from "./engine.ts";
import { applyLayout, formatGrid, maskOf, mirrorGrid, parseGrid, resizeGrid } from "./layout.ts";
import { goalsMet, levelMask, makeJelly, type LevelDef } from "./levels.ts";

const GRID = ["# . . . . #", ". jw . . W .", ". . jb . . .", ". . . . . .", ". . . . . .", "# . . . . #"];

test("a layout reads and writes back the same", () => {
  const cells = parseGrid(GRID, 6, 6);
  assert.equal(cells[0]![0]!.hole, true);
  assert.deepEqual(cells[1]![1], { hole: false, jelly: true, wrap: 1, special: null, contagion: false, fuse: 0 });
  assert.equal(cells[1]![4]!.wrap, 2);
  assert.equal(cells[2]![2]!.special, "bomb");
  assert.deepEqual(formatGrid(cells), GRID);
});

test("short or missing rows fill with plain cells and a hole never carries layers", () => {
  const cells = parseGrid(["#jw"], 3, 3);
  assert.deepEqual(cells[0]![0], { hole: true, jelly: false, wrap: 0, special: null, contagion: false, fuse: 0 });
  assert.equal(cells[2]![2]!.hole, false);
  assert.equal(resizeGrid(cells, 4, 2).length, 4);
  assert.equal(mirrorGrid(parseGrid(["# . ."], 1, 3))[0]![2]!.hole, true);
});

test("holes stay empty through dealing, refills and shuffles", () => {
  const mask = maskOf(parseGrid(GRID, 6, 6));
  const rng = mulberry32(9);
  const kinds = ["heart", "cross", "pill", "bandage", "kit"] as const;
  let board = createBoard(rng, 6, 6, kinds, mask);
  assert.equal(board[0]![0], null);
  assert.equal(board[5]![5], null);
  assert.equal(findGroups(board).length, 0);
  assert.ok(hasMove(board));
  board[3]![2] = null;
  board[4]![2] = null;
  board[1]![0] = null;
  board = collapse(board, rng, kinds, 0, mask).board;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) assert.equal(board[r]![c] === null, !mask[r]![c], `cell ${r},${c}`);
  board = shuffleBoard(board, rng);
  assert.equal(board[0]![0], null);
  assert.equal(board[5]![0], null);
});

test("tiles fall through a hole in the middle of a column", () => {
  const mask = [[true], [false], [true]];
  const top = makeTile("heart");
  const board: Board = [[top], [null], [null]];
  const fell = collapse(board, mulberry32(1), ["cross"], 0, mask);
  assert.equal(fell.board[2]![0]!.id, top.id);
  assert.equal(fell.board[1]![0], null);
  assert.equal(fell.board[0]![0]!.kind, "cross");
});

test("a wrapped tile cannot be swapped, and a match peels it instead of clearing it", () => {
  const h = () => makeTile("heart");
  const x = () => makeTile("cross");
  const wrapped = h();
  wrapped.wrap = 2;
  const board: Board = [
    [h(), h(), wrapped],
    [x(), x(), h()],
  ];
  assert.equal(swapWouldMatch(board, { r: 0, c: 2 }, { r: 1, c: 2 }), false);
  const plan = planFromMatches(board, 1)!;
  assert.equal(plan.removals.length, 2);
  assert.deepEqual(plan.peels, [{ r: 0, c: 2 }]);
  assert.equal(plan.collected.heart, 2);
  paintSpecials(board, plan);
  assert.equal(wrapped.wrap, 1);
  assert.equal(countWraps(board), 1);
});

test("a layout puts wraps and powers on the dealt board and jelly follows the outline", () => {
  const level: LevelDef = { id: 40, name: "t", rows: 6, cols: 6, kinds: ["heart", "cross", "pill", "kit"], moves: 20, goals: [{ type: "wraps" }], star2: 1, star3: 2, jelly: "all", grid: GRID };
  const mask = levelMask(level)!;
  const board = createBoard(mulberry32(4), 6, 6, level.kinds, mask);
  applyLayout(board, parseGrid(GRID, 6, 6));
  assert.equal(countWraps(board), 3);
  assert.equal(board[2]![2]!.special, "bomb");
  const jelly = makeJelly(level);
  assert.equal(jelly[0]![0], false);
  assert.equal(jelly[3]![3], true);
  assert.equal(goalsMet(level, { score: 0, collected: {} as never, jellyLeft: 0, wrapsLeft: 3 }), false);
  assert.equal(goalsMet(level, { score: 0, collected: {} as never, jellyLeft: 0, wrapsLeft: 0 }), true);
});
