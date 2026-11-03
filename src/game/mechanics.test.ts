import test from "node:test";
import assert from "node:assert/strict";
import { createBoard, mulberry32, type ClearPlan } from "./engine.ts";
import { applyLayout, formatGrid, parseGrid, parseToken } from "./layout.ts";
import { goalsMet, makeContagion, type LevelDef } from "./levels.ts";
import { afterMove, catchFever, cleanContagion, countFevers, countLayer, spreadContagion, tickFevers, treatFevers } from "./mechanics.ts";
import { simulateOnce } from "./simulate.ts";

const KINDS = ["heart", "cross", "pill", "bandage", "kit"] as const;

test("contagion and fever tokens read and write back", () => {
  const grid = [". x jx t6", "xt4 . # .", "w . . .", ". . . t"];
  const cells = parseGrid(grid, 4, 4);
  assert.equal(cells[0]![1]!.contagion, true);
  assert.equal(cells[0]![3]!.fuse, 6);
  assert.equal(cells[1]![0]!.contagion && cells[1]![0]!.fuse === 4, true);
  assert.equal(cells[3]![3]!.fuse, 8, "a bare t gets the default count");
  assert.deepEqual(formatGrid(cells), [". x jx t6", "xt4 . # .", "w . . .", ". . . t8"]);
  assert.equal(parseToken("wt5").fuse, 0, "a fever never sits under a wrap");
  assert.equal(parseToken("t99").fuse, 20);
});

test("contagion spreads to an open neighbour and never into a hole", () => {
  const layer = [
    [true, false],
    [false, false],
  ];
  const mask = [
    [true, false],
    [true, true],
  ];
  const at = spreadContagion(layer, mask, mulberry32(3));
  assert.deepEqual(at, { r: 1, c: 0 });
  assert.equal(countLayer(layer), 2);
  assert.equal(cleanContagion(layer, [{ r: 0, c: 0 }, { r: 1, c: 1 }]), 1);
});

test("a move that cleans contagion stops the spread; one that does not lets it grow", () => {
  const board = createBoard(mulberry32(1), 4, 4, KINDS);
  const contagion = makeContagion({ rows: 4, cols: 4, grid: ["x . . .", ". . . .", ". . . .", ". . . ."] } as LevelDef);
  const state = { board, contagion, cleanedThisMove: 1, movesMade: 1 };
  assert.equal(afterMove(state, undefined, mulberry32(2)).spread, null);
  assert.equal(countLayer(contagion), 1);
  state.movesMade = 2;
  assert.ok(afterMove(state, undefined, mulberry32(2)).spread);
  assert.equal(countLayer(contagion), 2);
});

test("fevers tick down, burst at 0, and are treated by a clear", () => {
  const board = createBoard(mulberry32(4), 4, 4, KINDS);
  board[0]![0]!.fuse = 2;
  board[1]![1]!.fuse = 5;
  assert.deepEqual(tickFevers(board), []);
  assert.deepEqual(tickFevers(board), [{ r: 0, c: 0 }]);
  const plan = { removals: [{ r: 1, c: 1 }] } as ClearPlan;
  assert.equal(treatFevers(board, plan), 1);
  assert.equal(board[1]![1]!.fuse, undefined);
  assert.ok(catchFever(board, mulberry32(5), 7));
  assert.equal(countFevers(board), 1, "a burst fever is spent; the new one counts");
});

test("an outbreak rule starts new fevers on schedule", () => {
  const board = createBoard(mulberry32(6), 5, 5, KINDS);
  const state = { board, contagion: [[false]], cleanedThisMove: 0, movesMade: 3 };
  assert.ok(afterMove(state, undefined, mulberry32(7), { every: 3, fuse: 9 }).outbreak);
  state.movesMade = 4;
  assert.equal(afterMove(state, undefined, mulberry32(7), { every: 3, fuse: 9 }).outbreak, null);
});

test("layouts place fevers on the dealt tiles", () => {
  const board = createBoard(mulberry32(8), 3, 3, KINDS);
  applyLayout(board, parseGrid(["t5 . .", ". . .", ". . ."], 3, 3));
  assert.equal(board[0]![0]!.fuse, 5);
});

test("the new goals count", () => {
  const level = { goals: [{ type: "contagion" }, { type: "fevers", count: 3 }] } as LevelDef;
  const base = { score: 0, collected: {} as never, jellyLeft: 0 };
  assert.equal(goalsMet(level, { ...base, contagionLeft: 1, feversTreated: 3 }), false);
  assert.equal(goalsMet(level, { ...base, contagionLeft: 0, feversTreated: 2 }), false);
  assert.equal(goalsMet(level, { ...base, contagionLeft: 0, feversTreated: 3 }), true);
});

const WARD: LevelDef = {
  id: 12,
  name: "Test ward",
  rows: 6,
  cols: 6,
  kinds: ["heart", "cross", "kit", "pacifier", "gift"],
  moves: 30,
  goals: [{ type: "contagion" }, { type: "fevers", count: 3 }],
  star2: 0,
  star3: 0,
  jelly: "none",
  grid: [". . . . . .", ". x . . x .", ". . t9 t9 . .", ". . . . . .", ". x . . x .", ". . . . . ."],
  fever: { every: 6, fuse: 10 },
};

test("the bot plays contagion and fevers and can win", () => {
  let wins = 0;
  for (let seed = 1; seed <= 6; seed++) if (simulateOnce(WARD, seed).won) wins += 1;
  assert.ok(wins >= 3, `bot won ${wins}/6`);
});

test("a fever that cannot be reached in time loses the run", () => {
  const level: LevelDef = { ...WARD, goals: [{ type: "score", target: 999999 }], grid: [". . . . . .", ". . . . . .", ". . . . . .", ". . . . . .", ". . . . . .", "t3 t3 t3 t3 t3 t3"], fever: null };
  const run = simulateOnce(level, 2);
  assert.equal(run.won, false);
  assert.equal(run.burned, true);
});
