import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRound, defaultCareer, gapFor } from "./profile.ts";

describe("care rank", () => {
  it("promotes on the second round, then 3, 4, and 3", () => {
    assert.equal(gapFor(1), 2);
    assert.equal(gapFor(2), 3);
    assert.equal(gapFor(3), 4);
    assert.equal(gapFor(4), 3);
    let career = defaultCareer();
    const step = (score: number, prevBest: number) => {
      career = applyRound(
        career,
        {
          won: true,
          score,
          prevBest,
          stars: 1,
          maxCombo: 1,
          levelId: 1,
          destroyed: 3,
          timeRecord: false,
          elapsed: 1000,
        },
        1,
      ).career;
    };
    step(100, 0);
    assert.equal(career.rank, 1);
    step(120, 100);
    assert.equal(career.rank, 2);
  });

  it("counts a matched high score as two steps", () => {
    let career = defaultCareer();
    career = applyRound(
      career,
      {
        won: true,
        score: 500,
        prevBest: 400,
        stars: 2,
        maxCombo: 5,
        levelId: 2,
        destroyed: 8,
        timeRecord: true,
        elapsed: 800,
      },
      1,
    ).career;
    assert.equal(career.rank, 2);
    assert.equal(career.progress, 0);
    assert.ok(career.achievements.includes("streak"));
    assert.ok(career.achievements.includes("swift"));
  });
});
