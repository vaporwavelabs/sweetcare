import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventsAt, THEMES } from "./music.ts";
import { isSfxName, SFX_NAMES } from "./sfx.ts";

describe("music themes", () => {
  it("every theme is well formed", () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      assert.equal(theme.bass.length, 16, `${name} bass`);
      for (const bar of theme.lead) assert.equal(bar.length, 16, `${name} lead`);
      for (const grid of Object.values(theme.drums)) assert.equal(grid.length, 16, `${name} drums`);
      assert.ok(theme.chords.length > 0 && theme.bpm >= 60 && theme.bpm <= 180, name);
    }
  });

  it("layers come in with intensity", () => {
    const ward = THEMES.ward;
    const calm = Array.from({ length: 16 }, (_, s) => eventsAt(ward, 0, s, 0)).flat();
    const hot = Array.from({ length: 16 }, (_, s) => eventsAt(ward, 0, s, 1)).flat();
    assert.ok(!calm.some((ev) => ev.voice === "snare" || ev.voice === "hat"));
    assert.ok(hot.some((ev) => ev.voice === "snare"));
    assert.ok(hot.some((ev) => ev.voice === "arp"));
    assert.ok(hot.length > calm.length);
  });

  it("ward and boss themes keep the monitor beep on beat one", () => {
    assert.ok(eventsAt(THEMES.ward, 0, 0, 0).some((ev) => ev.voice === "beep"));
    assert.ok(eventsAt(THEMES.boss, 3, 0, 0).some((ev) => ev.voice === "beep"));
    assert.ok(!eventsAt(THEMES.ward, 0, 1, 0).some((ev) => ev.voice === "beep"));
  });
});

describe("named cues", () => {
  it("names are unique and recognised", () => {
    assert.equal(new Set(SFX_NAMES).size, SFX_NAMES.length);
    assert.ok(isSfxName("reward.coin"));
    assert.ok(!isSfxName("reward.nope"));
  });
});
