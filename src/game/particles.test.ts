import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ParticleWorld } from "./particles.ts";

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
