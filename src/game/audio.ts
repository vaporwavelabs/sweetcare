/**
 * The game's sound board. The Web Audio core lives in synth.ts, background music in music.ts,
 * and named cues for screens in sfx.ts. This file keeps the turn-loop sounds and the voice bites,
 * and re-exports the rest so callers only import from here. See notes/sweetcare-audio.md.
 */

import { audioContext, buses, ensureAudio, noise, setSynthPrefs, setSynthVolumes, soundEnabled, sfxVolume, tone } from "./synth.ts";
import { duckMusic, holdMusic, setMusicScene } from "./music.ts";

export { playSfx, SFX_NAMES, isSfxName, audioReady, type SfxName, type SfxOptions } from "./sfx.ts";
export { setMusicScene, setMusicIntensity, pulseMusic, duckMusic, musicScene, type MusicScene } from "./music.ts";

/** Old call shape: frequency, seconds, wave, gain, delay, slide target. */
function t(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number) {
  tone(freq, dur, gain, { type, when, slideTo });
}

export function unlockAudio() {
  try {
    const audio = ensureAudio();
    if (!audio) return;
    if (audio.state === "suspended") void audio.resume().then(() => primeBites()).catch(() => {});
    else primeBites();
  } catch {
    /* sound never blocks a ward from opening */
  }
}

export function setAudioPrefs(sound: boolean, music: boolean) {
  muteBites(!sound);
  setSynthPrefs(sound, music);
}

/** Volumes run 0 to 100, as the settings sliders show them. */
export function setVolumes(sfx: number, music: number) {
  setSynthVolumes(sfx, music);
}

type Bite = {
  src: string;
  boost: number;
  buffer: AudioBuffer | null;
  loading: Promise<AudioBuffer | null> | null;
};

function bite(src: string, boost: number): Bite {
  return { src, boost, buffer: null, loading: null };
}

const wowBite = bite("/sfx/wow.mp3", 1.7);
const faahBite = bite("/sfx/faah.mp3", 1.7);
const bruhBite = bite("/sfx/bruh.mp3", 1.5);
const cuteBite = bite("/sfx/cute.mp3", 1.6);
const rickBite = bite("/sfx/rick.mp3", 1.15);
const BITES = [wowBite, faahBite, bruhBite, cuteBite, rickBite];
const liveBites: AudioBufferSourceNode[] = [];

function loadBite(item: Bite): Promise<AudioBuffer | null> {
  const audio = ensureAudio();
  if (!audio) return Promise.resolve(null);
  if (item.buffer) return Promise.resolve(item.buffer);
  if (item.loading) return item.loading;
  item.loading = fetch(item.src)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.arrayBuffer();
    })
    .then((raw) => audio.decodeAudioData(raw.slice(0)))
    .then((buffer) => {
      item.buffer = buffer;
      return buffer;
    })
    .catch(() => {
      item.loading = null;
      return null;
    });
  return item.loading;
}

function primeBites() {
  for (const item of BITES) void loadBite(item);
}

function muteBites(muted: boolean) {
  if (!muted) return;
  for (const src of liveBites) {
    try {
      src.stop();
    } catch {
      /* already finished */
    }
  }
  liveBites.length = 0;
}

function playBite(item: Bite) {
  if (!soundEnabled()) return;
  const audio = ensureAudio();
  const master = buses().master;
  if (!audio || !master) return;
  if (audio.state === "suspended") void audio.resume();
  const start = (buffer: AudioBuffer | null) => {
    if (!buffer || !soundEnabled()) return;
    const src = audio.createBufferSource();
    const gain = audio.createGain();
    src.buffer = buffer;
    gain.gain.value = item.boost * sfxVolume();
    duckMusic(0.3, Math.round(buffer.duration * 1000));
    src.connect(gain);
    gain.connect(master);
    liveBites.push(src);
    src.onended = () => {
      const index = liveBites.indexOf(src);
      if (index >= 0) liveBites.splice(index, 1);
      src.disconnect();
      gain.disconnect();
    };
    src.start();
  };
  if (item.buffer) start(item.buffer);
  else void loadBite(item).then(start);
}

export function sfxWow() {
  playBite(wowBite);
}

/** The faaah sting. Once a chain reaches seven. */
export function sfxFaah() {
  playBite(faahBite);
}

/** Glowing orbs leaving a match. */
export function sfxOrbFly() {
  t(740, 0.14, "sine", 0.05, 0, 1480);
  t(1180, 0.1, "triangle", 0.03, 0.03, 1960);
}

let orbPopAt = 0;
let orbPopStep = 0;

/** A glitter pop when an orb lands. */
export function sfxOrbPop() {
  const ctx = audioContext();
  if (!ctx || !soundEnabled()) return;
  const now = ctx.currentTime;
  if (now < orbPopAt) return;
  orbPopAt = now + 0.055;
  orbPopStep = (orbPopStep + 1) % 6;
  const freq = 980 + orbPopStep * 80;
  t(freq, 0.055, "sine", 0.05);
  t(freq * 1.9, 0.03, "triangle", 0.02, 0.008);
}

export function sfxClick() {
  t(720, 0.04, "sine", 0.05);
}

export function sfxSwap() {
  t(340 + Math.random() * 30, 0.06, "sine", 0.07);
}

/** Two candies tumbling past each other. */
export function sfxRoll() {
  t(150, 0.11, "sine", 0.12, 0, 480);
  t(260, 0.09, "triangle", 0.08, 0.05, 130);
  t(88, 0.1, "sine", 0.1, 0.15);
  t(360, 0.06, "triangle", 0.05, 0.2);
}

export function sfxBad() {
  t(210, 0.14, "triangle", 0.06, 0, 90);
}

