import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, Coins, Gift, Star, Volume2, VolumeX } from "lucide-react";
import { Cheer, CountUp, DocAvatar, portrait, ProfileScreen, SketchModel } from "@/components/Profile";
import { applyRound, ACHIEVEMENTS, rankTitle } from "@/game/profile";
import {
  KINDS,
  adjacent,
  centroid,
  collapse,
  comboLabel,
  commitSwap,
  countWraps,
  createBoard,
  diveFavor,
  eraseIds,
  findHint,
  hasMove,
  keyOf,
  mulberry32,
  paintSpecials,
  planAfterSwap,
  planCross,
  planFromMatches,
  shuffleBoard,
  upgradeSpecial,
  type Board,
  type ClearPlan,
  type Kind,
  type Mask,
  type Pos,
  type Power,
  type Rng,
  type Special,
} from "@/game/engine";
import {
  HOSPITAL_KINDS,
  LEVELS,
  MAP_SPOTS,
  breakJelly,
  countJelly,
  freshCollected,
  getLevel,
  goalChips,
  goalFraction,
  goalsMet,
  journeyFor,
  levelCells,
  levelMask,
  makeJelly,
  sceneFor,
  starsFor,
  wardsOpen,
  WARD_IDS,
  type LevelDef,
} from "@/game/levels";
import {
  setAudioPrefs,
  setVolumes,
  sfxBad,
  sfxBossHit,
  sfxBossPhase,
  sfxBossStrike,
  sfxBossWarn,
  sfxInterrupt,
  sfxClick,
  sfxCoins,
  sfxCrack,
  sfxDeep,
  sfxFaah,
  sfxGift,
  sfxLose,
  sfxMatch,
  sfxOrbFly,
  sfxOrbPop,
  sfxRoll,
  sfxShatter,
  sfxSpecial,
  sfxSummon,
  sfxWin,
  sfxWow,
  startCelebration,
  stopCelebration,
  unlockAudio,
} from "@/game/audio";
import { GIFT_CARDS, cardForLevel, rememberGift } from "@/game/cards";
import { haptic, setHapticStrength, setHapticsPref } from "@/game/haptics";
import { bossTierFor, createBoss, hitBoss, MOVE_LABEL, shoveBoss as shoveKaren, stepBoss, windupProgress, type BossEvent, type BossState } from "@/game/boss";
import { makeGerm, stepGerm, woundGerm, type Germ } from "@/game/swarm";
import { generateWard } from "@/game/generator";
import { attemptFor, continueLevel, loadSave, recordWin, releaseAttempt, rememberOpened, resetProgress, totalStars, writeSave, defaultSave, type SaveData } from "@/game/save";
import { dayKey, shiftForDate } from "@/game/shifts";
import { applyMotionPref, motionReduced, type Prefs } from "@/game/prefs";
import { lossPayout, payWin, rewardsWaiting, spendFromBag, winPayout, type BoosterId, type Payout } from "@/game/rewards";
import { OptionsScreen, RewardsScreen } from "@/components/Options";
import { installErrorLog, note, readNotes, subscribeNotes, type Note } from "@/game/log";
import { applyLayout } from "@/game/layout";
import { LiquidBoard, type LiquidHandle } from "@/components/LiquidBoard";
import { LevelCreator } from "@/components/LevelCreator";
import { ParticleLayer, type ParticleHandle } from "@/components/ParticleLayer";

interface VTile {
  id: number;
  kind: Kind;
  special: Special;
  r: number;
  c: number;
  dying: boolean;
  born: boolean;
  wrap: number;
}

interface FloatText {
  id: number;
  text: string;
  r: number;
  c: number;
}

type Phase = "idle" | "busy" | "aim-blast" | "aim-stripe";

/** A cascade of 3 or more launches score orbs. */
const ORB_FROM = 3;

function splitScore(cells: Pos[], board: Board, gained: number) {
  const picked = cells.slice(0, 8);
  if (picked.length === 0 || gained <= 0) return [];
  const share = Math.floor(gained / picked.length);
  let rest = gained - share * picked.length;
  return picked.map((cell) => {
    const points = share + rest;
    rest = 0;
    return { r: cell.r, c: cell.c, kind: board[cell.r]?.[cell.c]?.kind ?? ("heart" as Kind), points };
  });
}

interface Model {
  level: LevelDef;
  board: Board;
  /** Playable cells. Absent on a full rectangle. */
  mask?: Mask;
  wrapsTotal: number;
  jelly: boolean[][];
  jellyTotal: number;
  rng: Rng;
  score: number;
  moves: number;
  collected: Record<Kind, number>;
  boosters: { blast: number; stripe: number; aid: number };
  /** Bag boosters brought into the ward. Spent after the free one. */
  bagStart: { blast: number; stripe: number; aid: number };
  payout: Payout | null;
  phase: Phase;
  selected: Pos | null;
  hint: [Pos, Pos] | null;
  outcome: "win" | "lose" | null;
  stars: number;
  banner: string | null;
  floats: FloatText[];
  rolls: { id: number; dir: 1 | -1 }[];
  flash: "win" | "summon" | null;
  countdown: string | null;
  dive: number;
  assist: boolean;
  form: number;
  startedAt: number;
  maxCombo: number;
  elapsed: number;
  badges: { id: string; label: string }[];
  rankedUp: boolean;
  curtain: "cheer" | "card" | "next";
  savedNow: boolean;
  shake: boolean;
  animate: boolean;
  view: VTile[];
  boss: BossState | null;
  /** Tiles taped down by Karen's paperwork, by tile id, with seconds left. */
  locks: Map<number, number>;
  /** Tiles she is about to tape. Shown as a warning during the windup. */
  marked: number[];
  /** Seconds left of the red hit flash on the stage. */
  sting: number;
  playerHp: number;
  germs: Germ[];
  germLeft: number;
  germKills: number;
  heal: number;
}

type Screen = "home" | "map" | "help" | "play" | "journey" | "profile" | "settings" | "rewards" | "cast" | "dev" | "creator";


const COLS = 6;

function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function reducedMotion() {
  return motionReduced();
}

function applyPrefs(prefs: Prefs) {
  setVolumes(prefs.sfxVolume, prefs.musicVolume);
  setHapticStrength(prefs.hapticStrength);
  applyMotionPref(prefs.motion);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function frames(count: number) {
  return new Promise<void>((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function readView(board: Board, dying: Set<number>, born: Set<number>, lift?: Map<number, number>): VTile[] {
  const view: VTile[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0]!.length; c++) {
      const tile = board[r]![c];
      if (!tile) continue;
      view.push({
        id: tile.id,
        kind: tile.kind,
        special: tile.special,
        r: lift?.get(tile.id) ?? r,
        c,
        dying: dying.has(tile.id),
        born: born.has(tile.id),
        wrap: tile.wrap ?? 0,
      });
    }
  }
  return view;
}

function liftAll(board: Board, delta: number) {
  const lift = new Map<number, number>();
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0]!.length; c++) {
      const tile = board[r]![c];
      if (tile) lift.set(tile.id, r + delta);
    }
  }
  return lift;
}

function exchange(model: Model, a: Pos, b: Pos) {
  const first = model.view.find((tile) => tile.r === a.r && tile.c === a.c && !tile.dying);
  const second = model.view.find((tile) => tile.r === b.r && tile.c === b.c && !tile.dying);
  if (!first || !second) return;
  const r = first.r;
  const c = first.c;
  first.r = second.r;
  first.c = second.c;
  second.r = r;
  second.c = c;
}

function plantRainbow(model: Model) {
  for (const row of model.board) {
    for (const tile of row) {
      if (tile && tile.special !== "rainbow") {
        tile.special = "rainbow";
        return;
      }
    }
  }
}

function spriteFor(tile: { kind: Kind; special: Special }) {
  return tile.special === "rainbow" ? "/sprites/rainbow.png" : `/sprites/${tile.kind}.png`;
}

