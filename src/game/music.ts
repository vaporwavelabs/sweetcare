/**
 * Procedural, adaptive background music. Every scene has its own little theme, written as
 * plain data (chords, a bass line, a lead, a drum grid) and played by a look-ahead scheduler
 * on the Web Audio clock, so notes stay on the beat even when the page is busy.
 *
 * Every theme shares the same glue: a soft heart-monitor beep on the first beat of the bar,
 * candy-bright voices, and major keys outside of boss fights.
 *
 * Intensity (0 to 1) adds layers: arpeggio and hats from 0.34, snare and a lead octave from 0.67.
 * Combos push it up for a few seconds; boss phases hold it up.
 */

import { audioContext, buses, hz, musicEnabled, noise, onAudioReady, tone } from "./synth.ts";

export type MusicScene = "title" | "map" | "ward" | "boss" | "microbe" | "heal" | "cutscene" | "silence";

type Voice = "pad" | "bass" | "lead" | "arp" | "kick" | "snare" | "hat" | "beep";

export interface Theme {
  bpm: number;
  /** Midi number of the key's root, around the lead's register. */
  root: number;
  /** One chord per bar, as semitones from the root. Cycles. */
  chords: number[][];
  /** 16 steps. A number picks a chord tone (0 = lowest), null rests. */
  bass: (number | null)[];
  /** Bars of 16 steps, semitones from the root. Cycles independently of the chords. */
  lead: (number | null)[][];
  /** 16-char grids. x = hit, o = soft hit, . = rest. */
  drums: { kick: string; snare: string; hat: string };
  leadType: OscillatorType;
  bassType: OscillatorType;
  /** Lead note length in steps. */
  leadLen: number;
  /** The floor intensity for this scene. */
  base: number;
  /** Heart-monitor beep on beat one. */
  beep: boolean;
  /** Lead vibrato in cents. */
  vibrato?: number;
  /** Low-pass on the bass, for the grittier boss voice. */
  bassCutoff?: number;
}

const _ = null;

