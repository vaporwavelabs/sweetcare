/**
 * Named sound cues. Screens call `playSfx("reward.coin")` instead of importing one function per
 * sound, so new screens can share the same palette. Every cue is synthesized; nothing loads.
 *
 * The palette: glassy candy plinks for UI, soft paper and felt for the map, warm bells for
 * rewards, and hospital touches (monitor beeps, defib whine, stamp) where they fit.
 */

import { audioContext, ensureAudio, noise, soundEnabled, tone, withVoice } from "./synth.ts";

export const SFX_NAMES = [
  "ui.tap",
  "ui.open",
  "ui.close",
  "ui.back",
  "ui.toggle-on",
  "ui.toggle-off",
  "ui.error",
  "ui.select",
  "map.step",
  "map.arrive",
  "map.unlock",
  "map.locked",
  "map.door",
  "reward.coin",
  "reward.star",
  "reward.chest",
  "reward.unlock",
  "reward.levelup",
  "reward.tick",
  "evolve.charge",
  "evolve.reveal",
  "perk.ready",
  "perk.vitals",
  "perk.adrenaline",
  "perk.defib",
  "perk.sugar-rush",
  "perk.bedside",
  "perk.miracle",
  "perk.bonus",
  "cut.whoosh",
  "cut.blip",
  "cut.stamp",
  "cut.alarm",
  "cut.sparkle",
  "cut.thud",
  "cut.gasp",
  "cut.door",
] as const;

export type SfxName = (typeof SFX_NAMES)[number];

export interface SfxOptions {
  /** Multiplies every pitch in the cue. 1 is normal. */
  pitch?: number;
  /** Multiplies the cue's volume. 1 is normal. */
  gain?: number;
  /** Seconds to wait before it plays. */
  delay?: number;
  /** For counted cues such as `reward.star`: which one in the row (0, 1, 2). Raises the pitch. */
  index?: number;
}

type Cue = (d: number, index: number) => void;

const sq = "square" as const;
const tri = "triangle" as const;
const saw = "sawtooth" as const;