export function SweetCare() {
  const modelRef = useRef<Model | null>(null);
  const runRef = useRef(0);
  const hintRef = useRef<number | null>(null);
  const shuffles = useRef(0);
  const seq = useRef(1);
  const drag = useRef<{ p: Pos; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const liquidRef = useRef<LiquidHandle | null>(null);
  const particleRef = useRef<ParticleHandle | null>(null);
  const curtainTimers = useRef<number[]>([]);
  const diskRef = useRef<SaveData>(defaultSave());
  const [screen, setScreen] = useState<Screen>("home");
  const [caseFirst, setCaseFirst] = useState(false);
  const [save, setSave] = useState<SaveData>(defaultSave);
  const [tick, setTick] = useState(0);
  const [side, setSide] = useState(300);
  const [cell, setCell] = useState(36);
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [journeyId, setJourneyId] = useState(1);
  const [creatorUid, setCreatorUid] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const forcedOpen = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;
  const bump = () => setTick((n) => n + 1);
  const renderNow = () => flushSync(() => setTick((n) => n + 1));
  const onBossTick = useRef<(dt: number, paint: boolean) => void>(() => {});

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      const paint = acc >= 0.08;
      if (paint) acc = 0;
      onBossTick.current(dt, paint);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    installErrorLog();
    setNotes(readNotes());
    return subscribeNotes(() => setNotes(readNotes()));
  }, []);

  useEffect(() => {
    const loaded = loadSave();
    diskRef.current = loaded;
    setSave(loaded);
    setAudioPrefs(loaded.sound, loaded.music);
    setHapticsPref(loaded.haptics);
    applyPrefs(loaded.prefs);
  }, []);

  useEffect(() => {
    return () => {
      curtainTimers.current.forEach((id) => window.clearTimeout(id));
      stopCelebration();
    };
  }, []);

  useLayoutEffect(() => {
    if (screen !== "play") return;
    const slot = slotRef.current;
    if (!slot) return;
    const apply = () => {
      const rect = slot.getBoundingClientRect();
      const playing = modelRef.current;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      // Arena wards stack the stage over a full-width board. Sizing from the footer's own height would shrink it every pass.
      if (playing?.level.bossHp || playing?.level.encounter) {
        const next = Math.max(160, Math.floor(width));
        setSide(next);
        setFrame({ x: 0, y: 0, w: 1, h: 1 });
        return;
      }
      const aspect = playing ? playing.level.rows / playing.level.cols : 1;
      const next = Math.max(160, Math.floor(Math.min(rect.width, rect.height / aspect)));
      const tall = next * aspect;
      setSide(next);
      setFrame({
        x: (width - next) / 2 / width,
        y: (height - tall) / 2 / height,
        w: next / width,
        h: tall / height,
      });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [screen]);

  useLayoutEffect(() => {
    if (screen !== "play") return;
    const board = boardRef.current;
    if (!board) return;
    setCell(board.clientWidth / (modelRef.current?.level.cols ?? COLS));
  }, [screen, side, tick]);

  function clearHint() {
    if (hintRef.current) window.clearTimeout(hintRef.current);
    hintRef.current = null;
  }

  function scheduleHint() {
    clearHint();
    const delay = saveRef.current.prefs.hintDelay;
    if (delay <= 0) return;
    hintRef.current = window.setTimeout(() => {
      const model = modelRef.current;
      if (!model || model.phase !== "idle" || model.outcome) return;
      model.hint = findHint(model.board);
      bump();
    }, delay * 1000);
  }

  function patchSave(recipe: (prev: SaveData) => SaveData, kind: "session" | "settings" | "checkpoint" = "session") {
    setSave((prev) => {
      const next = recipe(prev);
      if (kind === "checkpoint") {
        diskRef.current = next;
        writeSave(next);
      } else if (kind === "settings") {
        const disk = diskRef.current;
        const stored: SaveData = {
          ...disk,
          sound: next.sound,
          music: next.music,
          haptics: next.haptics,
          career: {
            ...disk.career,
            name: next.career.name,
            look: next.career.look,
            scrub: next.career.scrub,
            coat: next.career.coat,
            accessory: next.career.accessory,
          },
          gifts: next.gifts ?? disk.gifts,
          openedGifts: next.openedGifts ?? disk.openedGifts,
          loot: next.loot === true,
          decor: next.decor ?? [],
          prefs: next.prefs,
          wallet: next.wallet,
        };
        diskRef.current = stored;
        writeSave(stored);
      }
      return next;
    });
  }

  function clearCurtain() {
    curtainTimers.current.forEach((id) => window.clearTimeout(id));
    curtainTimers.current = [];
  }

  function advanceCurtain() {
    const current = modelRef.current;
    if (!current?.outcome || current.curtain === "next") return;
    current.curtain = "next";
    stopCelebration();
    bump();
  }

  function toggleSound() {
    unlockAudio();
    sfxClick();
    patchSave((prev) => {
      const next = { ...prev, sound: !prev.sound };
      setAudioPrefs(next.sound, next.music);
      return next;
    }, "settings");
  }

  function toggleMusic() {
    unlockAudio();
    sfxClick();
    patchSave((prev) => {
      const next = { ...prev, music: !prev.music };
      setAudioPrefs(next.sound, next.music);
      return next;
    }, "settings");
  }

  function toggleHaptics() {
    sfxClick();
    patchSave((prev) => {
      const next = { ...prev, haptics: !prev.haptics };
      setHapticsPref(next.haptics);
      if (next.haptics) haptic("special");
      return next;
    }, "settings");
  }

  function setPrefs(patch: Partial<Prefs>) {
    patchSave((prev) => {
      const prefs = { ...prev.prefs, ...patch };
      applyPrefs(prefs);
      return { ...prev, prefs };
    }, "settings");
  }

  function wipeProgress() {
    patchSave((prev) => resetProgress(prev), "checkpoint");
    setScreen("home");
  }

  /** Spend one booster. The free one goes first, then the bag pays. */
  function drawBooster(model: Model, which: BoosterId) {
    model.boosters[which] -= 1;
    if (model.boosters[which] < model.bagStart[which]) {
      patchSave((prev) => ({ ...prev, wallet: spendFromBag(prev.wallet, which) }), "settings");
    }
  }

  function collectGift(levelId: number) {
    const card = cardForLevel(levelId);
    patchSave((prev) => ({
      ...prev,
      gifts: rememberGift(prev.gifts, card.id),
      openedGifts: rememberOpened(prev.openedGifts, levelId),
    }), "settings");
  }

  function openProfile() {
    setCaseFirst(false);
    setScreen("profile");
  }

  function grantDevKit() {
    patchSave((prev) => ({
      ...prev,
      unlocked: 15,
      loot: true,
      stars: { ...prev.stars, "5": Math.max(prev.stars["5"] ?? 0, 1) },
      gifts: GIFT_CARDS.map((card) => card.id),
      career: {
        ...prev.career,
        rank: Math.max(prev.career.rank, 9),
        achievements: ACHIEVEMENTS.map((item) => item.id),
      },
    }), "checkpoint");
  }

  function closeProfile() {
    setCaseFirst(false);
    setScreen(modelRef.current ? "play" : "home");
  }

  async function deal(run: number) {
    const beats = reducedMotion() ? [] : ["Ready", "3", "2", "1"];
    const stalled = () => forcedOpen.current === run || runRef.current !== run;
    if (!reducedMotion()) {
      await frames(2);
      if (stalled()) return;
      const opening = modelRef.current;
      if (!opening) return;
      opening.animate = true;
      opening.view = readView(opening.board, new Set(), new Set());
      bump();
    }
    for (const beat of beats) {
      if (stalled()) return;
      const model = modelRef.current;
      if (!model) return;
      model.countdown = beat;
      sfxClick();
      bump();
      await wait(beat === "Ready" ? 720 : 640);
    }
    if (stalled()) return;
    const model = modelRef.current;
    if (!model) return;
    model.countdown = null;
    model.view = readView(model.board, new Set(), new Set());
    model.animate = true;
    model.phase = "idle";
    scheduleHint();
    bump();
  }

  function assistOpen(run: number, reason: string) {
    if (forcedOpen.current === run || runRef.current !== run) return;
    const model = modelRef.current;
    if (!model) return;
    if (model.phase === "idle" && !model.countdown) return;
    forcedOpen.current = run;
    note("Launch assist", reason);
    model.countdown = null;
    model.phase = "idle";
    model.animate = true;
    if (model.view.length === 0) model.view = readView(model.board, new Set(), new Set());
    setScreen("play");
    scheduleHint();
    bump();
  }

  function startLevel(id: number, custom?: LevelDef) {
    try {
      unlockAudio();
      sfxClick();
    } catch (error) {
      note("Audio", error);
    }
    clearHint();
    clearCurtain();
    stopCelebration();
    const run = ++runRef.current;
    shuffles.current = 0;
    try {
    const attempt = custom ? { save: saveRef.current, seed: Math.floor(Math.random() * 2 ** 31), shiftId: "fully-staffed" as const } : attemptFor(saveRef.current, id);
    if (attempt.save !== saveRef.current) {
      saveRef.current = attempt.save;
      writeSave(attempt.save);
      setSave(attempt.save);
    }
    const scripted = custom ?? getLevel(id);
    const level = custom || scripted.bossHp || scripted.encounter || id >= 16
      ? scripted
      : generateWard(id, attempt.seed, attempt.shiftId);
    const rng = mulberry32((attempt.seed ^ (id * 9973)) >>> 0);
    const mask = levelMask(level);
    const board = createBoard(rng, level.rows, level.cols, level.kinds, mask);
    const cells = levelCells(level);
    if (cells) applyLayout(board, cells);
    if (level.startSpecial) {
      const mid = board[Math.floor(level.rows / 2)]?.[Math.floor(level.cols / 2)];
      if (mid) mid.special = level.startSpecial;
    }
    const jelly = makeJelly(level);
    const model: Model = {
      level,
      board,
      mask,
      wrapsTotal: countWraps(board),
      jelly,
      jellyTotal: countJelly(jelly),
      rng,
      score: 0,
      moves: level.moves,
      collected: freshCollected(),
      boosters: { blast: 1 + saveRef.current.wallet.bag.blast, stripe: 1 + saveRef.current.wallet.bag.stripe, aid: 1 + saveRef.current.wallet.bag.aid },
      bagStart: { ...saveRef.current.wallet.bag },
      payout: null,
      phase: "busy",
      selected: null,
      hint: null,
      outcome: null,
      stars: 0,
      banner: null,
      floats: [],
      rolls: [],
      flash: null,
      countdown: null,
      dive: 0,
      assist: level.id >= 3,
      form: 0,
      startedAt: Date.now(),
      maxCombo: 0,
      elapsed: 0,
      badges: [],
      rankedUp: false,
      curtain: "cheer",
      savedNow: false,
      shake: false,
      animate: false,
      view: [],
      boss: level.bossHp ? createBoss(level.bossHp, bossTierFor(level.id, level.bossHp), attempt.seed ^ level.id) : null,
      locks: new Map(),
      marked: [],
      sting: 0,
      playerHp: 100,
      germs: [],
      germLeft: level.swarm?.count ?? 0,
      germKills: 0,
      heal: 0,
    };
    if (level.swarm) {
      const first = makeGerm(++seq.current, 0, level.swarm, false);
      const second = makeGerm(++seq.current, 1, level.swarm, false);
      first.y = 28;
      second.y = 14;
      model.germs.push(first, second);
      model.germLeft = Math.max(0, level.swarm.count - 2);
    }
    model.view = readView(board, new Set(), new Set(), reducedMotion() ? undefined : liftAll(board, -level.rows));
    modelRef.current = model;
    flushSync(() => {
      setScreen("play");
      setTick((n) => n + 1);
    });
    void deal(run);
    window.setTimeout(() => assistOpen(run, "The ward did not finish opening."), 7000);
    } catch (error) {
      note("Start", error);
      setScreen("home");
      setLogOpen(true);
    }
  }

  function openLevel(id: number) {
    if (journeyFor(id)) {
      setJourneyId(id);
      setScreen("journey");
      return;
    }
    startLevel(id);
  }

  function leavePlay() {
    const custom = modelRef.current?.level.custom;
    runRef.current += 1;
    clearHint();
    clearCurtain();
    stopCelebration();
    modelRef.current = null;
    setScreen(custom ? "creator" : "map");
  }

  function goHome() {
    runRef.current += 1;
    clearHint();
    clearCurtain();
    stopCelebration();
    modelRef.current = null;
    setScreen("home");
  }

  function summonImps(model: Model, cells: { r: number; c: number }[], count: number, quiet = false) {
    model.flash = "summon";
    if (!quiet) sfxSummon();
    liquidRef.current?.splash(cells, 1.45);
    particleRef.current?.summon(cells, count);
    window.setTimeout(() => {
      const current = modelRef.current;
      if (!current) return;
      if (current.flash === "summon") current.flash = null;
      bump();
    }, 1000);
  }

  function spawnGerm(model: Model) {
    const swarm = model.level.swarm;
    if (!swarm || model.germLeft <= 0) return;
    model.germLeft -= 1;
    const n = model.germKills + model.germs.length;
    const germ = makeGerm(++seq.current, n, swarm, model.germLeft === 0);
    model.germs.push(germ);
    if (germ.kind === "mother") {
      say(model, "Mother cell!");
      sfxBossWarn();
    }
  }

  function hurtGerm(model: Model, amount: number) {
    const swarm = model.level.swarm;
    if (!swarm || amount <= 0 || model.germs.length === 0) return;
    const lead = model.germs.reduce((best, germ) => (germ.y > best.y ? germ : best));
    const hit = woundGerm(lead, amount, () => ++seq.current, swarm);
    particleRef.current?.impact(amount, lead.kind === "mother" ? "crit" : "hit");
    haptic("boss-hit");
    if (hit.dead) {
      model.germs = model.germs.filter((germ) => germ.id !== lead.id);
      model.germs.push(...hit.buds);
      model.germKills += 1;
      say(model, hit.buds.length ? "She split!" : "Fended off!", 800);
      if (model.germLeft <= 0 && model.germs.length === 0) {
        window.setTimeout(() => {
          void finish(runRef.current);
        }, 420);
      }
    }
    bump();
  }

  function woundBoss(model: Model, amount: number, big = false) {
    const boss = model.boss;
    if (!boss || boss.hp <= 0 || amount <= 0) return;
    const wasExposed = Boolean(boss.action);
    const { dealt, events } = hitBoss(boss, amount, big);
    if (boss.guard > 0 && dealt === 0) particleRef.current?.impact(0, "guard");
    else particleRef.current?.impact(dealt, wasExposed || big ? "crit" : "hit");
    if (dealt > 0) haptic("boss-hit");
    for (const event of events) applyBossEvent(model, event);
    bump();
  }

  function shoveBoss(model: Model, push: boolean) {
    if (!model.boss || model.boss.hp <= 0) return;
    shoveKaren(model.boss, push);
    bump();
  }

  function loseRound(model: Model, banner: string) {
    model.elapsed = Math.max(0, Date.now() - model.startedAt);
    model.badges = model.maxCombo >= 5 ? [{ id: "streak", label: "5 streak" }] : [];
    model.outcome = "lose";
    model.curtain = "card";
    model.phase = "idle";
    model.banner = banner;
    sfxLose();
    haptic("lose");
    closeRound(model, false, model.elapsed);
    bump();
  }

  /** A boss line on the board that clears itself, unless something newer replaced it. */
  function say(model: Model, text: string, ms = 1100) {
    model.banner = text;
    window.setTimeout(() => {
      const current = modelRef.current;
      if (current?.banner === text) current.banner = null;
      bump();
    }, ms);
  }

  /** Karen's telegraphs and strikes, turned into board effects. */
  function applyBossEvent(model: Model, event: BossEvent) {
    if (event.type === "telegraph") {
      sfxBossWarn();
      if (event.move === "paperwork") {
        const free: number[] = [];
        for (const row of model.board) for (const tile of row) if (tile && !tile.special && !model.locks.has(tile.id)) free.push(tile.id);
        const picked: number[] = [];
        while (picked.length < event.power && free.length > 0) {
          const index = Math.floor(model.rng() * free.length);
          picked.push(free.splice(index, 1)[0]!);
        }
        model.marked = picked;
      }
      return;
    }
    if (event.type === "interrupt") {
      model.marked = [];
      say(model, "Interrupted!");
      sfxInterrupt();
      particleRef.current?.bossBurst("interrupt");
      return;
    }
    if (event.type === "phase") {
      model.marked = [];
      say(model, event.phase === 1 ? "Karen is fuming!" : "Karen lost it!");
      model.flash = "summon";
      sfxBossPhase();
      particleRef.current?.bossBurst("phase");
      window.setTimeout(() => {
        const current = modelRef.current;
        if (current?.flash === "summon") current.flash = null;
        bump();
      }, 700);
      return;
    }
    if (event.type === "down") {
      model.marked = [];
      model.locks.clear();
      say(model, "Karen is down!");
      haptic("power");
      particleRef.current?.bossBurst("down");
      return;
    }
    if (event.type === "heal") {
      say(model, "She had a coffee");
      particleRef.current?.impact(event.amount, "heal");
      return;
    }
    if (event.type === "contact") {
      model.playerHp = Math.max(0, model.playerHp - event.bite);
      model.marked = [];
      model.sting = 0.5;
      model.shake = true;
      say(model, "She grabbed the chart!");
      sfxBad();
      sfxBossStrike();
      haptic("hurt");
      window.setTimeout(() => {
        const current = modelRef.current;
        if (current) current.shake = false;
      }, 300);
      if (model.playerHp <= 0) loseRound(model, "Karen reached the icons");
      return;
    }
    // A strike.
    sfxBossStrike();
    haptic("hurt");
    if (event.move === "paperwork") {
      const cells: Pos[] = [];
      for (let r = 0; r < model.board.length; r++) {
        for (let c = 0; c < model.board[0]!.length; c++) {
          const tile = model.board[r]![c];
          if (tile && model.marked.includes(tile.id)) {
            model.locks.set(tile.id, 9);
            cells.push({ r, c });
          }
        }
      }
      model.marked = [];
      particleRef.current?.paper(cells);
      say(model, "Taped down!");
    } else if (event.move === "writeup") {
      const taken = Math.min(event.power, Math.max(0, model.moves - 1));
      model.moves -= taken;
      model.sting = 0.45;
      say(model, taken > 0 ? `Write-up! -${taken} move${taken > 1 ? "s" : ""}` : "Write-up!");
    } else if (event.move === "charge") {
      model.sting = 0.35;
      say(model, "She charged!");
    }
  }

  async function playPlan(run: number, plan: ClearPlan) {
    const model = modelRef.current;
    if (!model || runRef.current !== run || model.outcome) return;
    const jellyBroken = breakJelly(model.jelly, plan.removals);
    const gained = plan.score + jellyBroken * 40;
    for (const kind of KINDS) model.collected[kind] += plan.collected[kind];
    const feeds = plan.feeds.map((feed) => ({ ...feed }));
    if (feeds.length > 0) feeds[0]!.points += jellyBroken * 40;
    const bossFight = Boolean(model.level.bossHp) || model.level.encounter === "microbe";
    const orbStreak = !bossFight && plan.combo >= ORB_FROM && gained > 0;
    if (!orbStreak || reducedMotion() || !particleRef.current) model.score += gained;
    else {
      const sources = feeds.some((feed) => feed.points > 0) ? feeds : splitScore(plan.removals, model.board, gained);
      if (sources.length === 0) model.score += gained;
      else {
        particleRef.current.scoreFly(sources, (points) => {
          const current = modelRef.current;
          if (!current) return;
          current.score += points;
          sfxOrbPop();
          bump();
        });
        sfxOrbFly();
      }
    }
    const detonated: { r: number; c: number; special: Power }[] = [];
    for (const cell of plan.removals) {
      const tile = model.board[cell.r]?.[cell.c];
      if (tile?.special) detonated.push({ r: cell.r, c: cell.c, special: tile.special });
      if (tile) model.locks.delete(tile.id);
    }
    const painted = paintSpecials(model.board, plan);
    liquidRef.current?.splash(plan.removals, Math.min(2.4, 0.85 + plan.combo * 0.22));
    model.view = readView(model.board, new Set(painted.dyingIds), new Set(painted.bornIds));
    model.animate = true;
    model.rolls = [];
    model.banner = plan.banner;
    model.dive = plan.combo;
    model.shake = saveRef.current.prefs.shake && (plan.removals.length >= 8 || plan.combo >= 6);
    const center = centroid(plan.removals);
    const floatId = ++seq.current;
    model.floats = [...model.floats.slice(-4), { id: floatId, text: `+${gained}`, r: center.r, c: center.c }];
    const bits = plan.removals.slice(0, 12).flatMap((cell) => {
      const kind = model.board[cell.r]?.[cell.c]?.kind;
      return kind ? [{ r: cell.r, c: cell.c, kind }] : [];
    });
    if (bits.length > 0) particleRef.current?.burst(bits);
    particleRef.current?.pop(bits, plan.combo);
    if (detonated.length > 0) particleRef.current?.detonate(detonated);
    const bigHit = plan.combo >= 3 || detonated.length > 0 || plan.removals.length >= 5;
    if (model.boss && plan.removals.length >= 3) {
      const hits = plan.removals.flatMap((cell) => {
        const kind = model.board[cell.r]?.[cell.c]?.kind;
        return kind ? [{ r: cell.r, c: cell.c, kind }] : [];
      });
      sfxBossHit();
      if (hits.length === 0 || reducedMotion() || !particleRef.current) {
        woundBoss(model, hits.length * 4, bigHit);
        shoveBoss(model, true);
      } else {
        sfxOrbFly();
        let landed = 0;
        particleRef.current.bossFly(hits, 4, (damage) => {
          const current = modelRef.current;
          if (!current || current.outcome) return;
          landed += 1;
          // The first orb of a big volley is the one that can break a windup.
          woundBoss(current, damage, bigHit && landed === 1);
          shoveBoss(current, landed % 3 === 0);
          sfxOrbPop();
        });
      }
    }
    if (model.level.encounter === "heal") {
      let red = 0;
      for (const cell of plan.removals) {
        const kind = model.board[cell.r]?.[cell.c]?.kind;
        if (kind === "heart" || kind === "cross") red += 1;
      }
      if (red > 0) {
        model.heal += red;
        if (!model.banner) model.banner = "Healing";
      }
    }
    if (model.level.encounter === "microbe" && plan.removals.length >= 3) {
      const hits = plan.removals.flatMap((cell) => {
        const kind = model.board[cell.r]?.[cell.c]?.kind;
        return kind ? [{ r: cell.r, c: cell.c, kind }] : [];
      });
      if (hits.length === 0 || reducedMotion() || !particleRef.current) hurtGerm(model, hits.length * 4);
      else {
        sfxOrbFly();
        particleRef.current.bossFly(hits, 4, (damage) => {
          const current = modelRef.current;
          if (!current || current.outcome) return;
          hurtGerm(current, damage);
          sfxOrbPop();
        });
      }
    }
    const liquidTint: Partial<Record<Kind, "urine" | "lab" | "water">> = {
      iv: "urine",
      eyewash: "water",
    };
    const glassKinds = new Set<Kind>(["flask", "tubes", "cyl", "goggles"]);
    const boneKinds = new Set<Kind>(["xray", "ribs", "pelvis"]);
    const byKind = new Map<Kind, { r: number; c: number }[]>();
    let bones = 0;
    let shattered = false;
    for (const cell of plan.removals) {
      const kind = model.board[cell.r]?.[cell.c]?.kind;
      if (!kind) continue;
      if (liquidTint[kind] || glassKinds.has(kind)) {
        const list = byKind.get(kind) ?? [];
        list.push(cell);
        byKind.set(kind, list);
      }
      if (boneKinds.has(kind)) bones += 1;
    }
    for (const [kind, cells] of byKind) {
      if (cells.length < 3) continue;
      if (glassKinds.has(kind)) {
        particleRef.current?.spill(cells, "red", true);
        shattered = true;
        continue;
      }
      const tint = liquidTint[kind];
      if (tint) particleRef.current?.spill(cells, tint, false);
    }
    if (bones >= 3) sfxCrack();
    const summoned = plan.spawns.filter((spawn) => spawn.special === "bomb" || spawn.special === "rainbow");
    if (model.shake || summoned.length > 0) haptic("power");
    else if (plan.spawns.length > 0) haptic("special");
    else haptic("match", plan.combo);
    if (summoned.length > 0) summonImps(model, summoned, 8, plan.combo === 7);
    else if (plan.combo === 7) {
      /* the faaah sting already started for this clear */
    } else if (plan.combo >= 6) sfxDeep(plan.combo);
    else if (plan.spawns.length > 0 || (plan.banner && plan.combo < 2)) sfxSpecial();
    else if (shattered) sfxShatter();
    else sfxMatch(plan.combo);
    bump();
    window.setTimeout(() => {
      const current = modelRef.current;
      if (!current) return;
      current.floats = current.floats.filter((item) => item.id !== floatId);
      if (current.banner === plan.banner) current.banner = null;
      bump();
    }, plan.banner === "Wow!" || plan.banner === "Faaah!" ? 1700 : 720);
    await wait(reducedMotion() ? 40 : 250);
    if (runRef.current !== run || !modelRef.current) return;
    const pre = new Map<number, number>();
    for (let r = 0; r < model.board.length; r++) {
      for (let c = 0; c < model.board[0]!.length; c++) {
        const tile = model.board[r]![c];
        if (tile) pre.set(tile.id, r);
      }
    }
    eraseIds(model.board, painted.dyingIds);
    const spent = model.assist;
    const fell = collapse(model.board, model.rng, model.level.kinds, diveFavor(model.level.id, spent), model.mask);
    if (spent) model.assist = false;
    model.board = fell.board;
    const lift = new Map<number, number>();
    const born = new Set<number>();
    for (const spawn of fell.spawned) {
      lift.set(spawn.id, spawn.fromR);
      born.add(spawn.id);
    }
    for (let r = 0; r < model.board.length; r++) {
      for (let c = 0; c < model.board[0]!.length; c++) {
        const tile = model.board[r]![c];
        if (!tile || born.has(tile.id)) continue;
        const from = pre.get(tile.id);
        if (from !== undefined && from !== r) lift.set(tile.id, from);
      }
    }
    model.animate = false;
    model.shake = false;
    model.view = readView(model.board, new Set(), born, reducedMotion() ? undefined : lift);
    renderNow();
    await frames(2);
    if (runRef.current !== run || !modelRef.current) return;
    model.animate = true;
    model.view = readView(model.board, new Set(), born);
    bump();
    await wait(reducedMotion() ? 40 : 320);
  }

  function closeRound(model: Model, won: boolean, elapsed: number) {
    if (model.level.custom) {
      model.rankedUp = false;
      model.savedNow = false;
      return;
    }
    const prev = saveRef.current;
    const key = String(model.level.id);
    const destroyed = KINDS.reduce((sum, kind) => sum + model.collected[kind], 0);
    const already = (prev.stars[key] ?? 0) > 0;
    const cleared = Object.values(prev.stars).filter((n) => n > 0).length + (won && !already ? 1 : 0);
    const applied = applyRound(
      prev.career,
      {
        won,
        score: model.score,
        prevBest: prev.best[key] ?? 0,
        stars: model.stars,
        maxCombo: model.maxCombo,
        levelId: model.level.id,
        destroyed,
        timeRecord: won && (prev.times[key] == null || elapsed < prev.times[key]!),
        elapsed,
      },
      cleared,
    );
    model.rankedUp = applied.rankedUp;
    model.savedNow = won;
    const today = dayKey();
    const payout = won
      ? winPayout(prev.wallet, {
          levelId: model.level.id,
          stars: model.stars,
          prevStars: prev.stars[key] ?? 0,
          movesLeft: Math.max(0, model.moves),
          boss: Boolean(model.level.bossHp || model.level.encounter === "microbe"),
          today,
        })
      : lossPayout();
    model.payout = payout;
    patchSave((current) => {
      const base = won ? releaseAttempt(recordWin(current, model.level.id, model.stars, model.score, elapsed), model.level.id) : current;
      const wallet = won ? payWin(current.wallet, payout, today) : { ...current.wallet, coins: current.wallet.coins + payout.total, earned: current.wallet.earned + payout.total };
      return { ...base, career: applied.career, wallet };
    }, won ? "checkpoint" : "session");
    if (!won) patchSave((current) => current, "settings");
  }

  onBossTick.current = (dt, paint) => {
    const model = modelRef.current;
    if (!model || model.outcome || model.countdown) return;
    model.sting = Math.max(0, model.sting - dt);
    if (model.locks.size > 0) {
      for (const [id, left] of model.locks) {
        if (left - dt <= 0) model.locks.delete(id);
        else model.locks.set(id, left - dt);
      }
    }
    if (model.level.encounter === "microbe" && model.level.swarm) {
      const swarm = model.level.swarm;
      while (model.germs.length < 3 && model.germLeft > 0) spawnGerm(model);
      for (const germ of [...model.germs]) {
        if (!stepGerm(germ, swarm, dt)) continue;
        const bite = germ.kind === "mother" ? swarm.bite * 2 : swarm.bite;
        model.playerHp = Math.max(0, model.playerHp - bite);
        model.germs = model.germs.filter((item) => item.id !== germ.id);
        say(model, "A microbe reached the ward");
        model.sting = 0.4;
        sfxBad();
        haptic("hurt");
        if (model.playerHp <= 0) {
          loseRound(model, "The microbes got through");
          return;
        }
        if (model.germLeft <= 0 && model.germs.length === 0 && model.phase === "idle") void finish(runRef.current);
      }
      if (paint) bump();
      return;
    }
    const boss = model.boss;
    if (!boss || boss.hp <= 0) return;
    for (const event of stepBoss(boss, dt)) {
      applyBossEvent(model, event);
      if (model.outcome) return;
    }
    if (paint) bump();
  };

  async function finish(run: number) {
    const model = modelRef.current;
    if (!model || runRef.current !== run || model.outcome) return;
    const progress = { score: model.score, collected: model.collected, jellyLeft: countJelly(model.jelly), wrapsLeft: countWraps(model.board) };
    const healed = model.level.encounter === "heal" && model.heal >= (model.level.healNeed ?? 1);
    // A leak costs life, not the ward: the wave is cleared once every germ has been dealt with.
    const cleared = model.level.encounter === "microbe" && model.germLeft <= 0 && model.germs.length === 0;
    const wonGoal = model.boss ? model.boss.hp <= 0 : healed || cleared ? true : model.level.encounter ? false : goalsMet(model.level, progress);
    if (wonGoal) {
      const bonus = model.moves * 100;
      if (bonus > 0) {
        model.score += bonus;
        model.banner = `+${bonus} move bonus`;
      }
      const elapsed = Math.max(0, Date.now() - model.startedAt);
      const key = String(model.level.id);
      const prev = saveRef.current;
      const badges: { id: string; label: string }[] = [];
      if (model.maxCombo >= 5) badges.push({ id: "streak", label: "5 streak" });
      if (model.score > (prev.best[key] ?? 0)) badges.push({ id: "score", label: "High score" });
      if (prev.times[key] == null || elapsed < prev.times[key]!) badges.push({ id: "time", label: "Time record" });
      model.elapsed = elapsed;
      model.badges = badges;
      model.stars = starsFor(model.level, model.score, true);
      model.outcome = "win";
      model.phase = "idle";
      model.flash = "win";
      model.curtain = "card";
      particleRef.current?.rain();
      particleRef.current?.stars();
      unlockAudio();
      sfxWin();
      haptic("win");
      startCelebration();
      closeRound(model, true, elapsed);
      bump();
      return;
    }
    if (model.moves <= 0) {
      model.elapsed = Math.max(0, Date.now() - model.startedAt);
      model.badges = model.maxCombo >= 5 ? [{ id: "streak", label: "5 streak" }] : [];
      model.outcome = "lose";
      model.curtain = "card";
      model.phase = "idle";
      sfxLose();
      haptic("lose");
      closeRound(model, false, model.elapsed);
      bump();
      return;
    }
    if (!hasMove(model.board)) {
      if (shuffles.current >= 2) {
        plantRainbow(model);
        shuffles.current = 0;
        model.view = readView(model.board, new Set(), new Set());
      } else {
        shuffles.current += 1;
        model.banner = "Reshuffle!";
        model.board = shuffleBoard(model.board, model.rng);
        model.view = readView(model.board, new Set(), new Set());
        model.animate = true;
        bump();
        await wait(260);
        if (runRef.current !== run || !modelRef.current) return;
        const follow = planFromMatches(modelRef.current.board, 1);
        if (follow) {
          await runClears(run, follow, 1);
          return;
        }
      }
    } else shuffles.current = 0;
    model.phase = "idle";
    model.selected = null;
    scheduleHint();
    bump();
  }

  async function runClears(run: number, first: ClearPlan | null, comboStart: number) {
    let combo = comboStart;
    let plan = first;
    let celebrated = false;
    let yelled = false;
    let step = 0;
    while (plan && runRef.current === run) {
      step += 1;
      const depth = Math.max(step, plan.combo);
      if (depth >= 7 && !yelled) {
        yelled = true;
        celebrated = true;
        plan.banner = "Faaah!";
        unlockAudio();
        sfxFaah();
      } else if (depth >= 5 && !celebrated) {
        celebrated = true;
        plan.banner = "Wow!";
        unlockAudio();
        sfxWow();
        particleRef.current?.stars();
      }
      const current = modelRef.current;
      if (current) current.maxCombo = Math.max(current.maxCombo, Math.max(step, plan.combo));
      await playPlan(run, plan);
      if (runRef.current !== run || !modelRef.current) return;
      combo += 1;
      plan = planFromMatches(modelRef.current.board, combo);
    }
    if (modelRef.current && runRef.current === run) {
      modelRef.current.dive = 0;
      bump();
    }
    await finish(run);
  }

  async function playSwap(a: Pos, b: Pos) {
    const model = modelRef.current;
    if (!model || model.phase !== "idle" || model.outcome || model.moves <= 0) return;
    if (!adjacent(a, b)) return;
    const stuck = [a, b].some((pos) => {
      const tile = model.board[pos.r]?.[pos.c];
      return Boolean(tile && model.locks.has(tile.id));
    });
    if (stuck) {
      model.selected = null;
      model.banner = "Taped down!";
      sfxBad();
      bump();
      window.setTimeout(() => {
        const current = modelRef.current;
        if (current?.banner === "Taped down!") current.banner = null;
        bump();
      }, 700);
      return;
    }
    const run = runRef.current;
    unlockAudio();
    clearHint();
    model.hint = null;
    model.selected = null;
    model.phase = "busy";
    model.animate = true;
    exchange(model, a, b);
    const there = model.view.find((tile) => tile.r === b.r && tile.c === b.c && !tile.dying);
    const back = model.view.find((tile) => tile.r === a.r && tile.c === a.c && !tile.dying);
    model.rolls = [there ? { id: there.id, dir: 1 as const } : null, back ? { id: back.id, dir: -1 as const } : null].filter(
      (roll): roll is { id: number; dir: 1 | -1 } => roll !== null,
    );
    bump();
    sfxRoll();
    haptic("swap");
    await wait(reducedMotion() ? 40 : 320);
    if (runRef.current !== run || !modelRef.current) return;
    if (!commitSwap(model.board, a, b)) {
      exchange(model, a, b);
      const backThere = model.view.find((tile) => tile.r === b.r && tile.c === b.c && !tile.dying);
      const backBack = model.view.find((tile) => tile.r === a.r && tile.c === a.c && !tile.dying);
      model.rolls = [
        backThere ? { id: backThere.id, dir: -1 as const } : null,
        backBack ? { id: backBack.id, dir: 1 as const } : null,
      ].filter((roll): roll is { id: number; dir: 1 | -1 } => roll !== null);
      sfxRoll();
      sfxBad();
      haptic("bad");
      model.form = 0;
      bump();
      await wait(reducedMotion() ? 40 : 280);
      if (runRef.current !== run || !modelRef.current) return;
      modelRef.current.phase = "idle";
      modelRef.current.rolls = [];
      scheduleHint();
      bump();
      return;
    }
    model.moves -= 1;
    model.rolls = [];
    if (model.level.id >= 3 && !model.assist) {
      model.form += 1;
      if (model.form >= 2) {
        model.assist = true;
        model.form = 0;
      }
    }
    bump();
    await runClears(run, planAfterSwap(model.board, a, b, 1), 1);
  }

  function handleTap(pos: Pos) {
    const model = modelRef.current;
    if (!model || model.outcome) return;
    unlockAudio();
    if (model.phase === "aim-blast") {
      if (model.boosters.blast <= 0) return;
      const plan = planCross(model.board, pos);
      if (!plan) return;
      drawBooster(model, "blast");
      model.phase = "busy";
      model.selected = null;
      clearHint();
      void runClears(runRef.current, plan, 1);
      return;
    }
    if (model.phase === "aim-stripe") {
      const tile = model.board[pos.r]?.[pos.c];
      if (!tile || model.boosters.stripe <= 0) return;
      drawBooster(model, "stripe");
      upgradeSpecial(tile, pos.c);
      model.phase = "idle";
      model.view = readView(model.board, new Set(), new Set([tile.id]));
      sfxSpecial();
      haptic("special");
      bump();
      return;
    }
    if (model.phase !== "idle") return;
    const selected = model.selected;
    if (!selected) {
      model.selected = pos;
      haptic("tap");
      bump();
      return;
    }
    if (selected.r === pos.r && selected.c === pos.c) {
      model.selected = null;
      bump();
      return;
    }
    if (adjacent(selected, pos)) {
      void playSwap(selected, pos);
      return;
    }
    model.selected = pos;
    bump();
  }

  function cancelAim() {
    const current = modelRef.current;
    if (!current) return;
    current.phase = "idle";
    bump();
  }

  function useAid() {
    const model = modelRef.current;
    if (!model || model.phase === "busy" || model.outcome || model.boosters.aid <= 0) return;
    unlockAudio();
    drawBooster(model, "aid");
    model.moves += 5;
    model.banner = "Summoned!";
    model.phase = "idle";
    haptic("special");
    const mid = { r: Math.floor((model.level.rows - 1) / 2), c: Math.floor((model.level.cols - 1) / 2) };
    summonImps(
      model,
      [
        mid,
        { r: mid.r, c: Math.max(0, mid.c - 1) },
        { r: mid.r, c: Math.min(model.level.cols - 1, mid.c + 1) },
      ],
      9,
    );
    bump();
    window.setTimeout(() => {
      const current = modelRef.current;
      if (current?.banner === "Summoned!") current.banner = null;
      bump();
    }, 900);
  }

  function arm(which: "blast" | "stripe") {
    const model = modelRef.current;
    if (!model || model.phase === "busy" || model.outcome) return;
    if (model.boosters[which] <= 0) return;
    unlockAudio();
    sfxClick();
    const next: Phase = which === "blast" ? "aim-blast" : "aim-stripe";
    model.phase = model.phase === next ? "idle" : next;
    model.selected = null;
    bump();
  }

  function cellFromEvent(event: React.PointerEvent) {
    const board = boardRef.current;
    const model = modelRef.current;
    if (!board || !model) return null;
    const rect = board.getBoundingClientRect();
    const cols = model.level.cols;
    const rows = model.level.rows;
    const c = Math.floor(((event.clientX - rect.left) / rect.width) * cols);
    const r = Math.floor(((event.clientY - rect.top) / rect.height) * rows);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
    return { r, c };
  }

  const model = modelRef.current;

  return (
    <main
      className={screen === "play" && model ? "app play-mode" : "app"}
      style={screen === "play" && model ? { ["--scene" as string]: `url(${model.level.bossHp ? "/scenes/boss.jpg" : model.level.encounter ? "/scenes/care.jpg" : `/scenes/${String(model.level.id).padStart(2, "0")}.jpg`})` } : undefined}
    >
      {screen === "home" ? (
        <Home
          save={save}
          onNew={() => { sfxClick(); setScreen("cast"); }}
          onContinue={() => openLevel(continueLevel(save))}
          onMap={() => { sfxClick(); setScreen("map"); }}
          onSettings={() => { sfxClick(); setScreen("settings"); }}
          onRewards={() => { sfxClick(); setScreen("rewards"); }}
          onDev={() => { sfxClick(); setScreen("dev"); }}
          onCreator={() => { sfxClick(); setScreen("creator"); }}
          onSound={toggleSound}
          onProfile={openProfile}
          notes={notes}
          logOpen={logOpen}
          onToggleLog={() => setLogOpen((open) => !open)}
        />
      ) : null}
      {screen === "cast" ? (
        <Cast
          save={save}
          onBack={() => setScreen("home")}
          onStart={(look, name) => {
            patchSave((prev) => ({ ...prev, career: { ...prev.career, look, name } }), "settings");
            openLevel(1);
          }}
        />
      ) : null}
      {screen === "creator" ? (
        <LevelCreator
          initialUid={creatorUid}
          onBack={() => setScreen("home")}
          onPlay={(level, uid) => {
            setCreatorUid(uid);
            startLevel(level.id, level);
          }}
        />
      ) : null}
      {screen === "map" ? <MapScreen save={save} onBack={() => setScreen("home")} onPick={(id) => openLevel(id)} onCollect={collectGift} /> : null}
      {screen === "help" ? <Help onBack={() => setScreen("settings")} /> : null}
      {screen === "settings" ? (
        <OptionsScreen
          save={save}
          onBack={() => setScreen("home")}
          onSound={toggleSound}
          onMusic={toggleMusic}
          onHaptics={toggleHaptics}
          onPrefs={setPrefs}
          onHelp={() => { sfxClick(); setScreen("help"); }}
          onReset={wipeProgress}
        />
      ) : null}
      {screen === "rewards" ? (
        <RewardsScreen
          save={save}
          onBack={() => setScreen("home")}
          onWallet={(recipe) => {
            unlockAudio();
            sfxCoins();
            patchSave((prev) => ({ ...prev, wallet: recipe(prev.wallet, totalStars(prev)) }), "settings");
          }}
        />
      ) : null}
      {screen === "dev" ? (
        <DevMenu
          onBack={() => setScreen("home")}
          onLevel={(id) => startLevel(id)}
          onProfile={() => setScreen("profile")}
          onCase={() => {
            grantDevKit();
            setCaseFirst(true);
            setScreen("profile");
          }}
          onUnlock={grantDevKit}
          notes={notes}
        />
      ) : null}
      {screen === "profile" ? <ProfileScreen save={save} openCase={caseFirst} onBack={closeProfile} onReplay={(id) => openLevel(id)} onChange={(recipe) => patchSave(recipe, "settings")} /> : null}
      {screen === "journey" ? <Journey levelId={journeyId} portraitSrc={portrait(save.career)} onArrive={() => startLevel(journeyId)} /> : null}
      {screen === "play" && model ? (
        <Play
          model={model}
          save={save}
          side={side}
          cell={cell}
          slotRef={slotRef}
          frame={frame}
          boardRef={boardRef}
          liquidRef={liquidRef}
          particleRef={particleRef}
          onBack={leavePlay}
          onSound={toggleSound}
          onProfile={openProfile}
          onAid={useAid}
          onCancel={cancelAim}
          onArm={arm}
          onAdvance={advanceCurtain}
          onRetry={() => startLevel(model.level.id, model.level.custom ? model.level : undefined)}
          onNext={() => (model.level.custom ? leavePlay() : model.level.id === 5 ? setScreen("map") : openLevel(model.level.id + 1))}
          onHome={goHome}
          onCollect={collectGift}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const current = modelRef.current;
            if (!current || current.phase !== "idle" || current.outcome) return;
            unlockAudio();
            const pos = cellFromEvent(event);
            if (!pos) return;
            drag.current = { p: pos, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            const current = modelRef.current;
            if (!start || !current || current.phase !== "idle" || current.outcome) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.hypot(dx, dy) < 16) return;
            drag.current = null;
            const next = Math.abs(dx) > Math.abs(dy) ? { r: start.p.r, c: start.p.c + Math.sign(dx) } : { r: start.p.r + Math.sign(dy), c: start.p.c };
            if (next.r < 0 || next.c < 0 || next.r >= current.level.rows || next.c >= current.level.cols) return;
            void playSwap(start.p, next);
          }}
          onPointerUp={() => {
            const start = drag.current;
            drag.current = null;
            if (!start) return;
            handleTap(start.p);
          }}
        />
      ) : null}
    </main>
  );
}

