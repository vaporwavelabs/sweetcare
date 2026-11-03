import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_STAGE,
  STAGES,
  abilitiesAt,
  applyCare,
  carePoints,
  challengeFor,
  challengeMet,
  defaultEvolution,
  readEvolution,
  stageIndexFor,
  stageProgress,
  stageRewards,
  streakMultiplier,
  wardPerks,
  type CareReport,
} from "./evolution.ts";

const win: CareReport = { won: true, stars: 2, prevStars: 0, maxCombo: 4, movesLeft: 5, boss: false, destroyed: 85, challenge: null, challengeDone: false };

describe("stages", () => {
  it("climbs in order and starts at zero", () => {
    assert.equal(STAGES[0]!.need, 0);
    for (let i = 1; i < STAGES.length; i++) assert.ok(STAGES[i]!.need > STAGES[i - 1]!.need);
    assert.equal(stageIndexFor(0), 0);
    assert.equal(stageIndexFor(STAGES[2]!.need), 2);
    assert.equal(stageIndexFor(STAGES[2]!.need - 1), 1);
    assert.equal(stageIndexFor(10_000_000), MAX_STAGE);
  });

  it("reports progress inside a stage and caps at the top", () => {
    const half = (STAGES[1]!.need + STAGES[2]!.need) / 2;
    assert.equal(stageProgress(half).ratio, 0.5);
    assert.equal(stageProgress(10_000_000).next, null);
    assert.equal(stageProgress(10_000_000).ratio, 1);
  });

  it("stacks abilities", () => {
    assert.deepEqual(abilitiesAt(0), []);
    assert.deepEqual(abilitiesAt(2), ["steady-hands", "triage-eye"]);
    assert.equal(abilitiesAt(MAX_STAGE).length, 4);
    const top = wardPerks({ ...defaultEvolution(), stage: MAX_STAGE });
    assert.deepEqual(top, { extraMoves: 1, startStripe: true, secondWind: 3, pointBoost: 1.25 });
    assert.deepEqual(wardPerks(defaultEvolution()), { extraMoves: 0, startStripe: false, secondWind: 0, pointBoost: 1 });
  });
});

describe("care points", () => {
  it("pays a win line by line", () => {
    const points = carePoints(defaultEvolution(), win);
    assert.deepEqual(
      points.lines.map((line) => line.label),
      ["Ward cleared", "2 stars", "First clear", "Spare moves", "Combo x4", "Icons cleared"],
    );
    assert.equal(points.base, 100 + 100 + 100 + 50 + 45 + 16);
    assert.equal(points.total, points.base);
  });

  it("still pays a little on a loss, and a loss never uses the streak", () => {
    const points = carePoints({ ...defaultEvolution(), streak: 4 }, { ...win, won: false, maxCombo: 1, destroyed: 0 });
    assert.equal(points.total, 20);
    assert.equal(points.streakMult, 1);
  });

  it("multiplies wins in a row up to x1.5", () => {
    assert.equal(streakMultiplier(1), 1);
    assert.equal(streakMultiplier(3), 1.2);
    assert.equal(streakMultiplier(40), 1.5);
    const hot = carePoints({ ...defaultEvolution(), streak: 2 }, win);
    assert.equal(hot.total, Math.round(hot.base * 1.2));
  });

  it("adds the healing aura at the last stage", () => {
    const points = carePoints({ ...defaultEvolution(), stage: MAX_STAGE }, win);
    assert.equal(points.total, Math.round(points.base * 1.25));
  });

  it("pays the challenge only when done", () => {
    const challenge = challengeFor({ levelId: 4, clears: 0, encounter: false, moves: 20 });
    const missed = carePoints(defaultEvolution(), { ...win, challenge, challengeDone: false });
    const done = carePoints(defaultEvolution(), { ...win, challenge, challengeDone: true });
    assert.equal(done.base - missed.base, challenge.points);
  });
});

