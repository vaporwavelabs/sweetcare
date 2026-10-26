// Bot report for every goal level. Run: node --experimental-strip-types scripts/levels/report.ts [runs]
import { LEVELS, getLevel } from "../../src/game/levels.ts";
import { generateWard } from "../../src/game/generator.ts";
import { canSimulate, simulate } from "../../src/game/simulate.ts";

const runs = Number(process.argv[2] ?? 24);
const rows: string[] = [];
for (const base of LEVELS) {
  const level = base.bossHp || base.encounter || base.id >= 16 ? getLevel(base.id) : generateWard(base.id, 1000 + base.id, "fully-staffed");
  if (!canSimulate(level)) continue;
  const t = Date.now();
  const report = simulate(level, runs, 7);
  rows.push(
    [String(level.id).padStart(2), level.name.padEnd(16), `moves ${String(level.moves).padStart(2)}`, `win ${(report.winRate * 100).toFixed(0).padStart(3)}%`, report.difficulty.padEnd(7), `used ${String(report.medianUsed).padStart(2)}`, `stars ${level.star2}/${level.star3} -> ${report.star2}/${report.star3}`, `${Date.now() - t}ms`].join("  "),
  );
}
console.log(rows.join("\n"));
