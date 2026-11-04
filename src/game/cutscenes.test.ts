import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, SCENE_IDS, sceneBefore, setAt, stageAt } from "./cutscenes.ts";

test("prologue opens on campus and ends on the island map", () => {
  const scene = SCENES.prologue;
  assert.equal(setAt(scene, 0), "campus");
  assert.equal(setAt(scene, scene.beats.length - 1), "island");
});

test("prologue walks through graduation, the NCLEX, debt, rejections and the job offer in order", () => {
  const scene = SCENES.prologue;
  const order: string[] = [];
  scene.beats.forEach((_, i) => {
    const set = setAt(scene, i);
    if (set && order[order.length - 1] !== set) order.push(set);
  });
  assert.deepEqual(order, ["campus", "exam", "exam-off", "result", "debt", "rejects", "letter", "ferry", "island"]);
});

test("prologue stays short and hits the job-hunt joke", () => {
  const beats = SCENES.prologue.beats;
  assert.ok(beats.length <= 14, `prologue has ${beats.length} beats`);
  const text = beats.map((beat) => beat.line ?? "").join(" ");
  for (const bit of ["NCLEX", "student loans", "experience", "Clinicals don't count"]) assert.ok(text.includes(bit), bit);
});

test("prologue clears the stage before the island reveal", () => {
  const scene = SCENES.prologue;
  const ferry = scene.beats.findIndex((beat) => beat.set === "ferry");
  assert.deepEqual(stageAt(scene, ferry), { left: null, right: null });
});

test("scenes without sets keep their photo backdrop", () => {
  assert.equal(setAt(SCENES.intro, SCENES.intro.beats.length - 1), null);
});

test("the prologue is not tied to a ward, and every scene id has a scene", () => {
  for (let id = 1; id <= 30; id++) assert.notEqual(sceneBefore(id), "prologue");
  for (const id of SCENE_IDS) assert.equal(SCENES[id].id, id);
});
