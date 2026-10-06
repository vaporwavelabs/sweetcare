import test from "node:test";
import assert from "node:assert/strict";
import { generateWard, previewSeed } from "./generator.ts";
import { dayKey, shiftForDate } from "./shifts.ts";
import { attemptFor, defaultSave, releaseAttempt } from "./save.ts";

test("the same seed and shift deal the same ward", () => {
  const a = generateWard(8, 4242, "spill-risk");
  const b = generateWard(8, 4242, "spill-risk");
  assert.deepEqual(a, b);
  assert.equal(a.jelly === "none", false);
});

test("a new seed can change the ward", () => {
  const a = generateWard(7, 11, "fully-staffed");
  const b = generateWard(7, 99, "fully-staffed");
  assert.notDeepEqual(a.goals, b.goals);
});

test("tutorial wards stay scripted", () => {
  const ward = generateWard(1, 5, "night-shift");
  assert.equal(ward.name, "Sweet Start");
  assert.equal(ward.goals[0]?.type, "collect");
  assert.equal(ward.startSpecial, null);
});

test("boss wards keep their order", () => {
  assert.equal(generateWard(5, 3, "fully-staffed").name, "Code Blue");
  assert.equal(generateWard(10, 3, "fully-staffed").name, "The Overflow");
  assert.equal(generateWard(15, 3, "fully-staffed").boss, "Audit");
});

test("short staffed cuts the clock", () => {
  const normal = generateWard(9, 77, "fully-staffed");
  const short = generateWard(9, 77, "short-staffed");
  assert.ok(short.moves < normal.moves);
  assert.ok(short.kinds.length <= 4);
});

test("a failed retry keeps the seed and a clear rolls the next one", () => {
  const now = new Date("2026-10-06T12:00:00");
  const first = attemptFor(defaultSave(), 6, now);
  const again = attemptFor(first.save, 6, now);
  assert.equal(again.seed, first.seed);
  assert.equal(again.shiftId, first.shiftId);
  const cleared = releaseAttempt(first.save, 6);
  const next = attemptFor(cleared, 6, now);
  assert.notEqual(next.seed, first.seed);
});

test("the shift of the day is stable", () => {
  const day = new Date("2026-04-02T08:00:00");
  assert.equal(shiftForDate(day).id, shiftForDate(day).id);
  assert.equal(dayKey(day), "2026-04-02");
  assert.ok(previewSeed(4, dayKey(day), 0) > 0);
});