describe("evolving", () => {
  it("reaches a stage once, pays its reward, and tracks the streak", () => {
    const start = { ...defaultEvolution(), xp: STAGES[1]!.need - 10 };
    const first = applyCare(start, win);
    assert.equal(first.evolution.stage, 1);
    assert.deepEqual(first.reached.map((stage) => stage.id), ["caregiver"]);
    assert.equal(first.evolution.streak, 1);
    const again = applyCare(first.evolution, win);
    assert.deepEqual(again.reached, []);
    assert.equal(again.evolution.streak, 2);
    const lost = applyCare(again.evolution, { ...win, won: false });
    assert.equal(lost.evolution.streak, 0);
    assert.equal(lost.evolution.bestStreak, 2);
  });

  it("can skip through two stages in one big round and pays both", () => {
    const start = { ...defaultEvolution(), xp: STAGES[2]!.need - 1, stage: 0 };
    const result = applyCare(start, win);
    assert.deepEqual(result.reached.map((stage) => stage.index), [1, 2]);
    assert.deepEqual(stageRewards(result.reached), { coins: 300, blast: 1, stripe: 1, aid: 0 });
  });

  it("a typical campaign reaches the final stage, but not in a handful of wards", () => {
    let evo = defaultEvolution();
    for (let i = 0; i < 6; i++) evo = applyCare(evo, { ...win, prevStars: 0 }).evolution;
    assert.ok(evo.stage <= 2, `stage ${evo.stage} after 6 wins is too fast`);
    for (let i = 0; i < 40; i++) evo = applyCare(evo, { ...win, prevStars: i < 24 ? 0 : 2, boss: i % 5 === 4 }).evolution;
    assert.equal(evo.stage, MAX_STAGE);
  });
});

describe("challenges", () => {
  it("is stable for an attempt and avoids move goals on encounters", () => {
    const a = challengeFor({ levelId: 7, clears: 2, encounter: false, moves: 22 });
    const b = challengeFor({ levelId: 7, clears: 2, encounter: false, moves: 22 });
    assert.deepEqual(a, b);
    for (let clears = 0; clears < 40; clears++) {
      const boss = challengeFor({ levelId: 10, clears, encounter: true, moves: 30 });
      assert.ok(boss.kind !== "spare" && boss.kind !== "perfect", boss.kind);
    }
  });

  it("rotates across clears", () => {
    const kinds = new Set<string>();
    for (let clears = 0; clears < 30; clears++) kinds.add(challengeFor({ levelId: 3, clears, encounter: false, moves: 20 }).kind);
    assert.ok(kinds.size >= 4);
  });

  it("checks each kind", () => {
    const state = { won: true, maxCombo: 4, movesLeft: 6, stars: 3, seconds: 50, boostersUsed: 0, destroyed: 70 };
    const mk = (kind: "combo" | "spare" | "perfect" | "swift" | "clean" | "destroy", target: number) => ({ kind, target, label: "", points: 1 });
    assert.ok(challengeMet(mk("combo", 4), state));
    assert.ok(!challengeMet(mk("combo", 5), state));
    assert.ok(challengeMet(mk("spare", 6), state));
    assert.ok(challengeMet(mk("perfect", 3), state));
    assert.ok(challengeMet(mk("swift", 60), state));
    assert.ok(challengeMet(mk("clean", 0), state));
    assert.ok(!challengeMet(mk("clean", 0), { ...state, boostersUsed: 1 }));
    assert.ok(challengeMet(mk("destroy", 60), state));
    assert.ok(!challengeMet(mk("perfect", 3), { ...state, won: false }));
  });
});

describe("save reading", () => {
  it("defaults junk and never lets the stage run ahead of the points", () => {
    assert.deepEqual(readEvolution(null), defaultEvolution());
    assert.deepEqual(readEvolution({ xp: "lots" }), defaultEvolution());
    const cheat = readEvolution({ xp: 50, stage: 4, streak: 3 });
    assert.equal(cheat.stage, 0);
    assert.equal(cheat.streak, 3);
    const real = readEvolution({ xp: STAGES[3]!.need + 5, stage: 3 });
    assert.equal(real.stage, 3);
  });
});

describe("walker look", () => {
  it("is plain for a trainee and grows with the stage", async () => {
    const { walkerLook } = await import("./evolution.ts");
    assert.equal(walkerLook(defaultEvolution()).aura, null);
    const top = walkerLook({ ...defaultEvolution(), stage: MAX_STAGE });
    assert.ok(top.aura && top.wings && top.halo);
    assert.ok(top.size > walkerLook(defaultEvolution()).size);
  });
});
