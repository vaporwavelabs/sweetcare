let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let soundOn = true;
let musicOn = true;
let started = false;

const MELODY = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 392];

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);
    master.gain.value = 1;
    sfxBus.gain.value = 0.9;
    musicBus.gain.value = 0.12;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && ctx && ctx.state === "suspended") void ctx.resume();
    });
  }
  return ctx;
}

export function unlockAudio() {
  const audio = ensure();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().then(() => primeBites());
  else primeBites();
  if (!started) {
    started = true;
    musicTimer = setInterval(musicTick, 340);
  }
  applyPrefs();
}

export function setAudioPrefs(sound: boolean, music: boolean) {
  soundOn = sound;
  musicOn = music;
  muteBites(!sound);
  applyPrefs();
}

function applyPrefs() {
  if (!ctx || !sfxBus || !musicBus) return;
  const now = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(soundOn ? 0.9 : 0.0001, now, 0.03);
  musicBus.gain.setTargetAtTime(musicOn ? 0.11 : 0.0001, now, 0.05);
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  when = 0,
  slideTo?: number,
  bus: "sfx" | "music" = "sfx",
) {
  if (!ctx || !sfxBus || !musicBus) return;
  if (bus === "sfx" && !soundOn) return;
  if (bus === "music" && !musicOn) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(40, freq), t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(bus === "music" ? musicBus : sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
  };
}

function musicTick() {
  if (!musicOn || !ctx || celebrating) return;
  const freq = MELODY[step % MELODY.length]!;
  step += 1;
  if (step % 8 === 0) tone(freq / 2, 0.28, "triangle", 0.05, 0, undefined, "music");
  tone(freq, 0.22, "sine", 0.045, 0, undefined, "music");
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
  const audio = ensure();
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
  if (!soundOn) return;
  const audio = ensure();
  if (!audio || !master) return;
  if (audio.state === "suspended") void audio.resume();
  const start = (buffer: AudioBuffer | null) => {
    if (!buffer || !soundOn || !master) return;
    const src = audio.createBufferSource();
    const gain = audio.createGain();
    src.buffer = buffer;
    gain.gain.value = item.boost;
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

export function sfxClick() {
  tone(720, 0.04, "sine", 0.05);
}

export function sfxSwap() {
  tone(340 + Math.random() * 30, 0.06, "sine", 0.07);
}

/** Two candies tumbling past each other. */
export function sfxRoll() {
  tone(150, 0.11, "sine", 0.12, 0, 480);
  tone(260, 0.09, "triangle", 0.08, 0.05, 130);
  tone(88, 0.1, "sine", 0.1, 0.15);
  tone(360, 0.06, "triangle", 0.05, 0.2);
}

export function sfxBad() {
  tone(210, 0.14, "triangle", 0.06, 0, 90);
}

export function sfxMatch(combo: number) {
  const base = 480 + combo * 36 + Math.random() * 16;
  tone(base, 0.1, "triangle", 0.12);
  tone(base * 1.5, 0.08, "sine", 0.05, 0.02);
  tone(base * 1.25, 0.12, "sine", 0.06, 0.05);
}

/** A chain that has gone past the wow and is still falling. */
export function sfxDeep(combo: number) {
  const base = 140 + combo * 18;
  tone(base, 0.22, "sawtooth", 0.045, 0, Math.max(50, base / 2));
  tone(base * 2, 0.14, "triangle", 0.07, 0.06);
  tone(base * 3, 0.18, "sine", 0.05, 0.12, base * 4);
}

export function sfxSpecial() {
  [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.14, "triangle", 0.08, i * 0.045));
}

/** A cute summon: low whoosh, then a bright little choir. */
export function sfxSummon() {
  tone(98, 0.32, "triangle", 0.08, 0, 52);
  tone(196, 0.22, "sine", 0.06, 0.04, 440);
  [392, 494, 587, 784, 988].forEach((freq, i) => tone(freq, 0.16, "triangle", 0.07, 0.12 + i * 0.06));
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
  const audio = ensure();
  if (!audio || !soundOn) return;
  celebrating = true;
  const run = () => {
    if (!celebrating || fanfareTimer) return;
    const hit = () => {
      if (!celebrating || !soundOn) return;
      const chord = FANFARE[fanfareStep % FANFARE.length]!;
      fanfareStep += 1;
      tone(chord[0]!, 0.48, "triangle", 0.12);
      tone(chord[1]!, 0.42, "sine", 0.07, 0.04);
      tone(chord[2]!, 0.5, "sine", 0.09, 0.07);
      tone(chord[2]! * 2, 0.2, "triangle", 0.04, 0.1);
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
  if (fanfareTimer) clearInterval(fanfareTimer);
  fanfareTimer = null;
}

export function sfxWin() {
  [523, 659, 784, 1046, 784, 1046, 1318].forEach((freq, i) => tone(freq, 0.22, "sine", 0.1, i * 0.09));
  tone(1568, 0.4, "triangle", 0.05, 0.72);
  tone(1046, 0.28, "sine", 0.04, 0.84, 2093);
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
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