function Cast({
  save,
  onBack,
  onStart,
}: {
  save: SaveData;
  onBack: () => void;
  onStart: (look: "m" | "f", name: string) => void;
}) {
  const [look, setLook] = useState<"m" | "f">(save.career.look === "f" ? "f" : "m");
  const [name, setName] = useState(save.career.name);
  return (
    <div className="column cast">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
        <h2>New game</h2>
        <span />
      </div>
      <div className="scroll">
        <p className="tagline">Choose your nurse</p>
        <div className="cast-row">
          <button type="button" className={look === "m" ? "cast-card on" : "cast-card"} onClick={() => setLook("m")}>
            <img src="/avatar/idle.png" alt="" />
            <b>Male nurse</b>
          </button>
          <button type="button" className={look === "f" ? "cast-card on" : "cast-card"} onClick={() => setLook("f")}>
            <img src="/avatar/idle-f.png" alt="" />
            <b>Female nurse</b>
          </button>
        </div>
        <label className="name-field cast-name">
          <span className="kicker">Name</span>
          <input value={name} maxLength={16} onChange={(event) => setName(event.target.value.slice(0, 16))} />
        </label>
        <button
          className="btn"
          type="button"
          onClick={() => onStart(look, name.trim().slice(0, 16) || (look === "f" ? "Mia" : "Alex"))}
        >
          Start
        </button>
      </div>
    </div>
  );
}

