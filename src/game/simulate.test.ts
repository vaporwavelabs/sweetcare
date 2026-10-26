import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "./levels.ts";
import { canSimulate, difficultyOf, simulate, simulateOnce, targetRate, tune } from "./simulate.ts";
import { generateWard } from "./generator.ts";

const sample = LEVELS.find((level) => level.id === 17)!;

test("a bot run is repeatable for a seed", () => {
  assert.deepEqual(simulateOnce(sample, 42), simulateOnce(sample, 42));
});

test("more moves never lowers the bot's win rate", () => {
  const tight = simulate({ ...sample, moves: 8 }, 12, 2);
  const loose = simulate({ ...sample, moves: 40 }, 12, 2);
  assert.ok(loose.winRate >= tight.winRate);
  assert.ok(loose.winRate > 0.8);
});

test("tuning lands near the asked win rate and orders the stars", () => {
  const tuned = tune(sample, 0.75, 16, 4);
  assert.ok(tuned.moves >= 12 && tuned.moves <= 50);
  assert.ok(tuned.winRate >= 0.7);
  assert.ok(tuned.star3 > tuned.star2);
});

test("bosses and encounters are left to their own clocks", () => {
  assert.equal(canSimulate(LEVELS[4]!), false);
  assert.equal(canSimulate(LEVELS[25]!), false);
  assert.equal(canSimulate(sample), true);
});

test("the campaign curve eases off after each run of hard wards", () => {
  assert.ok(targetRate(1) > targetRate(4));
  assert.ok(targetRate(9) < targetRate(11));
  assert.equal(difficultyOf(0.95), "Gentle");
  assert.equal(difficultyOf(0.1), "Brutal");
});

test("every scripted goal level is winnable by the bot", () => {
  for (const level of LEVELS) {
    if (!canSimulate(level)) continue;
    assert.ok(simulate(level, 6, 9).wins > 0, `${level.id} ${level.name}`);
  }
});

test("rolled wards come out tuned", () => {
  const ward = generateWard(12, 1234, "fully-staffed");
  assert.ok(ward.star2 > 0 && ward.star3 > ward.star2);
  assert.ok(simulate(ward, 10, 77).winRate >= 0.4);
});
