/**
 * The shared Web Audio core: one context, a master bus, and separate effect and music buses.
 * Everything that makes a sound in the game goes through here, so the Sound and Music toggles
 * and the two volume sliders reach every voice.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let soundOn = true;
let musicOn = true;
let sfxLevel = 0.8;
let musicLevel = 0.5;

/** Set while a named cue plays, so one cue can be pitched or softened as a whole. */
let pitchMul = 1;
let gainMul = 1;

const listeners = new Set<() => void>();

export function audioContext(): AudioContext | null {
  return ctx;
}

export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: "interactive" });
  } catch {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  try {
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    // A gentle limiter keeps a big cascade from clipping on phone speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    master.gain.value = 1;
    sfxBus.gain.value = 0.0001;
    musicBus.gain.value = 0.0001;
  } catch {
    ctx = null;
    master = null;
    sfxBus = null;
    musicBus = null;
    return null;
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "visible" && ctx.state === "suspended") void ctx.resume();
    if (document.visibilityState === "hidden" && ctx.state === "running") void ctx.suspend();
  });
  applyLevels();
  for (const fn of listeners) fn();
  return ctx;
}

/** Runs once the context exists (now, if it already does). */
export function onAudioReady(fn: () => void): void {
  listeners.add(fn);
  if (ctx) fn();
}

export function buses() {
  return { ctx, master, sfx: sfxBus, music: musicBus };
}

export function setSynthPrefs(sound: boolean, music: boolean) {
  soundOn = sound;
  musicOn = music;
  applyLevels();
}

/** Volumes run 0 to 100, as the settings sliders show them. */
export function setSynthVolumes(sfx: number, music: number) {
  sfxLevel = clamp01(sfx / 100);
  musicLevel = clamp01(music / 100);
  applyLevels();
}

export function soundEnabled() {
  return soundOn;
}

export function musicEnabled() {
  return musicOn;
}

export function sfxVolume() {
  return sfxLevel;
}

function applyLevels() {
  if (!ctx || !sfxBus || !musicBus) return;
  const now = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(soundOn ? Math.max(0.0001, 1.1 * sfxLevel) : 0.0001, now, 0.03);
  musicBus.gain.setTargetAtTime(musicOn ? Math.max(0.0001, 0.3 * musicLevel) : 0.0001, now, 0.05);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Plays `fn` with every tone inside it pitched and scaled. Used by named cues. */
export function withVoice(pitch: number, gain: number, fn: () => void) {
  const prevPitch = pitchMul;
  const prevGain = gainMul;
  pitchMul = prevPitch * (pitch > 0 ? pitch : 1);
  gainMul = prevGain * Math.max(0, gain);
  try {
    fn();
  } finally {
    pitchMul = prevPitch;
    gainMul = prevGain;
  }
}

export interface ToneOptions {
  type?: OscillatorType;
  /** Seconds from now, or from `at`. */
  when?: number;
  /** Absolute context time. Music uses it to stay on the grid. */
  at?: number;
  slideTo?: number;
  bus?: "sfx" | "music";
  attack?: number;
  /** Low-pass cutoff in Hz. Softens square and saw voices. */
  cutoff?: number;
  /** Vibrato depth in cents. */
  vibrato?: number;
  /** Stereo position, -1 to 1. */
  pan?: number;
  /** Destination node. Overrides `bus`. */
  dest?: AudioNode | null;
}

/** One enveloped oscillator note. Silent when its bus is switched off. */
export function tone(freq: number, dur: number, gain: number, opts: ToneOptions = {}) {
  const bus = opts.bus ?? "sfx";
  if (!ctx || !sfxBus || !musicBus) return;
  if (bus === "sfx" && !soundOn) return;
  if (bus === "music" && !musicOn) return;
  const t = opts.at !== undefined ? opts.at + (opts.when ?? 0) : ctx.currentTime + (opts.when ?? 0);
  const f = Math.max(30, freq * pitchMul);
  const peak = Math.max(0.0002, gain * gainMul);
  const attack = opts.attack ?? 0.012;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(f, t);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo * pitchMul), t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, dur));
  let head: AudioNode = osc;
  const extra: AudioNode[] = [];
  if (opts.cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = opts.cutoff;
    head.connect(lp);
    head = lp;
    extra.push(lp);
  }
  let lfo: OscillatorNode | null = null;
  if (opts.vibrato) {
    lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = opts.vibrato;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    extra.push(depth);
  }
  head.connect(amp);
  let out: AudioNode = amp;
  if (opts.pan && typeof ctx.createStereoPanner === "function") {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
    amp.connect(panner);
    out = panner;
    extra.push(panner);
  }
  out.connect(opts.dest ?? (bus === "music" ? musicBus : sfxBus));
  osc.start(t);
  osc.stop(t + dur + 0.05);
  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
    lfo?.disconnect();
    for (const node of extra) node.disconnect();
  };
}

function noiseSource(): AudioBufferSourceNode | null {
  if (!ctx) return null;
  if (!noiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 1.2);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

export interface NoiseOptions {
  when?: number;
  at?: number;
  bus?: "sfx" | "music";
  filter?: BiquadFilterType;
  freq?: number;
  q?: number;
  /** Sweeps the filter to this frequency over the burst. */
  sweepTo?: number;
  attack?: number;
  dest?: AudioNode | null;
}

/** A filtered noise burst: hats, shakers, whooshes, sparkle and glass. */
export function noise(dur: number, gain: number, opts: NoiseOptions = {}) {
  const bus = opts.bus ?? "sfx";
  if (!ctx || !sfxBus || !musicBus) return;
  if (bus === "sfx" && !soundOn) return;
  if (bus === "music" && !musicOn) return;
  const src = noiseSource();
  if (!src) return;
  const t = opts.at !== undefined ? opts.at + (opts.when ?? 0) : ctx.currentTime + (opts.when ?? 0);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter ?? "highpass";
  filter.frequency.setValueAtTime((opts.freq ?? 2000) * pitchMul, t);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo * pitchMul), t + dur);
  filter.Q.value = opts.q ?? 0.8;
  const amp = ctx.createGain();
  const attack = opts.attack ?? 0.004;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * gainMul), t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, dur));
  src.connect(filter);
  filter.connect(amp);
  amp.connect(opts.dest ?? (bus === "music" ? musicBus : sfxBus));
  // A random offset into the shared buffer keeps repeats from sounding identical.
  const offset = Math.random() * 0.6;
  src.start(t, offset, dur + 0.05);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    amp.disconnect();
  };
}

/** Note name helper for readable melodies: midi number to Hz. */
export function hz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}