function ShiftChip() {
  const shift = shiftForDate();
  return (
    <p className="shift-chip" title={shift.blurb}>
      Today's shift · {shift.label}
    </p>
  );
}

function Home({ save, onNew, onContinue, onMap, onSettings, onRewards, onDev, onCreator, onSound, onProfile, notes, logOpen, onToggleLog }: { save: SaveData; onNew: () => void; onContinue: () => void; onMap: () => void; onSettings: () => void; onRewards: () => void; onDev: () => void; onCreator: () => void; onSound: () => void; onProfile: () => void; notes: Note[]; logOpen: boolean; onToggleLog: () => void }) {
  const played = save.unlocked > 1 || Object.values(save.stars).some((n) => n > 0);
  const waiting = rewardsWaiting(save.wallet, totalStars(save), dayKey());
  return (
    <div className="column home">
      <div className="crush-nav">
        <button className="icon-btn" type="button" onClick={onSound} aria-label={save.sound ? "Mute sound" : "Sound on"}>
          {save.sound ? <Volume2 /> : <VolumeX />}
        </button>
        <img className="header-title" src="/ui/crush-title.png" alt="Sweet Care Crush" />
        <button className="avatar-btn" type="button" onClick={onProfile} aria-label={`${save.career.name} profile`}>
          <DocAvatar career={save.career} />
        </button>
      </div>
      <div className="scroll">
        <p className="tagline">Match the sweets. Mend the ward.</p>
        <ShiftChip />
        <div className="home-purse">
          <p className="star-total home-stars">
            <Star className="star on" aria-hidden />
            {totalStars(save)}/{LEVELS.length * 3}
          </p>
          <p className="star-total coin-total">
            <Coins className="coin-icon" aria-hidden />
            {save.wallet.coins}
          </p>
        </div>
        <div className="hero-row" aria-hidden>
          {HOSPITAL_KINDS.map((kind) => (
            <img key={kind} src={`/sprites/${kind}.png`} alt="" />
          ))}
        </div>
        <div className="stack">
          <button className="btn" type="button" onClick={onNew}>New Game</button>
          <button className="btn" type="button" onClick={onContinue} disabled={!played}>Continue</button>
          <button className="btn secondary" type="button" onClick={onMap}>World map</button>
          <button className={waiting ? "btn rewards-btn ready" : "btn secondary rewards-btn"} type="button" onClick={onRewards}>
            <Gift aria-hidden />
            Rewards
            {waiting ? <span className="ready-dot" aria-label={`${waiting} ready`}>{waiting}</span> : null}
          </button>
          <button className="btn secondary" type="button" onClick={onCreator}>Level creator</button>
          <button className="btn secondary" type="button" onClick={onSettings}>Settings</button>
          <button className="btn secondary" type="button" onClick={onDev}>Dev</button>
          <button className="btn secondary" type="button" onClick={onToggleLog}>Launch log{notes.length ? ` (${notes.length})` : ""}</button>
        </div>
        {logOpen ? <LaunchLog notes={notes} /> : null}
      </div>
    </div>
  );
}

