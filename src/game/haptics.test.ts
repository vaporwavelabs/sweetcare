import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { admit, patternFor, resetHapticClock } from "./haptics.ts";

describe("patternFor", () => {
  it("hits harder as the chain deepens", () => {
    const shallow = patternFor("match", 1)[0]!;
    const mid = patternFor("match", 4)[0]!;
    assert.ok(mid > shallow);
  });

  it("adds a second pulse from a five chain", () => {
    assert.equal(patternFor("match", 4).length, 1);
    assert.equal(patternFor("match", 5).length, 3);
  });

  it("caps very deep chains", () => {
    assert.deepEqual(patternFor("match", 40), patternFor("match", 8));
  });

  it("keeps every pulse short enough to feel like a tap", () => {
    const cues = ["tap", "swap", "bad", "match", "special", "power", "boss-hit", "hurt", "win", "lose"] as const;
    for (const cue of cues) {
      for (const ms of patternFor(cue, 8)) assert.ok(ms > 0 && ms <= 120, `${cue} ${ms}`);
    }
  });
});

describe("admit", () => {
  beforeEach(() => resetHapticClock());

  it("drops a light cue inside the shared gap", () => {
    assert.equal(admit("swap", 1000), true);
    assert.equal(admit("tap", 1010), false);
    assert.equal(admit("tap", 1100), true);
  });

  it("lets priority cues through the shared gap", () => {
    assert.equal(admit("match", 1000), true);
    assert.equal(admit("win", 1005), true);
  });

  it("spaces repeats of a cue", () => {
    assert.equal(admit("hurt", 1000), true);
    assert.equal(admit("hurt", 1200), false);
    assert.equal(admit("hurt", 1500), true);
  });
});
