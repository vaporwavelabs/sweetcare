// Rolled ward vs evolved ward, on fresh bot seeds the search never saw.
// Run: node --experimental-strip-types scripts/levels/evolve.ts [rolls per ward]
import { evaluate } from "../../src/game/evolve.ts";
import { generateWard } from "../../src/game/generator.ts";
import { getLevel } from "../../src/game/levels.ts";
import { simulate, targetRate } from "../../src/game/simulate.ts";
import { evolveWardNow, wardOptions } from "../../src/game/wardEvolution.ts";
import { mechanicsOf } from "../../src/game/evolve.ts";

const rolls = Number(process.argv[2] ?? 2);
const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);
let gapPlain = 0;
let gapEvolved = 0;
let tensionPlain = 0;
let tensionEvolved = 0;
let n = 0;
for (let id = 3; id <= 15; id++) {
  if (getLevel(id).bossHp) continue;
  for (let k = 0; k < rolls; k++) {
    const seed = 7000 + id * 31 + k * 977;
    const plain = generateWard(id, seed, "fully-staffed");
    const t = Date.now();
    const evolved = evolveWardNow(id, seed, "fully-staffed");
    const ms = Date.now() - t;
    const target = wardOptions(plain, 0).target;
    const hp = simulate(plain, 24, 4242);
    const he = simulate(evolved, 24, 4242);
    const fp = evaluate(plain, { target, seed: 4242, runs: 16 });
    const fe = evaluate(evolved, { target, seed: 4242, runs: 16 });
    gapPlain += Math.abs(hp.winRate - target);
    gapEvolved += Math.abs(he.winRate - target);
    tensionPlain += fp.tension;
    tensionEvolved += fe.tension;
    n += 1;
    console.log(
      `${String(id).padStart(2)} target ${pct(targetRate(id))} | rolled: ${String(plain.moves).padStart(2)} moves, wins ${pct(hp.winRate)}, close ${pct(fp.tension)}, fit ${fp.score.toFixed(2)} [${mechanicsOf(plain).join(",")}]` +
        ` | evolved: ${String(evolved.moves).padStart(2)} moves, wins ${pct(he.winRate)}, close ${pct(fe.tension)}, fit ${fe.score.toFixed(2)} [${mechanicsOf(evolved).join(",")}] ${ms}ms`,
    );
  }
}
console.log(`\nmean |win rate - target|: rolled ${pct(gapPlain / n)}, evolved ${pct(gapEvolved / n)}`);
console.log(`mean close finishes:      rolled ${pct(tensionPlain / n)}, evolved ${pct(tensionEvolved / n)}`);