const CUES: Record<SfxName, Cue> = {
  "ui.tap": (d) => {
    tone(880, 0.045, 0.05, { when: d });
    tone(1760, 0.03, 0.015, { when: d + 0.005 });
  },
  "ui.open": (d) => {
    tone(520, 0.1, 0.05, { when: d, type: tri, slideTo: 880 });
    tone(1320, 0.08, 0.025, { when: d + 0.06 });
  },
  "ui.close": (d) => {
    tone(820, 0.1, 0.045, { when: d, type: tri, slideTo: 480 });
  },
  "ui.back": (d) => {
    tone(660, 0.05, 0.045, { when: d, type: tri });
    tone(495, 0.07, 0.04, { when: d + 0.05, type: tri });
  },
  "ui.toggle-on": (d) => {
    tone(660, 0.05, 0.05, { when: d, type: tri });
    tone(990, 0.08, 0.05, { when: d + 0.05, type: tri });
  },
  "ui.toggle-off": (d) => {
    tone(880, 0.05, 0.045, { when: d, type: tri });
    tone(587, 0.08, 0.04, { when: d + 0.05, type: tri });
  },
  "ui.error": (d) => {
    tone(240, 0.12, 0.06, { when: d, type: tri, slideTo: 150 });
    tone(225, 0.12, 0.03, { when: d + 0.1, type: sq, cutoff: 900 });
  },
  "ui.select": (d) => {
    tone(1046, 0.06, 0.045, { when: d });
    tone(1568, 0.09, 0.03, { when: d + 0.04 });
  },
  "map.step": (d, i) => {
    // Soft felt footsteps; alternate feet sound a touch different.
    noise(0.05, 0.05, { when: d, filter: "bandpass", freq: i % 2 ? 900 : 1100, q: 1.2 });
    tone(i % 2 ? 140 : 160, 0.05, 0.05, { when: d, slideTo: 90 });
  },
  "map.arrive": (d) => {
    [784, 988, 1175].forEach((f, i) => tone(f, 0.14, 0.05, { when: d + i * 0.06, type: tri }));
    noise(0.25, 0.02, { when: d + 0.1, filter: "highpass", freq: 6000 });
  },
  "map.unlock": (d) => {
    tone(330, 0.08, 0.05, { when: d, type: sq, cutoff: 1500 });
    tone(440, 0.08, 0.05, { when: d + 0.07, type: sq, cutoff: 1500 });
    [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.18, 0.04, { when: d + 0.16 + i * 0.05 }));
  },
  "map.locked": (d) => {
    noise(0.05, 0.08, { when: d, filter: "bandpass", freq: 1400, q: 3 });
    tone(180, 0.1, 0.05, { when: d + 0.02, type: tri });
  },
  "map.door": (d) => {
    noise(0.4, 0.05, { when: d, filter: "lowpass", freq: 1200, sweepTo: 300 });
    tone(1319, 0.3, 0.03, { when: d + 0.05 });
    tone(1047, 0.4, 0.03, { when: d + 0.2 });
  },
  "reward.coin": (d) => {
    tone(1976, 0.06, 0.05, { when: d, type: sq, cutoff: 5000 });
    tone(2637, 0.18, 0.04, { when: d + 0.05, type: sq, cutoff: 6000 });
  },
  "reward.star": (d, i) => {
    const f = [1047, 1319, 1568][Math.min(2, i)]!;
    tone(f, 0.3, 0.07, { when: d, type: tri });
    tone(f * 2, 0.22, 0.03, { when: d + 0.03 });
    noise(0.2, 0.02, { when: d, filter: "highpass", freq: 8000 });
  },
  "reward.chest": (d) => {
    noise(0.18, 0.06, { when: d, filter: "lowpass", freq: 900 });
    tone(196, 0.12, 0.07, { when: d, type: tri });
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, 0.05, { when: d + 0.18 + i * 0.06, type: tri }));
    noise(0.6, 0.025, { when: d + 0.2, filter: "highpass", freq: 7000 });
  },
  "reward.unlock": (d) => {
    [659, 831, 988, 1319].forEach((f, i) => tone(f, 0.16, 0.05, { when: d + i * 0.07, type: tri }));
    tone(1976, 0.4, 0.03, { when: d + 0.3 });
  },
  "reward.levelup": (d) => {
    [523, 659, 784].forEach((f, i) => tone(f, 0.14, 0.06, { when: d + i * 0.08, type: sq, cutoff: 2400 }));
    [1047, 1319, 1568].forEach((f) => tone(f, 0.5, 0.035, { when: d + 0.26, type: tri }));
    noise(0.5, 0.02, { when: d + 0.26, filter: "highpass", freq: 7000 });
  },
  "reward.tick": (d, i) => {
    tone(1200 + (i % 12) * 40, 0.03, 0.03, { when: d });
  },
  "evolve.charge": (d) => {
    tone(220, 1.1, 0.05, { when: d, type: saw, slideTo: 880, cutoff: 1800, attack: 0.2 });
    tone(330, 1.1, 0.03, { when: d, type: tri, slideTo: 1320, attack: 0.3 });
    noise(1.1, 0.025, { when: d, filter: "bandpass", freq: 600, sweepTo: 5000, q: 2, attack: 0.3 });
  },
  "evolve.reveal": (d) => {
    noise(0.15, 0.08, { when: d, filter: "highpass", freq: 3000 });
    [523, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.5, 0.045, { when: d + 0.04 + i * 0.045, type: tri }));
    tone(130, 0.5, 0.08, { when: d, slideTo: 65 });
  },
  "perk.ready": (d) => {
    tone(1568, 0.08, 0.04, { when: d });
    tone(2093, 0.14, 0.035, { when: d + 0.07 });
  },
  // Two healthy monitor beeps, a fifth apart.
  "perk.vitals": (d) => {
    tone(988, 0.07, 0.04, { when: d, attack: 0.004 });
    tone(1480, 0.12, 0.04, { when: d + 0.12, attack: 0.004 });
  },
  // A heartbeat thump, then a syringe zing.
  "perk.adrenaline": (d) => {
    tone(80, 0.12, 0.14, { when: d, slideTo: 50 });
    tone(70, 0.12, 0.1, { when: d + 0.16, slideTo: 45 });
    tone(900, 0.28, 0.04, { when: d + 0.3, type: tri, slideTo: 2400 });
    noise(0.2, 0.02, { when: d + 0.32, filter: "highpass", freq: 6000 });
  },
  // The defib charge whine, then the shock.
  "perk.defib": (d) => {
    tone(400, 0.55, 0.035, { when: d, type: saw, slideTo: 3200, cutoff: 4000, attack: 0.1 });
    noise(0.22, 0.12, { when: d + 0.58, filter: "bandpass", freq: 900, q: 0.5 });
    tone(110, 0.3, 0.12, { when: d + 0.58, type: sq, slideTo: 40, cutoff: 1200 });
    tone(1046, 0.1, 0.03, { when: d + 0.95 });
  },
  // A fizzy, sparkling run up.
  "perk.sugar-rush": (d) => {
    [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(f, 0.1, 0.045, { when: d + i * 0.035, type: tri }));
    noise(0.4, 0.03, { when: d, filter: "bandpass", freq: 5000, q: 1.5, sweepTo: 9000 });
  },
  // A warm three-bell chord.
  "perk.bedside": (d) => {
    [659, 831, 988].forEach((f, i) => tone(f, 0.7, 0.04, { when: d + i * 0.03, type: tri }));
    tone(1319, 0.8, 0.02, { when: d + 0.12, vibrato: 12 });
  },
  // A choir swell and a chime cascade.
  "perk.miracle": (d) => {
    [262, 330, 392, 523].forEach((f) => tone(f, 1.2, 0.03, { when: d, type: tri, attack: 0.35, vibrato: 10 }));
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.5, 0.035, { when: d + 0.3 + i * 0.07 }));
    noise(1, 0.02, { when: d + 0.2, filter: "highpass", freq: 7500, attack: 0.3 });
  },
  "perk.bonus": (d) => {
    [1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, 0.045, { when: d + i * 0.06, type: sq, cutoff: 4000 }));
  },
  "cut.whoosh": (d) => {
    noise(0.35, 0.07, { when: d, filter: "bandpass", freq: 400, sweepTo: 3000, q: 1.4, attack: 0.08 });
  },
  "cut.blip": (d, i) => {
    tone(520 + ((i * 37) % 5) * 40, 0.035, 0.025, { when: d, type: tri });
  },
  "cut.stamp": (d) => {
    noise(0.08, 0.15, { when: d, filter: "lowpass", freq: 1800 });
    tone(90, 0.18, 0.14, { when: d, slideTo: 50 });
    tone(1760, 0.12, 0.02, { when: d + 0.08 });
  },
  "cut.alarm": (d) => {
    for (let i = 0; i < 3; i++) {
      tone(880, 0.12, 0.04, { when: d + i * 0.3, type: sq, cutoff: 2500 });
      tone(660, 0.12, 0.04, { when: d + i * 0.3 + 0.15, type: sq, cutoff: 2500 });
    }
  },
  "cut.sparkle": (d) => {
    [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone(f, 0.12, 0.025, { when: d + i * 0.05 }));
  },
  "cut.thud": (d) => {
    tone(100, 0.2, 0.15, { when: d, slideTo: 40 });
    noise(0.1, 0.06, { when: d, filter: "lowpass", freq: 600 });
  },
  "cut.gasp": (d) => {
    noise(0.25, 0.05, { when: d, filter: "bandpass", freq: 1800, sweepTo: 3200, q: 2, attack: 0.05 });
    tone(587, 0.18, 0.03, { when: d + 0.04, type: tri, slideTo: 880 });
  },
  "cut.door": (d) => {
    noise(0.5, 0.05, { when: d, filter: "bandpass", freq: 300, sweepTo: 900, q: 1, attack: 0.1 });
    tone(1319, 0.25, 0.025, { when: d + 0.3 });
  },
};

/** Shortest gap between two plays of one cue, in ms. Stops rapid UI taps from stacking. */
const MIN_GAP: Partial<Record<SfxName, number>> = { "ui.tap": 40, "cut.blip": 35, "map.step": 90, "reward.tick": 30 };
const lastAt = new Map<SfxName, number>();

export function isSfxName(value: string): value is SfxName {
  return (SFX_NAMES as readonly string[]).includes(value);
}

/** Plays a named cue. Safe to call before audio is unlocked or when sound is off: it just stays quiet. */
export function playSfx(name: SfxName, opts: SfxOptions = {}) {
  if (!soundEnabled()) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const gap = MIN_GAP[name] ?? 0;
  if (gap && now - (lastAt.get(name) ?? -Infinity) < gap) return;
  lastAt.set(name, now);
  const cue = CUES[name];
  try {
    withVoice(opts.pitch ?? 1, opts.gain ?? 1, () => cue(Math.max(0, opts.delay ?? 0), Math.max(0, Math.floor(opts.index ?? 0))));
  } catch {
    /* a sound never blocks a move */
  }
}

/** True once the browser has let audio start. */
export function audioReady() {
  return audioContext()?.state === "running";
}
