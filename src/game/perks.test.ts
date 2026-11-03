import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBoard, mulberry32 } from "./engine.ts";
import { BEDSIDE_BONUS, createPerks, earned, judgeMove, PERKS, STREAK_FOR_BEDSIDE, VITALS_POINTS } from "./perks.ts";

const fresh = (seed = 3) => {
  const rng = mulberry32(seed);
  return { rng, board: createBoard(rng, 6, 6, ["heart", "cross", "pill", "bandage", "kit"]) };
};

describe("combo perks", () => {
  it("ranks the best earned perk first", () => {
    assert.deepEqual(earned({ steps: 1, powers: 0, score: 0 }), []);
    assert.deepEqual(earned({ steps: 3, powers: 0, score: 0 }), ["vitals"]);
    assert.equal(earned({ steps: 4, powers: 0, score: 0 })[0], "adrenaline");
    assert.equal(earned({ steps: 2, powers: 3, score: 0 })[0], "sugar-rush");
    assert.equal(earned({ steps: 5, powers: 0, score: 0 })[0], "defib");
    assert.equal(earned({ steps: 9, powers: 4, score: 0 })[0], "miracle");
  });

  it("Good Vitals pays points and Adrenaline a move", () => {
    const { rng, board } = fresh();
    const state = createPerks();
    assert.equal(judgeMove(state, { steps: 3, powers: 0, score: 100 }, board, rng).bonus, VITALS_POINTS);
    const adrenaline = judgeMove(state, { steps: 4, powers: 0, score: 100 }, board, rng);
    assert.equal(adrenaline.perk, "adrenaline");
    assert.equal(adrenaline.extraMoves, 1);
  });

  it("respects cooldowns, then falls back to the next perk down", () => {
    const { rng, board } = fresh();
    const state = createPerks();
    judgeMove(state, { steps: 4, powers: 0, score: 0 }, board, rng);
    const again = judgeMove(state, { steps: 4, powers: 0, score: 0 }, board, rng);
    assert.equal(again.perk, "vitals");
    for (let i = 0; i < PERKS.adrenaline.cooldown; i++) judgeMove(state, { steps: 1, powers: 0, score: 0 }, board, rng);
    assert.equal(judgeMove(state, { steps: 4, powers: 0, score: 0 }, board, rng).perk, "adrenaline");
  });

  it("Defib returns a cross clear to run as a follow-up", () => {
    const { rng, board } = fresh();
    const result = judgeMove(createPerks(), { steps: 5, powers: 0, score: 0 }, board, rng);
    assert.equal(result.perk, "defib");
    assert.ok(result.plan && result.plan.removals.length >= 11);
    assert.equal(result.plan?.banner, "Clear!");
    assert.ok(result.zap);
  });

  it("Sugar Rush and Miracle paint powers onto plain tiles", () => {
    const { rng, board } = fresh();
    const sugar = judgeMove(createPerks(), { steps: 1, powers: 3, score: 0 }, board, rng);
    assert.equal(sugar.planted.length, 1);
    const tile = board[sugar.planted[0]!.r]![sugar.planted[0]!.c]!;
    assert.ok(tile.special === "row" || tile.special === "col");
    const miracle = judgeMove(createPerks(), { steps: 8, powers: 0, score: 0 }, board, rng);
    assert.equal(board[miracle.planted[0]!.r]![miracle.planted[0]!.c]!.special, "rainbow");
    assert.equal(miracle.extraMoves, 1);
  });

  it("Bedside arms after a cascade streak and pays on the next move", () => {
    const { rng, board } = fresh();
    const state = createPerks();
    let armed = false;
    for (let i = 0; i < STREAK_FOR_BEDSIDE; i++) armed = judgeMove(state, { steps: 2, powers: 0, score: 0 }, board, rng).armedBedside;
    assert.equal(armed, true);
    const paid = judgeMove(state, { steps: 1, powers: 0, score: 1000 }, board, rng);
    assert.equal(paid.bonus, 1000 * BEDSIDE_BONUS);
    assert.equal(state.armed, false);
  });

  it("a plain move breaks the streak", () => {
    const { rng, board } = fresh();
    const state = createPerks();
    judgeMove(state, { steps: 2, powers: 0, score: 0 }, board, rng);
    judgeMove(state, { steps: 1, powers: 0, score: 0 }, board, rng);
    assert.equal(state.streak, 0);
  });
});
