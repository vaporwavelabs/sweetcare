// Prints bot-tuned moves and star scores for the scripted goal levels.
// Run: node --experimental-strip-types scripts/levels/tune.ts
import { LEVELS } from "../../src/game/levels.ts";
import { canSimulate, simulate, targetRate, tune } from "../../src/game/simulate.ts";

for (const level of LEVELS) {
  if (level.id >= 3 && level.id < 16) continue;
  const probe = { ...level, moves: level.moves || 30 };
  if (!canSimulate(probe)) continue;
  const tuned = tune(probe, targetRate(level.id), 24, 11);
  const check = simulate({ ...probe, moves: tuned.moves, star2: tuned.star2, star3: tuned.star3 }, 24, 501);
  console.log(`${level.id} ${level.name}: moves ${tuned.moves}, star2 ${tuned.star2}, star3 ${tuned.star3} | target ${targetRate(level.id).toFixed(2)} holdout ${check.winRate.toFixed(2)}`);
}
