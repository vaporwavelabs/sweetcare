import test from "node:test";
import assert from "node:assert/strict";
import { checkLevel, cleanLevel } from "./customLevels.ts";
import { describeChanges, evaluate, evolve, evolveAsync, mechanicsOf, normalize, wardPlan } from "./evolve.ts";
import { generateWard } from "./generator.ts";
import { parseGrid } from "./layout.ts";
import { LEVELS, type LevelDef } from "./levels.ts";
import { formOffset, pushForm, wardOptions } from "./wardEvolution.ts";

const QUICK = { population: 4, generations: 2, runs: 4 };
const sample = LEVELS.find((level) => level.id === 17)!;

test("evolving is repeatable for a seed", () => {
  const a = evolve(sample, { target: 0.7, seed: 11, ...QUICK });
  const b = evolve(sample, { target: 0.7, seed: 11, ...QUICK });
  assert.deepEqual(a.best.level, b.best.level);
  assert.deepEqual(a.history, b.history);
});

test("the best level never scores below the start", () => {
  const result = evolve(generateWard(7, 555), { target: 0.75, seed: 3, ...QUICK, ...wardPlan(7) });
  assert.ok(result.best.fitness.score >= result.start.fitness.score - 1e-9);
  assert.equal(result.history.length, QUICK.generations + 1);
  assert.ok(result.top.length >= 1 && result.top.length <= 3);
});

test("locks are respected", () => {
  const start = normalize(generateWard(12, 77));
  const result = evolve(start, { target: 0.7, seed: 5, ...QUICK, lockGoals: true, lockKinds: true, maxHoles: 0, allow: ["jelly", "wraps"] });
  for (const pick of result.top) {
    assert.deepEqual(pick.level.goals, start.goals);
    assert.deepEqual(pick.level.kinds, start.kinds);
    const holes = parseGrid(pick.level.grid, pick.level.rows, pick.level.cols).flat().filter((cell) => cell.hole).length;
    const startHoles = parseGrid(start.grid, start.rows, start.cols).flat().filter((cell) => cell.hole).length;
    assert.ok(holes <= startHoles);
  }
});

test("a required mechanic is brought in", () => {
  const result = evolve(generateWard(8, 901), { target: 0.75, seed: 8, ...QUICK, ...wardPlan(8) });
  assert.ok(result.best.level.grid?.some((row) => row.includes("x")), "contagion on the board");
  assert.ok(mechanicsOf(result.best.level).includes("contagion"));
});

test("evolved creator levels pass the creator's own checks", () => {
  const start = cleanLevel({ name: "Base", kinds: ["heart", "cross", "pill", "bandage", "kit"], goals: [{ type: "collect", kind: "heart", count: 20 }] });
  const def: LevelDef = { id: 90, name: start.name, rows: 6, cols: 6, kinds: start.kinds, moves: 20, goals: start.goals, star2: 1, star3: 2, jelly: "none", grid: start.grid, custom: true };
  const result = evolve(def, { target: 0.75, seed: 21, ...QUICK, generations: 3, introduce: ["contagion", "fever"] });
  for (const pick of result.top) {
    const made = cleanLevel({ ...start, kinds: pick.level.kinds, goals: pick.level.goals, grid: pick.level.grid, moves: pick.level.moves, star2: pick.level.star2, star3: pick.level.star3, fever: pick.level.fever });
    const errors = checkLevel(made).filter((issue) => issue.level === "error");
    assert.deepEqual(errors, [], JSON.stringify(pick.level));
  }
});

test("fitness rewards hitting the target", () => {
  const good = evaluate(sample, { target: 0.75, seed: 2, runs: 6 });
  assert.ok(good.score > 0 && good.score <= 1);
  assert.ok(good.moves >= 12 && good.moves <= 50);
  assert.ok(good.star3 > good.star2);
});

test("changes are described in plain words", () => {
  const a = normalize(sample);
  const b = { ...a, grid: a.grid!.map((row, r) => (r === 0 ? row.replace(". ", "x ") : row)), fever: { every: 5, fuse: 9 } };
  const text = describeChanges(a, b).join(" | ");
  assert.match(text, /contagion/);
  assert.match(text, /fever outbreak every 5/);
});

test("async evolve matches the sync result", async () => {
  const sync = evolve(sample, { target: 0.7, seed: 4, ...QUICK });
  const async = await evolveAsync(sample, { target: 0.7, seed: 4, ...QUICK });
  assert.deepEqual(async?.best.level, sync.best.level);
});

test("player form eases after losses and firms up after easy wins", () => {
  assert.equal(formOffset([]), 0);
  let form = pushForm([], { id: 6, won: false, spare: 0 });
  form = pushForm(form, { id: 6, won: false, spare: 0 });
  assert.ok(formOffset(form) > 0);
  let easy = pushForm([], { id: 7, won: true, spare: 0.5 });
  for (let i = 0; i < 8; i++) easy = pushForm(easy, { id: 7, won: true, spare: 0.5 });
  assert.equal(easy.length, 6);
  assert.ok(formOffset(easy) < 0 && formOffset(easy) >= -0.08);
  const plain = generateWard(9, 42);
  assert.ok(wardOptions(plain, 0.1).target > wardOptions(plain, 0).target);
});

test("mechanics arrive with the campaign", () => {
  assert.deepEqual(wardPlan(3).require, []);
  assert.equal(wardPlan(3).maxHoles, 0);
  assert.ok(wardPlan(7).require?.includes("contagion"));
  assert.ok(wardPlan(12).require?.includes("fever"));
});
