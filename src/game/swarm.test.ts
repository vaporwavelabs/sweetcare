import { test } from "node:test";
import assert from "node:assert/strict";
import { hasMother, makeGerm, stepGerm, woundGerm } from "./swarm.ts";
import { FxWorld, FX_CAP } from "./fx.ts";

const OUTBREAK = { count: 8, hp: 32, speed: 13, bite: 16 };
const SPORES = { count: 4, hp: 16, speed: 7, bite: 8 };

test("big outbreaks end with a mother cell", () => {
  assert.equal(hasMother(OUTBREAK), true);
  assert.equal(hasMother(SPORES), false);
  assert.equal(makeGerm(1, 7, OUTBREAK, true).kind, "mother");
  assert.notEqual(makeGerm(1, 3, SPORES, true).kind, "mother");
});

test("drifters sway but stay on the stage", () => {
  const germ = makeGerm(1, 0, SPORES, false);
  const xs = new Set<number>();
  for (let i = 0; i < 40; i++) {
    stepGerm(germ, SPORES, 0.05);
    xs.add(Math.round(germ.x));
    assert.ok(germ.x >= 6 && germ.x <= 94);
  }
  assert.ok(xs.size > 3, "a drifter should move side to side");
});

test("a germ reports when it reaches the ward", () => {
  const germ = makeGerm(1, 0, OUTBREAK, false);
  let reached = false;
  for (let i = 0; i < 400 && !reached; i++) reached = stepGerm(germ, OUTBREAK, 0.05);
  assert.ok(reached);
});

test("darters stop to shiver, then lunge", () => {
  const germ = makeGerm(1, 2, OUTBREAK, false);
  assert.equal(germ.kind, "darter");
  let told = false;
  let dashed = false;
  for (let i = 0; i < 200; i++) {
    stepGerm(germ, OUTBREAK, 0.05);
    if (germ.tell > 0) told = true;
    if (germ.dash > 0) dashed = told;
  }
  assert.ok(told && dashed);
});

test("a mother splits into two drifters when she pops", () => {
  let id = 10;
  const mother = makeGerm(1, 7, OUTBREAK, true);
  const first = woundGerm(mother, 10, () => ++id, OUTBREAK);
  assert.equal(first.dead, false);
  const last = woundGerm(mother, mother.hp, () => ++id, OUTBREAK);
  assert.equal(last.dead, true);
  assert.equal(last.buds.length, 2);
  assert.ok(last.buds.every((bud) => bud.kind === "drifter" && bud.id > 10));
});

test("the effects pool never grows past its cap and empties itself", () => {
  const world = new FxWorld();
  for (let i = 0; i < 100; i++) world.sparks(0, 0, "#fff", 10, 300, i);
  assert.ok(world.list.length <= FX_CAP);
  for (let i = 0; i < 60; i++) world.step(0.05);
  assert.equal(world.list.length, 0);
});

test("quick hits fold into one damage number", () => {
  const world = new FxWorld();
  world.tally(0, 0, 4, "-", "#fff", 22);
  world.step(0.05);
  world.tally(0, 0, 4, "-", "#fff", 22);
  world.tally(0, 0, 6, "-", "#fff", 22);
  const texts = world.list.filter((fx) => fx.kind === "text");
  assert.equal(texts.length, 1);
  assert.equal(texts[0]!.text, "-14");
});
