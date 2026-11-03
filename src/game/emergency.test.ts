import test from "node:test";
import assert from "node:assert/strict";
import { makeTile, mulberry32, type Board } from "./engine.ts";
import {
  applyStamp,
  auditTargets,
  createEmergency,
  damageScale,
  drainFlood,
  floodCells,
  floodLevel,
  shock,
  stepEmergency,
  AUDIT_WARNING,
  SPILL_AT,
} from "./emergency.ts";

test("code blue doubles hearts until the defib runs out, then flatlines", () => {
  const state = createEmergency("code-blue");
  assert.equal(damageScale(state, "heart"), 2);
  assert.equal(damageScale(state, "pill"), 1);
  assert.deepEqual(stepEmergency(state, state.span - 1), []);
  const events = stepEmergency(state, 2);
  assert.equal(events[0]?.type, "flatline");
  assert.equal(state.clock, state.span);
});

test("enough hearts in one clear shock the patient back", () => {
  const state = createEmergency("code-blue");
  stepEmergency(state, 10);
  assert.equal(shock(state, 3), false);
  assert.equal(shock(state, 4), true);
  assert.equal(state.clock, state.span);
  assert.equal(shock(createEmergency("audit"), 9), false);
});

test("the audit warns before it stamps and speeds up in later phases", () => {
  const state = createEmergency("audit");
  const warn = stepEmergency(state, state.span - AUDIT_WARNING + 0.01);
  assert.deepEqual(warn, [{ type: "audit-warn" }]);
  const stamp = stepEmergency(state, AUDIT_WARNING, 2);
  assert.deepEqual(stamp, [{ type: "audit-stamp" }]);
  assert.ok(state.clock < state.span);
});

test("the stamp flattens only the marked power pieces", () => {
  const a = makeTile("heart");
  const b = makeTile("pill");
  const c = makeTile("cross");
  a.special = "row";
  b.special = "bomb";
  const board: Board = [[a, b, c]];
  const targets = auditTargets(board, mulberry32(3), 1);
  assert.equal(targets.length, 1);
  const hit = applyStamp(board, targets);
  assert.equal(hit.length, 1);
  assert.equal([a, b].filter((tile) => tile.special).length, 1);
});

test("the flood grows from the bottom and from jelly already down", () => {
  const jelly = [
    [false, false, false],
    [false, false, false],
  ];
  const first = floodCells(jelly, undefined, 2, mulberry32(1));
  assert.ok(first.every((cell) => cell.r === 1));
  for (const cell of first) jelly[cell.r]![cell.c] = true;
  const next = floodCells(jelly, undefined, 6, mulberry32(2));
  assert.ok(next.length > 0 && next.every((cell) => !jelly[cell.r]![cell.c]));
});

test("a spilled flood drains back down", () => {
  const jelly = [
    [true, true, true],
    [true, false, true],
  ];
  assert.ok(floodLevel(jelly) >= SPILL_AT);
  drainFlood(jelly, mulberry32(4));
  assert.ok(floodLevel(jelly) < SPILL_AT);
});