export const THEMES: Record<Exclude<MusicScene, "silence">, Theme> = {
  // A music-box lullaby in C. No drums, just the box and a pad.
  title: {
    bpm: 84,
    root: 72,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    bass: [0, _, _, _, 2, _, _, _, 1, _, _, _, 2, _, _, _],
    lead: [
      [12, _, _, _, 11, _, 12, _, 7, _, _, _, 4, _, _, _],
      [9, _, _, _, 7, _, 9, _, 12, _, _, _, _, _, _, _],
      [5, _, _, _, 9, _, 12, _, 14, _, 12, _, 9, _, _, _],
      [7, _, _, _, 11, _, 14, _, 12, _, _, _, _, _, _, _],
    ],
    drums: { kick: "................", snare: "................", hat: "................" },
    leadType: "sine",
    bassType: "triangle",
    leadLen: 6,
    base: 0.4,
    beep: false,
  },
  // A bouncy walk in G for the map: pizzicato bass on the beat, marimba lead, shaker.
  map: {
    bpm: 104,
    root: 67,
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [2, 7, 11]],
    bass: [0, _, _, _, 2, _, _, _, 0, _, _, _, 1, _, 2, _],
    lead: [
      [7, _, 9, _, 11, _, _, _, 12, _, 11, _, 9, _, _, _],
      [12, _, _, 14, 12, _, 9, _, 5, _, _, _, _, _, _, _],
      [4, _, 7, _, 9, _, 12, _, 9, _, 7, _, 4, _, _, _],
      [2, _, _, _, 7, _, 11, _, 14, _, _, _, 12, _, 11, _],
    ],
    drums: { kick: "x.......x.......", snare: "................", hat: "..o...o...o...o." },
    leadType: "triangle",
    bassType: "sine",
    leadLen: 2,
    base: 0.36,
    beep: false,
  },
  // The everyday ward groove in F. Light pop, I vi IV V, with the monitor beep on one.
  ward: {
    bpm: 112,
    root: 65,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    bass: [0, _, _, 0, _, _, 2, _, 0, _, _, 0, _, 1, _, _],
    lead: [
      [12, _, _, 14, 16, _, 12, _, 9, _, _, _, 7, _, _, _],
      [9, _, _, 12, 14, _, 9, _, 12, _, _, _, _, _, _, _],
      [17, _, 16, _, 14, _, 12, _, 14, _, _, 16, 17, _, _, _],
      [16, _, _, 14, 11, _, _, 12, 14, _, _, _, 7, _, _, _],
      [12, _, 12, _, 16, _, 19, _, 21, _, 19, _, 16, _, _, _],
      [12, _, _, _, 9, _, 12, _, 16, _, 14, _, 12, _, _, _],
      [17, _, _, _, 21, _, 17, _, 14, _, 12, _, 14, _, _, _],
      [11, _, 14, _, 19, _, _, _, 17, _, 16, _, 14, _, _, _],
    ],
    drums: { kick: "x.......x..x....", snare: "....x.......x...", hat: "o.o.o.o.o.o.o.o." },
    leadType: "triangle",
    bassType: "triangle",
    leadLen: 2,
    base: 0.2,
    beep: true,
  },
  // Nurse Karen. A minor, driving eighths, an alarm-like square lead.
  boss: {
    bpm: 138,
    root: 69,
    chords: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]],
    bass: [0, _, 0, _, 0, _, 2, _, 0, _, 0, _, 1, _, 2, _],
    lead: [
      [12, _, _, 12, 15, _, 12, _, 19, _, _, _, 17, _, 15, _],
      [8, _, _, 12, 15, _, _, 12, 8, _, 7, _, 8, _, _, _],
      [7, _, _, 10, 12, _, 15, _, 14, _, 12, _, 10, _, _, _],
      [10, _, 14, _, 17, _, 14, _, 19, _, _, _, 22, _, _, _],
    ],
    drums: { kick: "x...x...x...x...", snare: "....x.......x..o", hat: "o.x.o.x.o.x.o.xo" },
    leadType: "square",
    bassType: "sawtooth",
    leadLen: 2,
    base: 0.3,
    beep: true,
    bassCutoff: 900,
  },
  // The microbe lab. E with a flat second, wobbly lead, skittering hats.
  microbe: {
    bpm: 122,
    root: 64,
    chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]],
    bass: [0, _, _, 0, _, 2, _, _, 0, _, _, 1, _, _, 0, _],
    lead: [
      [12, _, 13, _, 12, _, _, 7, _, _, 8, _, 7, _, _, _],
      [13, _, _, 17, 13, _, 12, _, 8, _, _, _, _, _, _, _],
      [15, _, 13, _, 12, _, 10, _, 12, _, 13, _, 15, _, _, _],
      [10, _, _, 14, 17, _, _, 14, 12, _, _, _, 10, _, _, _],
    ],
    drums: { kick: "x.....x...x.....", snare: "....x.......x...", hat: "ooxooxooxooxooxo" },
    leadType: "triangle",
    bassType: "triangle",
    leadLen: 2,
    base: 0.3,
    beep: false,
    vibrato: 28,
  },
  // Healing an organ. D major, slow, a lub-dub heartbeat kick.
  heal: {
    bpm: 92,
    root: 62,
    chords: [[0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12]],
    bass: [0, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _],
    lead: [
      [14, _, _, _, 12, _, 11, _, 9, _, _, _, 7, _, _, _],
      [11, _, _, _, 14, _, _, _, 19, _, _, _, 18, _, _, _],
      [16, _, _, _, 14, _, 12, _, 9, _, _, _, 12, _, _, _],
      [17, _, _, _, 16, _, 14, _, 12, _, _, _, _, _, _, _],
    ],
    drums: { kick: "x..o............", snare: "................", hat: "................" },
    leadType: "sine",
    bassType: "sine",
    leadLen: 4,
    base: 0.3,
    beep: true,
  },
  // Story scenes. Pad and a sparse music box over the title chords.
  cutscene: {
    bpm: 80,
    root: 72,
    chords: [[0, 4, 7], [-7, -3, 0], [-3, 0, 4], [-5, -1, 2]],
    bass: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    lead: [
      [12, _, _, _, _, _, _, _, 16, _, _, _, _, _, _, _],
      [9, _, _, _, _, _, _, _, 12, _, _, _, _, _, _, _],
      [12, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _],
      [11, _, _, _, _, _, _, _, 14, _, _, _, _, _, _, _],
    ],
    drums: { kick: "................", snare: "................", hat: "................" },
    leadType: "sine",
    bassType: "sine",
    leadLen: 8,
    base: 0.2,
    beep: false,
  },
};

