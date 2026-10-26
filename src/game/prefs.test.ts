import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPrefs, readPrefs } from "./prefs.ts";
import { scalePattern } from "./haptics.ts";

describe("prefs", () => {
  it("falls back to defaults on junk", () => {
    assert.deepEqual(readPrefs(undefined), defaultPrefs());
    const prefs = readPrefs({ sfxVolume: 140, musicVolume: -3, hapticStrength: "max", motion: "reduced", shake: false, hintDelay: 5 });
    assert.equal(prefs.sfxVolume, 100);
    assert.equal(prefs.musicVolume, 0);
    assert.equal(prefs.hapticStrength, "normal");
    assert.equal(prefs.motion, "reduced");
    assert.equal(prefs.shake, false);
    assert.equal(prefs.hintDelay, 7);
    assert.equal(readPrefs({ hintDelay: 0 }).hintDelay, 0);
  });

  it("scales vibration buzzes but keeps the pauses", () => {
    assert.deepEqual(scalePattern([20, 40, 20], "normal"), [20, 40, 20]);
    assert.deepEqual(scalePattern([20, 40, 20], "strong"), [32, 40, 32]);
    assert.deepEqual(scalePattern([6], "light"), [4]);
  });
});
