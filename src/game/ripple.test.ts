import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RippleSim } from "./ripple.ts";

const frame = { x: 0, y: 0, w: 1, h: 1 };

function at(sim: RippleSim, r: number, c: number) {
  return sim.sample((c + 0.5) / 6, (r + 0.5) / 6);
}

describe("match ripple", () => {
  it("stays still until three icons connect", () => {
    const sim = new RippleSim(64);
    sim.splash(
      [
        { r: 1, c: 1 },
        { r: 1, c: 2 },
      ],
      6,
      6,
      1,
      frame,
    );
    assert.equal(sim.energy, 0);
    sim.splash(
      [
        { r: 0, c: 0 },
        { r: 1, c: 1 },
        { r: 2, c: 2 },
      ],
      6,
      6,
      1,
      frame,
    );
    assert.equal(sim.energy, 0);
  });

  it("pours the connected area and leaves other icons dry", () => {
    const sim = new RippleSim(96);
    sim.splash(
      [
        { r: 2, c: 1 },
        { r: 2, c: 2 },
        { r: 2, c: 3 },
        { r: 0, c: 0 },
      ],
      6,
      6,
      1,
      frame,
    );
    assert.ok(Math.abs(at(sim, 2, 2)) > 0.4);
    assert.ok(Math.abs(at(sim, 2, 1)) > 0.4);
    assert.ok(Math.abs(at(sim, 0, 0)) < 0.05);
    assert.ok(Math.abs(at(sim, 1, 2)) < 0.05);
    assert.ok(Math.abs(at(sim, 5, 5)) < 0.05);
  });
});
