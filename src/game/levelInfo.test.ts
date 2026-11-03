import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, getLevel } from "./levels.ts";
import { goalLines, levelKind } from "./levelInfo.ts";

test("every level gets a kind and at least one goal line", () => {
  for (const level of LEVELS) {
    assert.ok(levelKind(level));
    const lines = goalLines(level);
    assert.ok(lines.length > 0, `level ${level.id} has no goal text`);
    for (const line of lines) assert.ok(line.text.length > 3);
  }
});

test("bosses, microbes, heal stages and side wards are told apart", () => {
  assert.equal(levelKind(getLevel(5)), "boss");
  assert.equal(levelKind(getLevel(27)), "microbe");
  assert.equal(levelKind(getLevel(29)), "heal");
  assert.equal(levelKind(getLevel(20)), "ward");
  assert.equal(levelKind(getLevel(1)), "main");
});

test("collect goals name the sweet", () => {
  assert.match(goalLines(getLevel(1))[0]!.text, /Collect \d+ hearts/);
});
