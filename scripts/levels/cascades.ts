// How often the bot sets off cascades on each ward. Run: node --experimental-strip-types scripts/levels/cascades.ts [runs]
import { LEVELS, getLevel } from "../../src/game/levels.ts";
import { generateWard } from "../../src/game/generator.ts";
import { canSimulate, simulateOnce } from "../../src/game/simulate.ts";

const runs = Number(process.argv[2] ?? 16);
for (const base of LEVELS) {
  const level = base.bossHp || base.encounter || base.id >= 16 ? getLevel(base.id) : generateWard(base.id, 1000 + base.id, "fully-staffed");
  if (!canSimulate(level)) continue;
  let moves = 0;
  let cascades = 0;
  let best = 0;
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const run = simulateOnce(level, 77 + i * 31);
    moves += run.turns ?? run.used;
    cascades += run.cascades ?? 0;
    best += run.bestChain ?? 0;
    if (run.won) wins += 1;
  }
  console.log(`${String(level.id).padStart(2)} ${level.name.padEnd(16)} cascade moves ${((cascades / Math.max(1, moves)) * 100).toFixed(0).padStart(3)}%  avg best chain ${(best / runs).toFixed(1)}  win ${((wins / runs) * 100).toFixed(0)}%  moves ${level.moves}`);
}