export interface NoteEvent {
  voice: Voice;
  midi: number;
  /** Length in steps. */
  len: number;
  gain: number;
}

/** What one sixteenth step of a theme plays at a given intensity. Pure, for tests and the scheduler. */
export function eventsAt(theme: Theme, bar: number, step: number, intensity: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const chord = theme.chords[bar % theme.chords.length]!;
  const s = step % 16;
  const level = Math.max(theme.base, Math.min(1, intensity));
  if (s === 0) {
    for (const note of chord) out.push({ voice: "pad", midi: theme.root - 12 + note, len: 16, gain: 0.022 });
    if (theme.beep) out.push({ voice: "beep", midi: 96, len: 1, gain: 0.03 });
  }
  const pick = theme.bass[s];
  if (pick !== null && pick !== undefined) {
    const note = chord[Math.min(chord.length - 1, pick)]!;
    out.push({ voice: "bass", midi: theme.root - 24 + note, len: 2, gain: 0.09 });
  }
  const line = theme.lead[bar % theme.lead.length]!;
  const lead = line[s];
  if (lead !== null && lead !== undefined) {
    out.push({ voice: "lead", midi: theme.root + lead, len: theme.leadLen, gain: 0.05 });
    if (level >= 0.67) out.push({ voice: "lead", midi: theme.root + lead + 12, len: Math.max(1, theme.leadLen - 1), gain: 0.018 });
  }
  if (level >= 0.34 && s % 2 === 0) {
    const note = chord[(s / 2) % chord.length]!;
    out.push({ voice: "arp", midi: theme.root + 12 + note, len: 1, gain: 0.016 + level * 0.01 });
  }
  const hit = (grid: string) => grid[s] ?? ".";
  const kick = hit(theme.drums.kick);
  if (kick !== ".") out.push({ voice: "kick", midi: 0, len: 1, gain: kick === "x" ? 0.16 : 0.09 });
  const snare = hit(theme.drums.snare);
  if (snare !== "." && level >= 0.5) out.push({ voice: "snare", midi: 0, len: 1, gain: snare === "x" ? 0.07 : 0.035 });
  const hat = hit(theme.drums.hat);
  if (hat !== "." && level >= 0.34) out.push({ voice: "hat", midi: 0, len: 1, gain: hat === "x" ? 0.035 : 0.02 });
  return out;
}

interface Deck {
  scene: MusicScene;
  theme: Theme | null;
  gain: GainNode;
  step: number;
  nextTime: number;
}

let deck: Deck | null = null;
let duck: GainNode | null = null;
let wanted: MusicScene = "silence";
let timer: ReturnType<typeof setInterval> | null = null;
let held = false;
let targetIntensity = 0;
let intensity = 0;
let pulse = 0;
let pulseAt = 0;

const LOOKAHEAD = 0.14;

function startTimer() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(schedule, 30);
}

function makeDeck(scene: MusicScene): Deck | null {
  const { ctx, music } = buses();
  if (!ctx || !music) return null;
  if (!duck) {
    duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(music);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.9);
  gain.connect(duck);
  return { scene, theme: scene === "silence" ? null : THEMES[scene], gain, step: 0, nextTime: ctx.currentTime + 0.08 };
}

function retire(old: Deck) {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  old.gain.gain.cancelScheduledValues(now);
  old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now);
  old.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  window.setTimeout(() => old.gain.disconnect(), 1400);
}

function swapDeck() {
  if (deck?.scene === wanted) return;
  if (deck) retire(deck);
  deck = makeDeck(wanted);
}

