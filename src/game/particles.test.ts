import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ParticleWorld, depthScale } from "./particles.ts";

describe("particle physics", () => {
  it("bounces a heavy kit off the floor", () => {
    const world = new ParticleWorld();
    world.resize(200, 180);
    world.spawn("kit", 100, 40, 0, 0);
    let bounced = false;
    let prevVy = 0;
    for (let i = 0; i < 90; i++) {
      world.step(1 / 60);
      const body = world.bodies[0];
      if (!body) break;
      if (prevVy > 80 && body.vy < 0 && body.y > 140) bounced = true;
      prevVy = body.vy;
    }
    assert.equal(bounced, true);
  });

  it("pushes overlapping hearts apart", () => {
    const world = new ParticleWorld();
    world.resize(200, 200);
    world.spawn("heart", 100, 80, 0, 0);
    world.spawn("heart", 104, 80, 0, 0);
    world.step(1 / 60);
    const [a, b] = world.bodies;
    const gap = Math.hypot(b!.x - a!.x, b!.y - a!.y);
    assert.ok(gap >= a!.radius + b!.radius - 0.2, `gap ${gap}`);
  });

  it("lets a bandage drift sideways while a cross falls straighter", () => {
    const world = new ParticleWorld();
    world.resize(400, 500);
    world.spawn("bandage", 200, 40, 0, 0);
    world.spawn("cross", 200, 40, 0, 0);
    for (let i = 0; i < 30; i++) world.step(1 / 60);
    const bandage = world.bodies.find((body) => body.kind === "bandage")!;
    const cross = world.bodies.find((body) => body.kind === "cross")!;
    assert.ok(Math.abs(bandage.x - 200) > Math.abs(cross.x - 200));
    assert.ok(cross.y > bandage.y);
  });
});

describe("particle depth", () => {
  it("throws a candy at the glass and lets it drift back toward the board", () => {
    const world = new ParticleWorld();
    world.resize(400, 600);
    world.spawn("heart", 200, 100, 0, 0, 0, { vz: 600 });
    let peak = 0;
    for (let i = 0; i < 20; i++) {
      world.step(1 / 60);
      peak = Math.max(peak, world.bodies[0]!.z);
    }
    assert.ok(peak > 40, `peak ${peak}`);
    for (let i = 0; i < 50; i++) world.step(1 / 60);
    assert.ok(world.bodies[0]!.z < peak);
  });

  it("lets candies at different depths pass each other", () => {
    const world = new ParticleWorld();
    world.resize(200, 200);
    world.spawn("heart", 100, 80, 0, 0, 0, { z: 0 });
    world.spawn("heart", 101, 80, 0, 0, 0, { z: 120 });
    world.step(1 / 60);
    const [a, b] = world.bodies;
    assert.ok(Math.abs(b!.x - a!.x) < 4, "no sideways shove between layers");
  });

  it("draws nearer candies bigger and paints them last", () => {
    assert.ok(depthScale(120) > depthScale(0));
    assert.ok(depthScale(-100) < 1);
    const world = new ParticleWorld();
    world.spawn("pill", 10, 10, 0, 0, 0, { z: 90 });
    world.spawn("pill", 10, 10, 0, 0, 0, { z: -40 });
    assert.deepEqual(world.painterOrder().map((body) => body.z), [-40, 90]);
  });
});
