import test from "node:test";
import assert from "node:assert/strict";
import { blankLevel, checkLevel, cleanLevel, readShareCode, shareCode, toLevelDef } from "./customLevels.ts";

test("a share code round-trips a level", () => {
  const level = { ...blankLevel(), name: "Ward ✿", grid: ["# . . . . #", ". jw . . W .", ". . . . . .", ". . . . . .", ". . . . . .", "# . . . . #"] };
  const back = readShareCode(shareCode(level))!;
  assert.equal(back.name, "Ward ✿");
  assert.deepEqual(back.grid, level.grid);
  assert.deepEqual(back.goals, level.goals);
  assert.notEqual(back.uid, level.uid);
});

test("junk codes are refused and junk fields are cleaned", () => {
  assert.equal(readShareCode("hello"), null);
  assert.equal(readShareCode("SC1.!!!"), null);
  const level = cleanLevel({ rows: 40, cols: -2, kinds: ["heart", "nope", "heart"], moves: 1e9, goals: [{ type: "collect", kind: "teddy", count: 5 }, { type: "boom" }] });
  assert.equal(level.rows, 9);
  assert.equal(level.cols, 4);
  assert.equal(level.moves, 99);
  assert.ok(level.kinds.length >= 3);
  assert.equal(level.goals.length, 1);
});

test("the checker catches levels that can never be won", () => {
  const level = { ...blankLevel(), goals: [{ type: "jelly" as const }, { type: "collect" as const, kind: "teddy" as const, count: 5 }] };
  const errors = checkLevel(level).filter((issue) => issue.level === "error").map((issue) => issue.text);
  assert.ok(errors.some((text) => text.includes("jelly")));
  assert.ok(errors.some((text) => text.includes("teddy")));
  assert.equal(checkLevel(blankLevel()).filter((issue) => issue.level === "error").length, 0);
});

test("a custom level plays outside the campaign", () => {
  const def = toLevelDef(blankLevel());
  assert.equal(def.custom, true);
  assert.ok(def.id > 30);
});
