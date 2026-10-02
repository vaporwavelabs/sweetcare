import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boardFull,
  cloneBoard,
  collapse,
  comboLabel,
  comboWeight,
  commitSwap,
  createBoard,
  diveFavor,
  emptyCollected,
  eraseIds,
  findGroups,
  hasMove,
  makeTile,
  mulberry32,
  paintSpecials,
  planAfterSwap,
  planFromMatches,
  resetIds,
  type Board,
  type Kind,
  type Tile,
} from "./engine.ts";

const KINDS: Kind[] = ["heart", "cross", "pill", "bandage", "nurse", "kit"];

function fillCycle(rows: number, cols: number): Board {
  resetIds();
  const board: Board = [];
  for (let r = 0; r < rows; r++) {
    const row: (Tile | null)[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(makeTile(KINDS[(r + c) % 4]!));
    }
    board.push(row);
  }
  return board;
}

describe("sweet care match-3", () => {
  it("deals a quiet board that still has a move", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const board = createBoard(mulberry32(seed), 8, 8, KINDS.slice(0, 4));
      assert.equal(findGroups(board).length, 0);
      assert.equal(hasMove(board), true);
      assert.equal(boardFull(board), true);
    }
  });

  it("rejects a swap that does not match", () => {
    const board = fillCycle(8, 8);
    const before = board[0]![0]!.id;
    assert.equal(commitSwap(board, { r: 0, c: 0 }, { r: 0, c: 1 }), false);
    assert.equal(board[0]![0]!.id, before);
  });

  it("turns a line of four into a row stripe", () => {
    const board = fillCycle(8, 8);
    for (let c = 0; c < 4; c++) board[4]![c] = makeTile("heart");
    board[4]![4] = makeTile("cross");
    const plan = planFromMatches(board, 1, [{ r: 4, c: 1 }]);
    assert.ok(plan);
    assert.equal(plan!.spawns.length, 1);
    assert.equal(plan!.spawns[0]!.special, "row");
    assert.equal(plan!.spawns[0]!.r, 4);
    const painted = paintSpecials(board, plan!);
    assert.ok(painted.dyingIds.length >= 3);
    assert.equal(board[4]![1]!.special, "row");
    eraseIds(board, painted.dyingIds);
    const fell = collapse(board, mulberry32(2), KINDS);
    assert.equal(boardFull(fell.board), true);
  });

  it("turns a line of five into a rainbow", () => {
    const board = fillCycle(8, 8);
    for (let c = 0; c < 5; c++) board[2]![c] = makeTile("pill");
    board[2]![5] = makeTile("kit");
    const plan = planFromMatches(board, 1);
    assert.ok(plan);
    assert.equal(plan!.spawns.some((spawn) => spawn.special === "rainbow"), true);
  });

  it("turns an L into a burst", () => {
    const board = fillCycle(8, 8);
    board[3]![0] = makeTile("cross");
    board[3]![1] = makeTile("cross");
    board[3]![2] = makeTile("cross");
    board[4]![0] = makeTile("cross");
    board[5]![0] = makeTile("cross");
    const plan = planFromMatches(board, 1);
    assert.ok(plan);
    assert.equal(plan!.spawns.some((spawn) => spawn.special === "bomb"), true);
  });

  it("lets a rainbow clear one color", () => {
    const board = fillCycle(8, 8);
    board[0]![0] = makeTile("heart", "rainbow");
    assert.equal(commitSwap(board, { r: 0, c: 0 }, { r: 0, c: 1 }), true);
    const plan = planAfterSwap(board, { r: 0, c: 0 }, { r: 0, c: 1 }, 1);
    assert.ok(plan);
    assert.equal(plan!.banner, "Color clear!");
    assert.ok(plan!.collected.cross >= 8);
  });

  it("mixes two stripes into a cross", () => {
    const board = fillCycle(8, 8);
    board[1]![1] = makeTile("nurse", "row");
    board[1]![2] = makeTile("kit", "col");
    assert.equal(commitSwap(board, { r: 1, c: 1 }, { r: 1, c: 2 }), true);
    const plan = planAfterSwap(board, { r: 1, c: 1 }, { r: 1, c: 2 }, 1);
    assert.ok(plan);
    assert.equal(plan!.banner, "Power mix!");
    assert.ok(plan!.removals.length > 10);
  });

  it("cascades after gravity without throwing", () => {
    const rng = mulberry32(9);
    let board = createBoard(rng, 8, 8, KINDS);
    const copy = cloneBoard(board);
    assert.equal(commitSwap(copy, { r: 0, c: 0 }, { r: 0, c: 1 }) || true, true);
    let guard = 0;
    let score = 0;
    while (guard < 12) {
      const plan = planFromMatches(board, guard + 1);
      if (!plan) break;
      score += plan.score;
      const painted = paintSpecials(board, plan);
      eraseIds(board, painted.dyingIds);
      board = collapse(board, rng, KINDS).board;
      guard += 1;
    }
    assert.equal(boardFull(board), true);
    assert.ok(score >= 0);
    assert.deepEqual(emptyCollected().heart, 0);
  });

  it("on the second and third cascade, new candies continue the column", () => {
    resetIds(1);
    const board: Board = Array.from({ length: 6 }, () => Array(6).fill(null));
    const kinds: Kind[] = ["heart", "cross", "pill", "bandage", "nurse", "kit"];
    for (let r = 0; r < 6; r++) {
      for (let c = 1; c < 6; c++) board[r]![c] = makeTile(r % 2 === 0 ? "cross" : "pill");
    }
    board[5]![0] = makeTile("heart");
    const fell = collapse(board, mulberry32(1), kinds, 2);
    assert.equal(
      fell.board.every((row) => row[0]?.kind === "heart"),
      true,
    );
    assert.equal(
      findGroups(fell.board).some((group) => group.kind === "heart"),
      true,
    );
    const third = collapse(board, mulberry32(4), kinds, 3);
    assert.equal(
      third.board.every((row) => row[0]?.kind === "heart"),
      true,
    );
  });

  it("pays more the deeper a cascade goes and only dives from level 3", () => {
    assert.equal(comboWeight(3), 3);
    assert.equal(comboWeight(5), 5);
    assert.equal(comboWeight(8), 11);
    assert.equal(diveFavor(1, true), 0);
    assert.equal(diveFavor(3, false), 0);
    assert.equal(diveFavor(3, true), 2);
    assert.equal(comboLabel(6), "Deep dive!");
    assert.equal(comboLabel(7), "Faaah!");
    assert.equal(comboLabel(9), "Abyss!");
  });
});