export function sfxMatch(combo: number) {
  const base = 480 + combo * 36 + Math.random() * 16;
  t(base, 0.1, "triangle", 0.12);
  t(base * 1.5, 0.08, "sine", 0.05, 0.02);
  t(base * 1.25, 0.12, "sine", 0.06, 0.05);
}

/** A candy landing on Nurse Karen. */
export function sfxBossHit() {
  t(160, 0.07, "square", 0.05, 0, 70);
  t(90, 0.09, "sine", 0.06);
}

/** Karen winding up. Two rising beeps, like a monitor alarm. */
export function sfxBossWarn() {
  t(660, 0.09, "square", 0.04);
  t(880, 0.12, "square", 0.045, 0.13);
}

/** Karen's attack landing. */
export function sfxBossStrike() {
  t(120, 0.18, "sawtooth", 0.06, 0, 55);
  t(70, 0.22, "sine", 0.09, 0.02);
}

/** A big hit broke her windup. */
export function sfxInterrupt() {
  t(520, 0.08, "triangle", 0.08, 0, 1040);
  t(1320, 0.12, "sine", 0.05, 0.06, 1760);
}

/** She enters a new phase. A falling growl and a sting on top. */
export function sfxBossPhase() {
  t(220, 0.45, "sawtooth", 0.05, 0, 82);
  t(330, 0.3, "square", 0.03, 0.05, 110);
  t(988, 0.16, "triangle", 0.05, 0.32);
}

/** Glass breaking, then a wet catch. */
export function sfxShatter() {
  noise(0.22, 0.42, { filter: "highpass", freq: 1800 });
  t(1480, 0.06, "square", 0.04, 0, 400);
  t(2100, 0.05, "sine", 0.035, 0.03, 200);
  t(220, 0.16, "sine", 0.06, 0.08);
}

/** A dry crack when bones line up. */
export function sfxCrack() {
  noise(0.16, 0.5, { filter: "bandpass", freq: 1600, q: 0.6 });
  t(72, 0.1, "sine", 0.1);
  t(240, 0.05, "square", 0.035, 0.015, 80);
}

/** A chain that has gone past the wow and is still falling. */
export function sfxDeep(combo: number) {
  const base = 140 + combo * 18;
  t(base, 0.22, "sawtooth", 0.045, 0, Math.max(50, base / 2));
  t(base * 2, 0.14, "triangle", 0.07, 0.06);
  t(base * 3, 0.18, "sine", 0.05, 0.12, base * 4);
}

export function sfxSpecial() {
  [523, 659, 784, 1046].forEach((freq, i) => t(freq, 0.14, "triangle", 0.08, i * 0.045));
}

/** A cute summon: low whoosh, then a bright little choir. */
export function sfxSummon() {
  t(98, 0.32, "triangle", 0.08, 0, 52);
  t(196, 0.22, "sine", 0.06, 0.04, 440);
  [392, 494, 587, 784, 988].forEach((freq, i) => t(freq, 0.16, "triangle", 0.07, 0.12 + i * 0.06));
}

let celebrating = false;
let fanfareTimer: ReturnType<typeof setInterval> | null = null;
let fanfareStep = 0;

const FANFARE: number[][] = [
  [392, 523.25, 659.25],
  [440, 554.37, 659.25],
  [523.25, 659.25, 783.99],
  [587.33, 739.99, 880],
  [659.25, 783.99, 1046.5],
  [783.99, 1046.5, 1318.5],
  [880, 1174.7, 1568],
  [659.25, 1046.5, 1318.5],
];

/** A looping celebration tune. Background music pauses until this stops. */
export function startCelebration() {
  if (celebrating) return;
  const audio = ensureAudio();
  if (!audio || !soundEnabled()) return;
  celebrating = true;
  holdMusic(true);
  const run = () => {
    if (!celebrating || fanfareTimer) return;
    const hit = () => {
      if (!celebrating || !soundEnabled()) return;
      const chord = FANFARE[fanfareStep % FANFARE.length]!;
      fanfareStep += 1;
      t(chord[0]!, 0.48, "triangle", 0.12);
      t(chord[1]!, 0.42, "sine", 0.07, 0.04);
      t(chord[2]!, 0.5, "sine", 0.09, 0.07);
      t(chord[2]! * 2, 0.2, "triangle", 0.04, 0.1);
    };
    hit();
    fanfareTimer = setInterval(hit, 520);
  };
  if (audio.state !== "running") {
    void audio.resume().then(run);
    return;
  }
  run();
}

export function stopCelebration() {
  celebrating = false;
  holdMusic(false);
  if (fanfareTimer) clearInterval(fanfareTimer);
  fanfareTimer = null;
}

export function sfxWin() {
  [523, 659, 784, 1046, 784, 1046, 1318].forEach((freq, i) => t(freq, 0.22, "sine", 0.1, i * 0.09));
  t(1568, 0.4, "triangle", 0.05, 0.72);
  t(1046, 0.28, "sine", 0.04, 0.84, 2093);
}

export function sfxLose() {
  playBite(bruhBite);
}

/** Gift reveal. Level 2 is the rick-roll sting. Every other level is the cute sting. */
export function sfxGift(levelId: number) {
  stopCelebration();
  playBite(levelId === 2 ? rickBite : cuteBite);
}

export function stopMusic() {
  setMusicScene("silence");
}

/** Coins dropping into the wallet. */
export function sfxCoins() {
  [1318, 1568, 1976].forEach((freq, i) => t(freq, 0.09, "triangle", 0.06, i * 0.07));
  t(2637, 0.16, "sine", 0.03, 0.22);
}

/** A player bumping into a hazard. */
export function hurtBuzz() {
}
