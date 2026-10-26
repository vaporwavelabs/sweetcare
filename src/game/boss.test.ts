import { test } from "node:test";
import assert from "node:assert/strict";
import { bossTierFor, createBoss, hitBoss, phaseFor, shoveBoss, stepBoss, type BossEvent } from "./boss.ts";

function run(state: ReturnType<typeof createBoss>, seconds: number, dt = 0.05) {
  const events: BossEvent[] = [];
  for (let t = 0; t < seconds; t += dt) events.push(...stepBoss(state, dt));
  return events;
}

test("tiers follow the ward", () => {
  assert.equal(bossTierFor(5, 96), 1);
  assert.equal(bossTierFor(10, 156), 2);
  assert.equal(bossTierFor(15, 220), 3);
});

test("phases split her chart in thirds", () => {
  assert.equal(phaseFor(96, 96), 0);
  assert.equal(phaseFor(64, 96), 1);
  assert.equal(phaseFor(32, 96), 2);
});

test("every attack is telegraphed before it lands", () => {
  const boss = createBoss(220, 3, 42);
  const events = run(boss, 40);
  const strikes = events.filter((event) => event.type === "strike");
  assert.ok(strikes.length > 0, "she should attack in forty seconds");
  let open = 0;
  for (const event of events) {
    if (event.type === "telegraph") open += 1;
    if (event.type === "strike") {
      assert.ok(open > 0, "a strike needs a telegraph first");
      open -= 1;
    }
  }
});

test("only the opening move set is used in phase one", () => {
  const boss = createBoss(96, 1, 7);
  const events = run(boss, 30);
  for (const event of events) {
    if (event.type === "telegraph") assert.equal(event.move, "paperwork");
  }
});

test("walking into the icons bites and shoos her back", () => {
  const boss = createBoss(96, 1, 3);
  boss.cooldown = 999;
  const events = run(boss, 40);
  const contact = events.find((event) => event.type === "contact");
  assert.ok(contact);
  assert.ok(boss.near < 98);
});

test("a big hit during a windup interrupts it and lands harder", () => {
  const boss = createBoss(220, 3, 9);
  boss.cooldown = 0;
  const first = stepBoss(boss, 0.05);
  assert.equal(first[0]?.type, "telegraph");
  const { dealt, events } = hitBoss(boss, 8, true);
  assert.equal(dealt, 12);
  assert.ok(events.some((event) => event.type === "interrupt"));
  assert.equal(boss.action, null);
});

test("crossing a third starts a new phase with a moment of guard", () => {
  const boss = createBoss(96, 1, 1);
  const { events } = hitBoss(boss, 40);
  assert.deepEqual(events, [{ type: "phase", phase: 1 }]);
  assert.equal(boss.phase, 1);
  assert.ok(boss.guard > 0);
  assert.equal(hitBoss(boss, 10).dealt, 0, "guard absorbs hits");
});

test("draining her chart puts her down", () => {
  const boss = createBoss(30, 1, 1);
  boss.guard = 0;
  const { events } = hitBoss(boss, 50);
  assert.ok(events.some((event) => event.type === "down"));
  assert.equal(boss.hp, 0);
  assert.deepEqual(stepBoss(boss, 1), []);
});

test("coffee heals her but never past full", () => {
  const boss = createBoss(156, 2, 5);
  boss.hp = 150;
  boss.phase = 1;
  boss.action = { move: "coffee", t: 0, windup: 1, power: 20 };
  const events = stepBoss(boss, 1.1);
  assert.ok(events.some((event) => event.type === "heal" && event.amount === 6));
  assert.equal(boss.hp, 156);
});

test("a shove slows her and pushes her back", () => {
  const boss = createBoss(96, 1, 1);
  boss.near = 50;
  shoveBoss(boss, true);
  assert.equal(boss.near, 36);
  assert.ok(boss.slow > 0);
});

test("the same seed plays the same fight", () => {
  const a = createBoss(220, 3, 77);
  const b = createBoss(220, 3, 77);
  assert.deepEqual(run(a, 30), run(b, 30));
});