function DevMenu({
  onBack,
  onLevel,
  onUnlock,
  onProfile,
  onCase,
  notes,
}: {
  onBack: () => void;
  onLevel: (id: number) => void;
  onUnlock: () => void;
  onProfile: () => void;
  onCase: () => void;
  notes: Note[];
}) {
  return (
    <div className="column help">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h2>Dev</h2>
        <span />
      </div>
      <div className="scroll">
        <div className="stack">
          <button className="btn" type="button" onClick={onUnlock}>Unlock cosmetics and case</button>
          <button className="btn secondary" type="button" onClick={onProfile}>Profile</button>
          <button className="btn secondary" type="button" onClick={onCase}>Loot case</button>
        </div>
        <h3>Launch log</h3>
        <LaunchLog notes={notes} />
        <h3>Levels</h3>
        <div className="stack">
          {LEVELS.map((level) => (
            <button key={level.id} className="btn secondary" type="button" onClick={() => onLevel(level.id)}>
              {level.id}. {level.name}{level.bossHp ? " · Boss" : ""}{level.encounter === "microbe" ? " · Microbes" : ""}{level.encounter === "heal" ? " · Heal" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapScreen({ save, onBack, onPick, onCollect }: { save: SaveData; onBack: () => void; onPick: (id: number) => void; onCollect: (levelId: number) => void }) {
  const nextId = continueLevel(save);
  const next = save.seeds[String(nextId)]
    ? generateWard(nextId, save.seeds[String(nextId)]!, save.attemptShifts[String(nextId)] ?? shiftForDate().id)
    : getLevel(nextId);
  const spot = MAP_SPOTS.find((item) => item.id === nextId) ?? MAP_SPOTS[0]!;
  const [zoomed, setZoomed] = useState(true);
  const [opening, setOpening] = useState<number | null>(null);
  const opened = save.openedGifts ?? [];
  const pendingGifts = MAP_SPOTS.filter((pin) => {
    const stars = save.stars[String(pin.id)] ?? 0;
    const finished = stars >= 1 || pin.id < save.unlocked;
    return finished && !opened.includes(pin.id);
  });
  return (
    <div className="column map">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h2>World map</h2>
        <span className="star-total"><Star className="star on" aria-hidden />{totalStars(save)}</span>
      </div>
      <ShiftChip />
      <button className="zoom-toggle" type="button" onClick={() => setZoomed((on) => !on)}>
        {zoomed ? "Whole island" : "Zoom to next"}
      </button>
      <div className="island-wrap">
        <IslandCamera focusX={spot.x} focusY={spot.y} zoom={zoomed}>
          {MAP_SPOTS.map((pin) => {
            const bonus = pin.id >= 26;
            const side = pin.id >= 16 && !bonus;
            const locked = bonus ? false : !side && pin.id > save.unlocked;
            const stars = save.stars[String(pin.id)] ?? 0;
            const mark = pin.id === 16 ? "N" : pin.id === 17 ? "L" : pin.id === 18 ? "O" : String(pin.id);
            return (
              <button key={pin.id} type="button" className={`pin${locked ? " locked" : ""}${pin.id === nextId ? " current" : ""}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} disabled={locked} onClick={() => onPick(pin.id)} aria-label={side ? getLevel(pin.id).name : `Level ${pin.id}`}>
                {mark}
                <Stars n={locked ? 0 : stars} tiny />
              </button>
            );
          })}
          {MAP_SPOTS.map((pin) => {
            const stars = save.stars[String(pin.id)] ?? 0;
            if (stars < 1 || opened.includes(pin.id)) return null;
            return (
              <button key={`gift-${pin.id}`} type="button" className="pin-gift" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} aria-label={`Open secret gift for level ${pin.id}`} onClick={() => {
                unlockAudio();
                sfxGift(pin.id);
                onCollect(pin.id);
                setOpening(pin.id);
              }}>
                <GiftBox />
              </button>
            );
          })}
          <img className="traveler" src={portrait(save.career)} alt="" style={{ left: `${spot.x}%`, top: `${spot.y}%` }} />
        </IslandCamera>
        <p className="map-caption">{(save.stars["5"] ?? 0) > 0 ? "Pick your next ward" : zoomed ? `Next · ${next.name}` : "Pick a ward"}</p>
      </div>
      {pendingGifts.length > 0 ? (
        <div className="map-gift-dock">
          {pendingGifts.map((pin) => (
            <button key={`dock-${pin.id}`} type="button" className="present-btn claim" aria-label={`Level ${pin.id} secret gift`} onClick={() => {
              unlockAudio();
              sfxGift(pin.id);
              onCollect(pin.id);
              setOpening(pin.id);
            }}>
              <span className="claim-gift"><GiftBox /></span>
              <span className="secret-kicker">Level {pin.id} gift</span>
            </button>
          ))}
        </div>
      ) : null}
      {opening != null ? <CardReveal levelId={opening} onClose={() => setOpening(null)} /> : null}
      <div className="ward-row">
        {WARD_IDS.map((id) => {
          const open = wardsOpen(save.stars);
          const level = getLevel(id);
          return (
            <button key={id} type="button" disabled={!open} onClick={() => onPick(id)}>
              {level.name}
            </button>
          );
        })}
      </div>
      {wardsOpen(save.stars) ? null : <p className="summary-note ward-lock">Beat Nurse Karen to choose a ward.</p>}
    </div>
  );
}

function IslandCamera({ focusX, focusY, zoom, children }: { focusX: number; focusY: number; zoom: boolean; children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<() => void>(() => {});
  const [xf, setXf] = useState("translate(0px, 0px) scale(1)");
  useEffect(() => {
    const wrap = frameRef.current?.parentElement;
    const frame = frameRef.current;
    if (!wrap || !frame) return;
    const apply = () => {
      if (!zoom) {
        setXf("translate(0px, 0px) scale(1)");
        return;
      }
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      const frameW = frame.offsetWidth;
      const frameH = frame.offsetHeight;
      if (frameW < 8 || frameH < 8 || width < 8) return;
      const scale = 2.45;
      const localX = (focusX / 100) * frameW;
      const localY = (focusY / 100) * frameH;
      const tx = width / 2 - frame.offsetLeft - localX * scale;
      const ty = height / 2 - frame.offsetTop - localY * scale;
      setXf(`translate(${tx}px, ${ty}px) scale(${scale})`);
    };
    measureRef.current = apply;
    const timer = window.setTimeout(apply, 70);
    const observer = new ResizeObserver(apply);
    observer.observe(wrap);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [zoom, focusX, focusY]);
  return (
    <div className="island-frame camera" ref={frameRef} style={{ transform: xf }}>
      <img className="island" src="/map/island.jpg" alt="" onLoad={() => measureRef.current()} />
      {children}
    </div>
  );
}

function Journey({ levelId, portraitSrc, onArrive }: { levelId: number; portraitSrc: string; onArrive: () => void }) {
  const trip = journeyFor(levelId)!;
  const [gone, setGone] = useState(false);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  useEffect(() => {
    const walk = window.setTimeout(() => setGone(true), 80);
    const done = window.setTimeout(() => arriveRef.current(), 2200);
    const assist = window.setTimeout(() => {
      note("Launch assist", "The walk stalled. Starting the ward.");
      arriveRef.current();
    }, 4000);
    return () => {
      window.clearTimeout(walk);
      window.clearTimeout(done);
      window.clearTimeout(assist);
    };
  }, [levelId]);
  return (
    <div className="column map">
      <div className="map-head"><span /><h2>{trip.title}</h2><span /></div>
      <button className="island-wrap journey" type="button" onClick={onArrive} aria-label="Skip the walk">
        <IslandCamera focusX={trip.toX} focusY={trip.toY} zoom={gone}>
          <img className="traveler walk" src={portraitSrc} alt="" style={{ left: `${gone ? trip.toX : trip.fromX}%`, top: `${gone ? trip.toY : trip.fromY}%` }} />
        </IslandCamera>
      </button>
      <button className="btn" type="button" onClick={onArrive}>Start ward</button>
    </div>
  );
}

function Help({ onBack }: { onBack: () => void }) {
  const rules = [
    { src: "/sprites/heart.png", text: "Swap neighbors so three or more of a kind line up." },
    { src: "/sprites/pill.png", text: "Match four for a stripe that clears a whole line." },
    { src: "/sprites/cross.png", text: "An L or T makes a burst. Five in a line makes a rainbow." },
    { src: "/sprites/nurse.png", text: "Pair a rainbow with any candy to clear that color. Beat the goal before moves run out." },
  ];
  return (
    <div className="column help">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h2>How to care</h2>
        <span />
      </div>
      <div className="scroll">
        <div className="rules">
          {rules.map((rule) => (
            <div className="rule" key={rule.src}><img src={rule.src} alt="" /><p>{rule.text}</p></div>
          ))}
        </div>
        <button className="btn" type="button" onClick={onBack}>Got it</button>
      </div>
    </div>
  );
}

function Stars({ n, tiny = false }: { n: number; tiny?: boolean }) {
  return (
    <span className="stars" aria-label={`${n} stars`}>
      {[0, 1, 2].map((index) => (
        <Star key={index} className={index < n ? "star on" : "star"} style={tiny ? undefined : { animationDelay: `${index * 80}ms` }} />
      ))}
    </span>
  );
}

function meterName(value: number, resting: boolean) {
  if (resting) return value > 0 ? "Best" : "Combo";
  if (value >= 8) return "Abyss";
  if (value === 7) return "Faaah";
  if (value === 6) return "Dive";
  if (value === 4) return "Super";
  return comboLabel(value)?.replace("!", "") ?? "Combo";
}

function ComboCounter({ live, best }: { live: number; best: number }) {
  const [held, setHeld] = useState(0);
  useEffect(() => {
    if (live >= 2) {
      setHeld(live);
      return;
    }
    const id = window.setTimeout(() => setHeld(0), 1100);
    return () => window.clearTimeout(id);
  }, [live]);
  const chaining = live >= 2;
  const settling = !chaining && held >= 2;
  const resting = !chaining && !settling;
  const shownBest = best >= 2 ? best : 0;
  const value = chaining ? live : settling ? held : shownBest;
  const tier = value >= 7 ? "faah" : value >= 5 ? "wow" : "";
  const mode = chaining ? "hot" : settling ? "settle" : shownBest > 0 ? "best" : "idle";
  const filled = Math.min(Math.max(value, 0), 7);
  return (
    <div className={`combo-meter ${mode} ${tier}`} aria-live="polite" aria-label={`${meterName(value, resting)} ${value}`}>
      <span className="combo-kicker">{meterName(value, resting)}</span>
      <span className="combo-pips" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => {
          const newest = chaining && i === filled - 1;
          return <i key={newest ? `n${value}` : i} className={i < filled ? (newest ? "on fresh" : "on") : ""} />;
        })}
      </span>
      <b className="combo-num" key={chaining ? `c${value}` : "rest"}>{value > 0 ? `x${value}` : "x0"}</b>
    </div>
  );
}

function Play({
  model, save, side, cell, slotRef, frame, boardRef, liquidRef, particleRef, onBack, onSound, onProfile, onAid, onCancel, onArm, onAdvance, onRetry, onNext, onHome, onCollect, onPointerDown, onPointerMove, onPointerUp,
}: {
  model: Model;
  save: SaveData;
  side: number;
  cell: number;
  slotRef: React.RefObject<HTMLDivElement | null>;
  frame: { x: number; y: number; w: number; h: number };
  boardRef: React.RefObject<HTMLDivElement | null>;
  liquidRef: React.RefObject<LiquidHandle | null>;
  particleRef: React.RefObject<ParticleHandle | null>;
  onBack: () => void;
  onSound: () => void;
  onProfile: () => void;
  onAid: () => void;
  onCancel: () => void;
  onArm: (which: "blast" | "stripe") => void;
  onAdvance: () => void;
  onRetry: () => void;
  onNext: () => void;
  onHome: () => void;
  onCollect: (levelId: number) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const progress = { score: model.score, collected: model.collected, jellyLeft: countJelly(model.jelly), wrapsLeft: countWraps(model.board) };
  const boss = model.boss;
  const bossMax = boss?.max ?? 0;
  const microbes = model.level.encounter === "microbe";
  const healing = model.level.encounter === "heal";
  const arena = bossMax > 0 || microbes || healing;
  const healNeed = model.level.healNeed ?? 1;
  const germQuota = model.level.swarm?.count ?? 1;
  const healPct = Math.min(100, Math.round((model.heal / healNeed) * 100));
  const frac = bossMax
    ? Math.max(0, 1 - (boss?.hp ?? 0) / bossMax)
    : healing
      ? Math.min(1, model.heal / healNeed)
      : microbes
        ? Math.min(1, model.germKills / germQuota)
        : goalFraction(model.level, progress, model.jellyTotal, model.wrapsTotal);
  const chips = arena ? [] : goalChips(model.level, progress, model.jellyTotal, model.wrapsTotal);
  const best = save.best[String(model.level.id)] ?? 0;
  const hintKeys = new Set((model.hint ?? []).map((pos) => keyOf(pos)));
  const icon = cell * 1.08;
  const scoreRef = useRef<HTMLElement | null>(null);
  const bossRef = useRef<HTMLElement | null>(null);
  const [kitOpen, setKitOpen] = useState(false);
  const scene = bossMax ? "/scenes/boss.jpg" : arena ? "/scenes/care.jpg" : `/scenes/${String(sceneFor(model.level)).padStart(2, "0")}.jpg`;
  const cols = model.level.cols;
  const rows = model.level.rows;
  const boardH = Math.round(side * rows / cols);
  const grid = (
    <>
      <LiquidBoard rows={rows} cols={cols} jelly={model.jelly} holes={model.mask} revision={model.score + model.moves + countJelly(model.jelly)} scene={scene} frame={arena ? { x: 0, y: 0, w: 1, h: 1 } : frame} apiRef={liquidRef} />
      <div className={`board-shell${model.shake ? " shake" : ""}${arena ? " icon-panel footer-grid" : ""}${arena && model.sting > 0 ? " contact" : ""}`} style={{ width: arena ? "100%" : side, height: boardH }}>
        <div className="board" ref={boardRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="application" aria-label={`${model.level.name} board`}>
          <div className={`pieces${model.animate ? " anim" : ""}`}>
            {model.view.map((tile) => {
              const selected = model.selected?.r === tile.r && model.selected?.c === tile.c;
              const roll = model.rolls.find((item) => item.id === tile.id);
              return (
                <div key={tile.id} className={["tile", tile.dying ? "dying" : "", tile.born ? "born" : "", selected ? "sel" : "", tile.wrap ? `wrapped wrap-${tile.wrap}` : "", hintKeys.has(`${tile.r},${tile.c}`) ? "hint" : "", model.locks.has(tile.id) ? "taped" : "", model.marked.includes(tile.id) ? "marked" : "", tile.special ? `power-${tile.special}` : "", roll ? (roll.dir > 0 ? "roll-cw" : "roll-ccw") : ""].filter(Boolean).join(" ")} style={{ width: icon, height: icon, transform: `translate(${tile.c * cell + (cell - icon) / 2}px, ${tile.r * cell + (cell - icon) / 2}px)` }}>
                  <img className="candy" src={spriteFor(tile)} alt="" draggable={false} />
                  {tile.special === "row" || tile.special === "col" ? <span className="shine" /> : null}
                  {tile.special === "bomb" ? <span className="ring" /> : null}
                  {tile.wrap ? <span className="wrap-band" aria-hidden /> : null}
                </div>
              );
            })}
          </div>
          {model.floats.map((item) => (
            <span key={item.id} className="floater" style={{ left: `${((item.c + 0.5) / cols) * 100}%`, top: `${((item.r + 0.5) / rows) * 100}%` }}>{item.text}</span>
          ))}
          {model.flash ? <div className={`fx-flash ${model.flash}`} /> : null}
          {model.banner ? <div className="banner">{model.banner}</div> : null}
          {model.countdown ? (
            <div className="count-down" aria-live="assertive"><b key={model.countdown} className={/\d/.test(model.countdown) ? "" : "word"}>{model.countdown}</b></div>
          ) : null}
        </div>
      </div>
    </>
  );
  return (
    <div className={`column play${arena ? " boss-play" : ""}`}>
      <div className="crush-nav">
        <span className="nav-side">
          <button className="icon-btn" type="button" onClick={onBack} aria-label="Back to map"><ChevronLeft /></button>
          <button className="icon-btn" type="button" onClick={onSound} aria-label={save.sound ? "Mute sound" : "Sound on"}>{save.sound ? <Volume2 /> : <VolumeX />}</button>
        </span>
        <img className="header-title" src="/ui/crush-title.png" alt="Sweet Care Crush" />
        <button className="avatar-btn" type="button" onClick={onProfile} aria-label={`${save.career.name} profile`}>
          <DocAvatar career={save.career} />
        </button>
      </div>
      <section className="crush-hud">
        <div className="level-slab">
          <b className="lvl-num">{model.level.custom ? "✎" : model.level.id}</b>
          <div className="lvl-copy">
            <div className="lvl-kicker">{model.level.shiftLabel ?? "Level"} {model.level.boss ? `· ${model.level.boss}` : ""}</div>
            <div className="lvl-name">{model.level.name}</div>
            <div className="bar" aria-hidden><span style={{ width: `${Math.round(frac * 100)}%` }} /></div>
          </div>
        </div>
        {chips.length ? (
          <ul className="goal-chips" aria-label="Goals">
            {chips.map((chip) => (
              <li key={chip.key} className={chip.done ? "done" : ""}>
                {chip.kind ? <img src={`/sprites/${chip.kind}.png`} alt={chip.kind} /> : <i className={chip.jelly ? "chip-jelly" : chip.wrap ? "chip-wrap" : "chip-score"} aria-label={chip.jelly ? "Jelly" : chip.wrap ? "Wraps" : "Score"} />}
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="score-slab">
          <div className="hs-col">
            <span className="kicker">High Score</span>
            <strong className="live-score" ref={scoreRef} key={model.score}>{model.score}</strong>
            <span className="capsule" aria-hidden><i className="seg red" /><i className="seg gold" /><i className="seg violet" /></span>
            <span className="sr-only">Score {model.score}. Best {best}.</span>
          </div>
          <div className="mv-col"><span className="kicker">Moves:</span><strong>{model.moves}</strong></div>
        </div>
      </section>
      <ComboCounter live={model.dive} best={model.maxCombo} />
      {boss ? (
        <div className={`boss-strip phase-${boss.phase}${model.sting > 0 ? " stung" : ""}`}>
          <div className="boss-meters">
            <div>
              <div className="meter-label">
                <span>{boss.profile.name}<i className="phase-pips" aria-label={`Phase ${boss.phase + 1} of 3`}>{[0, 1, 2].map((n) => <b key={n} className={n <= boss.phase ? "on" : ""} />)}</i></span>
                <span>{boss.hp <= 0 ? "Down" : boss.guard > 0 ? "Guard" : boss.hp}</span>
              </div>
              <div className={`boss-bar${boss.guard > 0 ? " guarded" : ""}`} role="meter" aria-label={`${boss.profile.name} health`} aria-valuenow={boss.hp} aria-valuemin={0} aria-valuemax={bossMax}>
                <em style={{ width: `${Math.round((boss.hp / bossMax) * 100)}%` }} />
                <span style={{ width: `${Math.round((boss.hp / bossMax) * 100)}%` }} />
                <s style={{ left: "33.3%" }} />
                <s style={{ left: "66.6%" }} />
              </div>
            </div>
            <div>
              <div className="meter-label"><span>Your life</span><span>{Math.ceil(model.playerHp)}</span></div>
              <div className="boss-bar life-bar" role="meter" aria-label="Your life" aria-valuenow={Math.ceil(model.playerHp)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.max(0, model.playerHp)}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {microbes ? (
        <div className="boss-strip">
          <div className="boss-meters">
            <div>
              <div className="meter-label"><span>Fended off</span><span>{model.germKills}/{germQuota}</span></div>
              <div className="boss-bar" role="meter" aria-label="Microbes fended off" aria-valuenow={model.germKills} aria-valuemin={0} aria-valuemax={germQuota}>
                <span style={{ width: `${Math.round((model.germKills / germQuota) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="meter-label"><span>Your life</span><span>{Math.ceil(model.playerHp)}</span></div>
              <div className="boss-bar life-bar" role="meter" aria-label="Your life" aria-valuenow={Math.ceil(model.playerHp)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.max(0, model.playerHp)}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className={`play-stage${arena ? " boss-stage" : ""}`} ref={arena ? undefined : slotRef}>
        {boss ? (
          <>
            <span className="danger-glow" aria-hidden style={{ opacity: Math.max(0, (boss.near - 55) / 45) }} />
            {boss.action?.move === "charge" ? (
              <span className="charge-lane" aria-hidden style={{ left: `${12 + boss.lane * 76}%`, top: `${boss.near * 0.58}%`, ["--wind" as string]: String(windupProgress(boss)) }} />
            ) : null}
            <span ref={bossRef} className={["karen-walk", boss.hot > 0 ? "hot" : "", boss.slow > 0 ? "hurt" : "", boss.action ? `winding ${boss.action.move}` : "", boss.guard > 0 ? "guard" : "", `phase-${boss.phase}`, boss.hp <= 0 ? "down" : ""].filter(Boolean).join(" ")} style={{ left: `${12 + boss.lane * 76}%`, top: `${boss.near * 0.58}%`, ["--depth" as string]: String(0.86 + boss.near * 0.0026) }}>
              {boss.action ? (
                <span className={`intent ${boss.action.move}`} role="status" style={{ ["--wind" as string]: String(windupProgress(boss)) }}>
                  <i aria-hidden />
                  {MOVE_LABEL[boss.action.move]}
                </span>
              ) : boss.hot > 0 ? <span className="hot-line">I'm hot!</span> : null}
              {boss.hot > 0 || boss.action?.move === "coffee" ? <span className="steam" /> : null}
              <span className="karen-fan">
                <KarenWalk slow={boss.slow > 0 || boss.hot > 0} facing={boss.dir} paused={Boolean(model.outcome) || boss.hp <= 0 || Boolean(boss.action)} />
              </span>
            </span>
          </>
        ) : microbes ? (
          <>
            <div className="objectives">
              <b>Current Objectives</b>
              <p>Hold the ward. Match 3 and send the pieces into the microbes.</p>
            </div>
            <span className="focal" aria-hidden />
            {model.germs.map((germ) => {
              const lead = model.germs.reduce((best, item) => (item.y > best.y ? item : best));
              return (
                <span key={germ.id} ref={germ.id === lead.id ? bossRef : undefined} className={["germ", germ.kind, germ.hurt > 0 ? "hit" : "", germ.tell > 0 ? "tell" : "", germ.dash > 0 ? "dash" : ""].filter(Boolean).join(" ")} style={{ left: `${germ.x}%`, top: `${germ.y}%` }}>
                  <img src={germ.kind === "mother" ? "/sprites/germ-boss.png" : `/sprites/germ-${germ.sprite}.png`} alt="" />
                  <i style={{ width: `${Math.max(0, (germ.hp / germ.max) * 100)}%` }} />
                </span>
              );
            })}
          </>
        ) : healing ? (
          <>
            <div className="objectives">
              <b>Current Objectives</b>
              <p>Progressive Care Unit: Match red puzzle pieces to heal</p>
              <div className="heal-meter" role="meter" aria-label="Healed" aria-valuenow={healPct} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${healPct}%` }} />
                <em>{healPct}% healed</em>
              </div>
            </div>
            <div className="patient" style={{ ["--sick" as string]: String(1 - Math.min(1, model.heal / healNeed)) }}>
              <img src={model.level.patient === "heart" ? "/sprites/organ-heart.png" : "/sprites/brain.png"} alt="" />
            </div>
          </>
        ) : grid}
      </div>
      {model.phase === "aim-blast" || model.phase === "aim-stripe" ? (
        <p className="aim-note">Tap a candy<button type="button" onClick={onCancel}>Cancel</button></p>
      ) : null}
      {arena ? <div className="boss-footer" ref={slotRef}>{grid}</div> : null}
      <div className="kit-dock">
        {kitOpen ? (
          <div className="kit-pop" role="dialog" aria-label="Power up">
            <div className="kit-row">
              <button type="button" className={`kit-card${model.phase === "aim-blast" ? " on" : ""}`} disabled={model.boosters.blast <= 0 || model.phase === "busy" || Boolean(model.outcome)} onClick={() => onArm("blast")}>
                <img src="/sprites/cross.png" alt="" />
                <span className="kit-pill"><img src="/sprites/heart.png" alt="" />Blast<b>{model.boosters.blast}</b></span>
              </button>
              <button type="button" className={`kit-card${model.phase === "aim-stripe" ? " on" : ""}`} disabled={model.boosters.stripe <= 0 || model.phase === "busy" || Boolean(model.outcome)} onClick={() => onArm("stripe")}>
                <img src="/sprites/pill.png" alt="" />
                <span className="kit-pill"><img src="/sprites/heart.png" alt="" />Stripe<b>{model.boosters.stripe}</b></span>
              </button>
              <button type="button" className="kit-card" disabled={model.boosters.aid <= 0 || model.phase === "busy" || Boolean(model.outcome)} onClick={onAid}>
                <img src="/sprites/nurse.png" alt="" />
                <span className="kit-pill"><img src="/sprites/bandage.png" alt="" />Aid<b>{model.boosters.aid}</b></span>
              </button>
            </div>
          </div>
        ) : null}
        <button className={`kit-toggle${kitOpen ? " open" : ""}`} type="button" aria-expanded={kitOpen} onClick={() => setKitOpen((open) => !open)}>
          Power up
        </button>
      </div>
      <ParticleLayer boardRef={boardRef} scoreRef={scoreRef} bossRef={bossRef} rows={rows} cols={cols} apiRef={particleRef} />
      {model.outcome ? (
        <Outro model={model} save={save} destroyed={KINDS.filter((kind) => model.collected[kind] > 0)} onAdvance={onAdvance} onRetry={onRetry} onNext={onNext} onBack={onBack} onProfile={onProfile} onHome={onHome} onCollect={onCollect} />
      ) : null}
    </div>
  );
}

function KarenWalk({ slow, facing, paused }: { slow: boolean; facing: number; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const slowRef = useRef(slow);
  const pausedRef = useRef(paused);
  slowRef.current = slow;
  pausedRef.current = paused;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = document.createElement("video");
    video.src = "/sprites/karen-walk.mp4";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => {});
    const scratch = document.createElement("canvas");
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let alive = true;
    let box: { w: number; h: number } | null = null;
    const paint = () => {
      if (!alive) return;
      raf = requestAnimationFrame(paint);
      if (!sctx || !ctx || video.readyState < 2 || !video.videoWidth) return;
      if (reducedMotion() || pausedRef.current) video.pause();
      else if (video.paused) void video.play().catch(() => {});
      video.playbackRate = slowRef.current ? 0.22 : 0.55;
      const w = 240;
      const h = Math.max(1, Math.round(video.videoHeight * (w / video.videoWidth)));
      if (scratch.width !== w || scratch.height !== h) {
        scratch.width = w;
        scratch.height = h;
      }
      sctx.drawImage(video, 0, 0, w, h);
      const img = sctx.getImageData(0, 0, w, h);
      const data = img.data;
      const seen = new Uint8Array(w * h);
      const stack: number[] = [];
      const backdrop = (index: number) => {
        const r = data[index] ?? 0;
        const g = data[index + 1] ?? 0;
        const b = data[index + 2] ?? 0;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max - min < 28 && max > 128 && max < 222;
      };
      for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
      while (stack.length > 0) {
        const p = stack.pop()!;
        if (seen[p]) continue;
        seen[p] = 1;
        const index = p * 4;
        if (!backdrop(index)) continue;
        data[index + 3] = 0;
        const x = p % w;
        const y = (p / w) | 0;
        if (x > 0) stack.push(p - 1);
        if (x + 1 < w) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y + 1 < h) stack.push(p + w);
      }
      sctx.putImageData(img, 0, 0);
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if ((data[(y * w + x) * 4 + 3] ?? 0) > 18) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return;
      // Keep her scale steady mid-stride: the crop follows her center but its size only ever grows.
      const span = Math.max(maxX - minX + 1, box?.w ?? 0);
      const tall = Math.max(maxY - minY + 1, box?.h ?? 0);
      box = { w: span, h: tall };
      const mid = (minX + maxX) / 2;
      minX = Math.max(0, Math.round(mid - span / 2));
      maxX = Math.min(w - 1, minX + span - 1);
      minY = Math.max(0, maxY - tall + 1);
      const cw = maxX - minX + 1;
      const ch = maxY - minY + 1;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(scratch, minX, minY, cw, ch, 0, 0, cw, ch);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      video.pause();
      video.src = "";
    };
  }, []);
  return <canvas ref={canvasRef} className="karen-clip" style={{ transform: `scaleX(${facing})` }} />;
}

const CONFETTI_COLORS = ["#ffe56a", "#ff4ea8", "#fff7fb", "#b8f2c2", "#7a5cff", "#ff335c"];

function Confetti() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(false), 3000);
    return () => window.clearTimeout(id);
  }, []);
  const bits = useMemo(
    () =>
      Array.from({ length: 42 }, (_, id) => ({
        id,
        left: Math.random() * 100,
        delay: -((id % 12) / 12) * (2.8 + (id % 3) * 0.4),
        dur: 2.8 + (id % 3) * 0.4,
        color: CONFETTI_COLORS[id % CONFETTI_COLORS.length]!,
        w: 11 + (id % 4) * 4,
        h: 16 + (id % 3) * 5,
        round: id % 3 === 0,
      })),
    [],
  );
  if (!show) return null;
  return (
    <div className="cheer-confetti" aria-hidden>
      {bits.map((bit) => (
        <i
          key={bit.id}
          style={{
            left: `${bit.left}%`,
            width: bit.w,
            height: bit.h,
            background: bit.color,
            borderRadius: bit.round ? "999px" : "2px",
            animationDuration: `${bit.dur}s`,
            animationDelay: `${bit.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function BadgeFlash({ badges }: { badges: { id: string; label: string }[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (badges.length === 0) return;
    const id = window.setInterval(() => setStep((n) => n + 1), 780);
    return () => window.clearInterval(id);
  }, [badges.length]);
  if (badges.length === 0) return null;
  if (step >= badges.length) {
    return (
      <div className="badges flash-row">
        {badges.map((badge) => (
          <span key={badge.id} className={`badge ${badge.id}`}>{badge.label}</span>
        ))}
      </div>
    );
  }
  const badge = badges[step]!;
  return (
    <div key={`${badge.id}-${step}`} className="badge-pop">
      <span className="cheer-flash" />
      <b className={`badge-flash ${badge.id}`}>{badge.label}</b>
    </div>
  );
}

function Fireworks() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 28 }, (_, id) => ({
        id,
        left: 8 + ((id * 37) % 84),
        top: 12 + ((id * 23) % 70),
        delay: (id % 7) * 0.12,
        color: ["#ffe56a", "#ff4ea8", "#fff7fb", "#7a5cff", "#ff335c", "#7dffb3"][id % 6]!,
        size: 8 + (id % 4) * 4,
      })),
    [],
  );
  return (
    <div className="fireworks" aria-hidden>
      {sparks.map((spark) => (
        <i key={spark.id} style={{ left: `${spark.left}%`, top: `${spark.top}%`, animationDelay: `${spark.delay}s`, background: spark.color, width: spark.size, height: spark.size }} />
      ))}
    </div>
  );
}

function GiftBox() {
  return (
    <span className="present" aria-hidden>
      <span className="present-box" />
      <span className="present-lid" />
      <span className="present-bow" />
    </span>
  );
}

function SecretGiftButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="present-btn claim" type="button" onClick={onOpen} aria-label="Open secret gift">
      <span className="claim-gift"><GiftBox /></span>
      <span className="secret-kicker">Secret gift</span>
    </button>
  );
}

function CardReveal({ levelId, onClose }: { levelId: number; onClose: () => void }) {
  const card = cardForLevel(levelId);
  return (
    <div className="card-reveal" role="dialog" aria-label={`${card.name} unlocked`}>
      <Fireworks />
      {card.model ? <SketchModel card={card} /> : <img src={card.src} alt={card.name} />}
      <button className="btn" type="button" onClick={onClose}>Keep</button>
    </div>
  );
}
function Outro({
  model,
  save,
  destroyed,
  onAdvance,
  onRetry,
  onNext,
  onBack,
  onProfile,
  onHome,
  onCollect,
}: {
  model: Model;
  save: SaveData;
  destroyed: Kind[];
  onAdvance: () => void;
  onRetry: () => void;
  onNext: () => void;
  onBack: () => void;
  onProfile: () => void;
  onHome: () => void;
  onCollect: (levelId: number) => void;
}) {
  const won = model.outcome === "win";
  const pending = won && !model.level.custom && !(save.openedGifts ?? []).includes(model.level.id);
  const [giftPhase, setGiftPhase] = useState<"box" | "open" | "kept">(pending ? "box" : "kept");
  const openGift = () => {
    unlockAudio();
    sfxGift(model.level.id);
    setGiftPhase("open");
    onCollect(model.level.id);
  };
  const present = giftPhase === "box" ? <SecretGiftButton onOpen={openGift} /> : null;
  const reveal = giftPhase === "open" ? <CardReveal levelId={model.level.id} onClose={() => setGiftPhase("kept")} /> : null;
  const dock = present ? <div className="gift-dock">{present}</div> : null;
  if (model.curtain !== "next") {
    return (
      <div className={present ? "outro card-hold has-gift" : "outro card-hold"}>
        {won ? <Confetti /> : null}
        <div className="modal summary" role="dialog" aria-label={won ? "Level summary" : "Out of moves"}>
          {won ? <Cheer career={save.career} /> : <DocAvatar career={save.career} className="cheer" />}
          <Stars n={won ? model.stars : 0} />
          <h2>{won ? model.level.name : "Out of moves"}</h2>
          {model.rankedUp ? <p className="rank-up">Rank up · {rankTitle(save.career.rank)}</p> : null}
          <p className="summary-score">Score <b><CountUp value={model.score} /></b><span>{formatClock(model.elapsed)}</span></p>
          <p className="combo-line">Best combo <b>x<CountUp value={model.maxCombo} /></b></p>
          <div className="wreck">
            <span className="kicker">Destroyed</span>
            <div className="wreck-row">
              {destroyed.map((kind) => (
                <span key={kind} className="wreck-item"><img src={`/sprites/${kind}.png`} alt="" /><CountUp value={model.collected[kind]} /></span>
              ))}
              {destroyed.length === 0 ? <span>None yet</span> : null}
            </div>
          </div>
          {model.payout ? <PayoutCard payout={model.payout} /> : null}
          {model.badges.length > 0 ? <BadgeFlash badges={model.badges} /> : <p className="summary-note">No badges this round.</p>}
          <button className="btn" type="button" onClick={onAdvance}>Next</button>
        </div>
        {dock}
        {reveal}
      </div>
    );
  }
  return (
    <div className={present ? "outro after has-gift" : "outro after"}>
      <DocAvatar career={save.career} className="after-doc" />
      <h2>{won ? model.level.name : "Out of moves"}</h2>
      <Stars n={won ? model.stars : 0} />
      {model.savedNow ? (
        <p className="save-banner">Progress saved.</p>
      ) : null}
      {model.payout ? (
        <p className="coin-banner"><Coins className="coin-icon" aria-hidden />+{model.payout.total} coins · {save.wallet.coins} in your purse</p>
      ) : null}
      {won && model.level.id === 5 ? (
        <p className="save-banner">Loot case unlocked. Open the suitcase in your profile to decorate home base.</p>
      ) : null}
      {present}
      <div className="stack">
        {won && model.level.id === 5 ? (
          <button className="btn" type="button" onClick={onNext}>Choose a ward</button>
        ) : won && model.level.id < 15 ? (
          <button className="btn" type="button" onClick={onNext}>Play next level</button>
        ) : null}
        <button className="btn secondary" type="button" onClick={onRetry}>Replay last game</button>
        <button className="btn secondary" type="button" onClick={onBack}>{model.level.custom ? "Back to editor" : "World map"}</button>
        <button className="btn secondary" type="button" onClick={onProfile}>Profile</button>
        <button className="btn secondary" type="button" onClick={onHome}>Main menu</button>
      </div>
      {dock}
      {reveal}
    </div>
  );
}

function PayoutCard({ payout }: { payout: Payout }) {
  return (
    <div className="payout" aria-label={`${payout.total} coins earned`}>
      <span className="kicker">Coins earned</span>
      <ul>
        {payout.lines.map((line) => (
          <li key={line.label}><span>{line.label}</span><b>+{line.coins}</b></li>
        ))}
      </ul>
      <p className="payout-total"><Coins className="coin-icon" aria-hidden />+<CountUp value={payout.total} /></p>
    </div>
  );
}

function LaunchLog({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="tagline">No launch errors yet.</p>;
  return (
    <ol className="launch-log">
      {notes.slice(0, 8).map((item, index) => (
        <li key={`${item.at}-${index}`}>
          <b>{item.at} {item.title}</b>
          <span>{item.detail}</span>
        </li>
      ))}
    </ol>
  );
}

export class LaunchGuard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    note("Render", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app">
        <div className="column home">
          <div className="scroll">
            <h2>Launch assist</h2>
            <p className="tagline">The ward hit an error. Match rules were not changed. Try again, then check the launch log.</p>
            <pre className="launch-log">{this.state.error.message}</pre>
            <button className="btn" type="button" onClick={() => this.setState({ error: null })}>Back to title</button>
          </div>
        </div>
      </main>
    );
  }
}