function play(ev: NoteEvent, at: number, stepDur: number, theme: Theme, dest: AudioNode) {
  const dur = ev.len * stepDur;
  switch (ev.voice) {
    case "pad":
      tone(hz(ev.midi), dur * 0.98, ev.gain, { at, bus: "music", type: "triangle", attack: 0.25, cutoff: 1400, dest });
      tone(hz(ev.midi) * 1.004, dur * 0.98, ev.gain * 0.6, { at, bus: "music", type: "sine", attack: 0.3, dest });
      return;
    case "bass":
      tone(hz(ev.midi), dur * 0.9, ev.gain, { at, bus: "music", type: theme.bassType, cutoff: theme.bassCutoff, attack: 0.008, dest });
      return;
    case "lead":
      tone(hz(ev.midi), dur * 0.92, ev.gain, { at, bus: "music", type: theme.leadType, cutoff: theme.leadType === "square" ? 2200 : undefined, vibrato: theme.vibrato, attack: 0.01, dest });
      if (theme.leadType === "sine") tone(hz(ev.midi) * 2, dur * 0.4, ev.gain * 0.25, { at, bus: "music", type: "sine", dest });
      return;
    case "arp":
      tone(hz(ev.midi), stepDur * 0.9, ev.gain, { at, bus: "music", type: "sine", dest });
      return;
    case "kick":
      tone(150, 0.14, ev.gain, { at, bus: "music", type: "sine", slideTo: 45, attack: 0.003, dest });
      return;
    case "snare":
      noise(0.12, ev.gain, { at, bus: "music", filter: "bandpass", freq: 1900, q: 0.7, dest });
      tone(210, 0.06, ev.gain * 0.5, { at, bus: "music", type: "triangle", dest });
      return;
    case "hat":
      noise(0.035, ev.gain, { at, bus: "music", filter: "highpass", freq: 7200, dest });
      return;
    case "beep":
      tone(hz(ev.midi), 0.07, ev.gain, { at, bus: "music", type: "sine", attack: 0.004, dest });
      return;
  }
}

function schedule() {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return;
  swapDeck();
  const current = deck;
  if (!current?.theme || !musicEnabled() || held) {
    if (current) current.nextTime = ctx.currentTime + 0.05;
    return;
  }
  const theme = current.theme;
  const stepDur = 60 / theme.bpm / 4;
  // Ease toward the target, and let combo pulses fade over a few seconds.
  const sincePulse = (ctx.currentTime - pulseAt) / 6;
  const pulsed = Math.max(0, pulse * (1 - sincePulse));
  intensity += (Math.max(targetIntensity, pulsed) - intensity) * 0.08;
  if (current.nextTime < ctx.currentTime - 0.25) current.nextTime = ctx.currentTime + 0.02;
  while (current.nextTime < ctx.currentTime + LOOKAHEAD) {
    const bar = Math.floor(current.step / 16);
    const step = current.step % 16;
    const swing = step % 2 === 1 ? stepDur * 0.08 : 0;
    for (const ev of eventsAt(theme, bar, step, intensity)) play(ev, current.nextTime + swing, stepDur, theme, current.gain);
    current.step += 1;
    current.nextTime += stepDur;
  }
}

/** Switches the background theme. Crossfades over about half a second. */
export function setMusicScene(scene: MusicScene) {
  if (scene === wanted) return;
  wanted = scene;
  targetIntensity = 0;
  pulse = 0;
  onAudioReady(startTimer);
}

export function musicScene(): MusicScene {
  return wanted;
}

/** Holds the music at a floor intensity, 0 to 1. Boss phases use 0, 0.5 and 1. */
export function setMusicIntensity(level: number) {
  targetIntensity = Math.max(0, Math.min(1, level));
}

/** A short lift that fades over about six seconds. Combos call it. */
export function pulseMusic(level: number) {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const left = Math.max(0, pulse * (1 - (now - pulseAt) / 6));
  pulse = Math.max(left, Math.max(0, Math.min(1, level)));
  pulseAt = now;
}

/** Pauses the theme without losing its place, for the victory fanfare. */
export function holdMusic(on: boolean) {
  held = on;
}

/** Dips the music under a big sound, then brings it back. */
export function duckMusic(depth = 0.35, ms = 900) {
  const ctx = audioContext();
  if (!ctx || !duck) return;
  const now = ctx.currentTime;
  duck.gain.cancelScheduledValues(now);
  duck.gain.setValueAtTime(Math.max(0.0001, duck.gain.value), now);
  duck.gain.linearRampToValueAtTime(Math.max(0.0001, depth), now + 0.05);
  duck.gain.setTargetAtTime(1, now + ms / 1000, 0.25);
}
