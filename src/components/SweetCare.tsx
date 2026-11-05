import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, Coins, Lock, Pause, Star, Volume2, VolumeX } from "lucide-react";
import { Cheer, CountUp, DocAvatar, portrait, ProfileScreen, SketchModel } from "@/components/Profile";
import { applyRound, ACHIEVEMENTS, rankTitle } from "@/game/profile";
import { applyCare, challengeFor, challengeMet, stageRewards, wardPerks, type Challenge, type EvolveResult } from "@/game/evolution";
import { CareCard, ChallengeChip, EvolutionCutscene, EvolvedAvatar } from "@/components/Evolution";
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
  trackAssist,
  openingAssist,
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
  makeContagion,
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
  playSfx,
  pulseMusic,
  setMusicIntensity,
  setMusicScene,
  type MusicScene,
} from "@/game/audio";
import { createPerks, judgeMove, PERKS, powersIn, type PerkState, type PerkId } from "@/game/perks";
import { hasSeen, markSeen, resetSeen, sceneAfter, sceneBefore, SCENE_IDS, SCENES, type SceneId } from "@/game/cutscenes";
import { Cutscene } from "@/components/Cutscene";
import { LevelComplete, StageBar } from "@/components/LevelEnd";
import { PerkFx, type PerkFlash } from "@/components/PerkFx";
import { PowerCallout, PowerFx, type PowerFlash } from "@/components/PowerFx";
import { firstPowerWard, POWER_UNLOCK_WARD, POWERS, powersUnlocked, shout } from "@/game/powers";
import { GIFT_CARDS, cardForLevel, rememberGift } from "@/game/cards";
import { CERTIFICATES, earnCert, hasGift, missingCert, type CertId } from "@/game/certificates";
import { CertificateCenter } from "@/components/CertificateCenter";
import { haptic, setHapticStrength, setHapticsPref } from "@/game/haptics";
import { bossTierFor, createBoss, hitBoss, MOVE_LABEL, shoveBoss as shoveKaren, stepBoss, windupProgress, type BossEvent, type BossState } from "@/game/boss";
import { makeGerm, stepGerm, woundGerm, type Germ } from "@/game/swarm";
import { applyStamp, auditTargets, createEmergency, damageScale, drainFlood, EMERGENCY_TIP, floodCells, floodLevel, shock, SPILL_AT, SPILL_BITE, stepEmergency, type EmergencyEvent, type EmergencyState } from "@/game/emergency";
import { generateWard } from "@/game/generator";
import { CONTAGION_POINTS, FEVER_POINTS, afterMove, cleanContagion, countFevers, countLayer, treatFevers } from "@/game/mechanics";
import { evolveWardAhead, formOffset, isRolledWard, lockedWard, pushForm, wardForAttempt } from "@/game/wardEvolution";
import { attemptFor, continueLevel, loadSave, recordWin, releaseAttempt, rememberOpened, resetProgress, totalStars, writeSave, defaultSave, type SaveData } from "@/game/save";
import { dayKey, shiftForDate } from "@/game/shifts";
import { applyMotionPref, motionReduced, type Prefs } from "@/game/prefs";
import { grant, lossPayout, payWin, spendFromBag, winPayout, type BoosterId, type Payout } from "@/game/rewards";
import { OptionsScreen, RewardsScreen } from "@/components/Options";
import { HomeScreen } from "@/components/HomeScreen";
import { LevelSheet } from "@/components/LevelSheet";
import { MapTrail } from "@/components/MapTrail";
import { levelKind } from "@/game/levelInfo";
import { installErrorLog, note, readNotes, subscribeNotes, type Note } from "@/game/log";
import { applyLayout } from "@/game/layout";
import { LiquidBoard, type LiquidHandle } from "@/components/LiquidBoard";
import { LevelCreator } from "@/components/LevelCreator";
import { ParticleLayer, type ParticleHandle } from "@/components/ParticleLayer";
import { Overworld } from "@/components/Overworld";
import { readRoam, writeRoam } from "@/game/overworld";

interface VTile {
  id: number;
  kind: Kind;
  special: Special;
  r: number;
  c: number;
  dying: boolean;
  born: boolean;
  wrap: number;
  fuse: number;
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
  assist: number;
  form: number;
  startedAt: number;
  maxCombo: number;
  elapsed: number;
  badges: { id: string; label: string }[];
  rankedUp: boolean;
  /** done: the "Level complete!" beat on the board, card: the result card, next: the follow-up menu. */
  curtain: "cheer" | "done" | "card" | "next";
  /** Points the leftover moves paid at the end of a win, for the level complete beat. */
  endBonus?: number;
  /** Why a round was lost early (a fever, a flood), for the level end beat. */
  endReason?: string;
  savedNow: boolean;
  shake: boolean;
  animate: boolean;
  view: VTile[];
  boss: BossState | null;
  /** Tiles taped down by Karen's paperwork, by tile id, with seconds left. */
  locks: Map<number, number>;
  /** Tiles she is about to tape. Shown as a warning during the windup. */
  marked: number[];
  /** The ward emergency this boss fight runs during. */
  emergency: EmergencyState | null;
  /** Power pieces the auditor's stamp is aimed at. */
  audited: number[];
  /** The pause sheet is open. Input, boss pressure and the clock all stop. */
  paused: boolean;
  pausedAt: number;
  /** Seconds left of the red hit flash on the stage. */
  sting: number;
  /** The latest hit on the player, keyed so the red flash and the damage number replay on every hit. */
  hit: { id: number; label: string } | null;
  playerHp: number;
  germs: Germ[];
  germLeft: number;
  germKills: number;
  heal: number;
  /** Infected cells. Spreads after a move that cleans none. See mechanics.ts. */
  contagion: boolean[][];
  contagionTotal: number;
  cleanedThisMove: number;
  movesMade: number;
  feversTreated: number;
  /** Optional bonus goal for this ward (src/game/evolution.ts). */
  challenge: Challenge | null;
  /** Boosters spent this ward, for the "no boosters" challenge. */
  boostersUsed: number;
  /** Moves the Second wind ability still has to give this ward. */
  secondWind: number;
  /** Care points and evolution result of the finished round. */
  care: (EvolveResult & { before: number; challengeDone: boolean }) | null;
  /** The evolution cutscene is waiting to play over the result card. */
  evolving: boolean;
  /** Combo perk cooldowns and the Bedside streak. See perks.ts. */
  perks: PerkState;
  /** The perk effect on screen, if one just fired. */
  perkFx: PerkFlash | null;
  /** The power up that just landed: drives the shout above the board and its board effect. */
  powerFx: PowerFlash | null;
}

/** Background music for a screen, and for a ward by its type. */
function musicFor(screen: Screen, level: LevelDef | null | undefined): MusicScene {
  if (screen === "play" && level) {
    if (level.bossHp) return "boss";
    if (level.encounter === "microbe") return "microbe";
    if (level.encounter === "heal") return "heal";
    return "ward";
  }
  if (screen === "map" || screen === "journey") return "map";
  return "title";
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

/** One line that explains a ward's new mechanics as the board opens. */
function mechanicTip(level: LevelDef, board: Board): string | null {
  if (level.bossHp || level.encounter) return null;
  const infected = level.grid?.some((row) => row.includes("x"));
  const fever = Boolean(level.fever) || board.some((row) => row.some((tile) => tile?.fuse));
  if (infected && fever) return "Clean the contagion and treat fevers before they hit 0";
  if (infected) return "Contagion spreads unless you clean some each move";
  if (fever) return level.fever ? `Fevers break out every ${level.fever.every} moves. Clear them before they hit 0` : "Clear fever tiles before their count hits 0";
  return null;
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
        fuse: tile.fuse ?? 0,
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

/** Triage eye ability: one striped power on a plain tile, away from the edges when it can. */
function plantStripe(board: Board, rng: Rng) {
  const spots: NonNullable<Board[number][number]>[] = [];
  for (let r = 1; r < board.length - 1; r++) {
    for (let c = 1; c < (board[r]?.length ?? 0) - 1; c++) {
      const tile = board[r]![c];
      if (tile && !tile.special && !tile.wrap) spots.push(tile);
    }
  }
  if (spots.length === 0) return;
  const pick = spots[Math.floor(rng() * spots.length)]!;
  pick.special = rng() < 0.5 ? "row" : "col";
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
  const [mapView, setMapView] = useState<"roam" | "classic">(() => readRoam()?.view ?? "roam");
  function pickMapView(view: "roam" | "classic") {
    setMapView(view);
    writeRoam({ view });
  }
  const [caseFirst, setCaseFirst] = useState(false);
  const [save, setSave] = useState<SaveData>(defaultSave);
  const [tick, setTick] = useState(0);
  const [side, setSide] = useState(300);
  const [cell, setCell] = useState(36);
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [journeyId, setJourneyId] = useState(1);
  const [certPrompt, setCertPrompt] = useState<CertId | null>(null);
  const [creatorUid, setCreatorUid] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [cutscene, setCutscene] = useState<{ id: SceneId; then: () => void } | null>(null);
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

  // Browsers only start audio after a gesture. The first tap anywhere wakes it, so the title theme can play.
  useEffect(() => {
    const wake = () => unlockAudio();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  const playingLevel = screen === "play" ? modelRef.current?.level : null;
  useEffect(() => {
    setMusicScene(cutscene ? SCENES[cutscene.id].music : musicFor(screen, playingLevel));
    if (!cutscene) setMusicIntensity(playingLevel?.bossHp ? 0.3 : 0);
  }, [screen, playingLevel, cutscene]);

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
        const room = arenaRoom(slot);
        const next = Math.max(160, Math.floor(Math.min(room.width || width, room.height * (playing.level.cols / playing.level.rows))));
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
    const column = slot.closest(".column");
    if (column) observer.observe(column);
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
          evolution: next.evolution,
          certs: next.certs ?? disk.certs,
          cardsSpent: next.cardsSpent ?? disk.cardsSpent,
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

  /** Holds the board on the level complete beat, then raises the result card. */
  function holdCurtain(model: Model, ms: number) {
    model.curtain = "done";
    curtainTimers.current.push(window.setTimeout(() => raiseCard(model), motionReduced() ? Math.min(ms, 900) : ms));
  }

  function raiseCard(model: Model) {
    if (modelRef.current !== model || model.curtain !== "done") return;
    model.curtain = "card";
    bump();
  }

  function advanceCurtain() {
    const current = modelRef.current;
    if (!current?.outcome || current.curtain === "next") return;
    if (current.curtain === "done") {
      raiseCard(current);
      return;
    }
    current.curtain = "next";
    stopCelebration();
    bump();
    if (current.outcome === "win" && !current.level.custom) withScene(sceneAfter(current.level.id), () => {});
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
    resetSeen();
    patchSave((prev) => resetProgress(prev), "checkpoint");
    setScreen("home");
  }

  /** Spend one booster. The free one goes first, then the bag pays. */
  function drawBooster(model: Model, which: BoosterId) {
    model.boosters[which] -= 1;
    model.boostersUsed += 1;
    if (model.boosters[which] < model.bagStart[which]) {
      patchSave((prev) => ({ ...prev, wallet: spendFromBag(prev.wallet, which) }), "settings");
    }
  }

  /** Hand in cards at the Certificate Center. Saved straight away. */
  function earnCertificate(id: CertId) {
    patchSave((prev) => earnCert(prev, id), "checkpoint");
  }

  function collectGift(levelId: number) {
    if (!hasGift(levelId)) return;
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
      certs: CERTIFICATES.map((cert) => cert.id),
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

  /** Plays a story scene once, then carries on. Seen scenes are skipped. */
  function withScene(id: SceneId | null, then: () => void) {
    if (!id || hasSeen(id)) {
      then();
      return;
    }
    setCutscene({ id, then });
  }

  function endScene() {
    const current = cutscene;
    if (!current) return;
    markSeen(current.id);
    setCutscene(null);
    current.then();
  }

  function startLevel(id: number, custom?: LevelDef) {
    if ((custom ?? getLevel(id)).bossHp) {
      const sheet = new Image();
      sheet.src = KAREN_SHEET;
    }
    const story = custom ? null : sceneBefore(id);
    if (story && !hasSeen(story)) {
      withScene(story, () => startLevel(id, custom));
      return;
    }
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
    // Rolled wards may have been evolved ahead of time on the map. The attempt locks whichever is ready.
    const level = custom || scripted.bossHp || scripted.encounter || id >= 16
      ? scripted
      : wardForAttempt(id, attempt.seed, attempt.shiftId);
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
    // Evolution abilities. Custom levels play exactly as built, so the creator stays honest.
    const perks = custom ? wardPerks({ ...saveRef.current.evolution, stage: 0 }) : wardPerks(saveRef.current.evolution);
    if (perks.startStripe) plantStripe(board, rng);
    const encounterWard = Boolean(level.bossHp || level.encounter);
    const challenge = custom ? null : challengeFor({ levelId: level.id, clears: saveRef.current.clears[String(level.id)] ?? 0, encounter: encounterWard, moves: level.moves });
    const model: Model = {
      level,
      board,
      mask,
      wrapsTotal: countWraps(board),
      jelly,
      jellyTotal: countJelly(jelly),
      rng,
      score: 0,
      moves: level.moves + perks.extraMoves,
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
      assist: openingAssist(level.id),
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
      emergency: level.bossHp && level.emergency ? createEmergency(level.emergency) : null,
      audited: [],
      paused: false,
      pausedAt: 0,
      sting: 0,
      hit: null,
      playerHp: 100,
      germs: [],
      germLeft: level.swarm?.count ?? 0,
      germKills: 0,
      heal: 0,
      contagion: makeContagion(level),
      contagionTotal: 0,
      cleanedThisMove: 0,
      movesMade: 0,
      feversTreated: 0,
      perks: createPerks(),
      perkFx: null,
      powerFx: null,
      challenge,
      boostersUsed: 0,
      secondWind: perks.secondWind,
      care: null,
      evolving: false,
    };
    model.contagionTotal = countLayer(model.contagion);
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
    const tip = mechanicTip(level, board);
    if (tip) window.setTimeout(() => {
      const current = modelRef.current;
      if (current && runRef.current === run && !current.outcome) {
        say(current, tip, 2600);
        bump();
      }
    }, 1500);
    if (!level.custom && level.id > POWER_UNLOCK_WARD && powersUnlocked(saveRef.current.unlocked, level)) {
      window.setTimeout(() => {
        const current = modelRef.current;
        if (!current || runRef.current !== run || current.outcome || !firstPowerWard()) return;
        say(current, "Power ups unlocked! Tap Power up", 2800);
        playSfx("reward.unlock");
        bump();
      }, tip ? 4300 : 1500);
    }
    } catch (error) {
      note("Start", error);
      setScreen("home");
      setLogOpen(true);
    }
  }

  function openLevel(id: number) {
    // Behind a certificate fence: go to the island and open the Certificate Center instead.
    const fenced = missingCert(saveRef.current, id);
    if (fenced) {
      setCertPrompt(fenced.id);
      setScreen("map");
      return;
    }
    if (journeyFor(id)) {
      setJourneyId(id);
      setScreen("journey");
      return;
    }
    startLevel(id);
  }

  function pausePlay() {
    const model = modelRef.current;
    if (!model || model.paused || model.outcome || model.countdown) return;
    model.paused = true;
    model.pausedAt = Date.now();
    clearHint();
    sfxClick();
    bump();
  }

  function resumePlay() {
    const model = modelRef.current;
    if (!model || !model.paused) return;
    model.paused = false;
    // Time spent on the pause sheet doesn't count toward the ward clock.
    model.startedAt += Date.now() - model.pausedAt;
    sfxClick();
    scheduleHint();
    bump();
  }

  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "p") return;
      if (modelRef.current?.paused) resumePlay();
      else pausePlay();
    };
    // A boss keeps walking in real time, so leaving the tab pauses the ward.
    const onHide = () => {
      if (document.visibilityState === "hidden") pausePlay();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
  });

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
    holdCurtain(model, 1700);
    model.phase = "idle";
    model.banner = banner;
    model.endReason = banner;
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
      setMusicIntensity(0.3 + event.phase * 0.35);
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
      hurtPlayer(model, event.bite);
      model.marked = [];
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
      model.hit = { id: (model.hit?.id ?? 0) + 1, label: taken > 0 ? `-${taken} move${taken > 1 ? "s" : ""}` : "Write-up" };
      say(model, taken > 0 ? `Write-up! -${taken} move${taken > 1 ? "s" : ""}` : "Write-up!");
    } else if (event.move === "charge") {
      model.sting = 0.35;
      model.hit = { id: (model.hit?.id ?? 0) + 1, label: "Charge!" };
      say(model, "She charged!");
    }
  }

  /** Plays one clear step. Returns the points it scored. */
  async function playPlan(run: number, plan: ClearPlan): Promise<number> {
    const model = modelRef.current;
    if (!model || runRef.current !== run || model.outcome) return 0;
    const jellyBroken = breakJelly(model.jelly, plan.removals);
    const cleaned = cleanContagion(model.contagion, plan.removals);
    const treated = treatFevers(model.board, plan);
    model.cleanedThisMove += cleaned;
    model.feversTreated += treated;
    if (treated > 0) haptic("power");
    const gained = plan.score + jellyBroken * 40 + cleaned * CONTAGION_POINTS + treated * FEVER_POINTS;
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
    if (bits.length > 0) particleRef.current?.burst(bits, plan.combo);
    particleRef.current?.pop(bits, plan.combo);
    if (detonated.length > 0) particleRef.current?.detonate(detonated);
    const bigHit = plan.combo >= 3 || detonated.length > 0 || plan.removals.length >= 5;
    // The Overflow: every mopped jelly cell is a hit on Karen.
    if (model.boss && model.emergency?.kind === "overflow" && jellyBroken > 0) woundBoss(model, jellyBroken * 2);
    if (model.boss && plan.removals.length >= 3) {
      const hits = plan.removals.flatMap((cell) => {
        const kind = model.board[cell.r]?.[cell.c]?.kind;
        return kind ? [{ r: cell.r, c: cell.c, kind }] : [];
      });
      sfxBossHit();
      const scaleOf = (kind: Kind) => 4 * damageScale(model.emergency, kind);
      const hearts = hits.filter((hit) => hit.kind === "heart").length;
      if (shock(model.emergency, hearts)) {
        say(model, "Clear! Shocked back");
        particleRef.current?.bossBurst("interrupt");
        sfxInterrupt();
        haptic("power");
        woundBoss(model, 10, true);
      }
      if (hits.length === 0 || reducedMotion() || !particleRef.current) {
        woundBoss(model, hits.reduce((sum, hit) => sum + scaleOf(hit.kind), 0), bigHit);
        shoveBoss(model, true);
      } else {
        sfxOrbFly();
        let landed = 0;
        particleRef.current.bossFly(hits, scaleOf, (damage) => {
          const current = modelRef.current;
          if (!current || current.outcome) return;
          landed += 1;
          // The first orb of a big volley is the one that can break a windup.
          woundBoss(current, damage, bigHit && landed === 1);
          shoveBoss(current, landed % 3 === 0);
          sfxOrbPop();
          playSfx("hit.punch", { index: landed, gain: bigHit && landed === 1 ? 1.4 : 1 });
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
        let punches = 0;
        particleRef.current.bossFly(hits, 4, (damage) => {
          const current = modelRef.current;
          if (!current || current.outcome) return;
          hurtGerm(current, damage);
          sfxOrbPop();
          playSfx("hit.punch", { index: (punches += 1), gain: 0.85 });
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
    if (runRef.current !== run || !modelRef.current) return gained;
    const pre = new Map<number, number>();
    for (let r = 0; r < model.board.length; r++) {
      for (let c = 0; c < model.board[0]!.length; c++) {
        const tile = model.board[r]![c];
        if (tile) pre.set(tile.id, r);
      }
    }
    eraseIds(model.board, painted.dyingIds);
    const fell = collapse(model.board, model.rng, model.level.kinds, diveFavor(model.level.id, model.assist), model.mask);
    if (model.assist > 0) model.assist -= 1;
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
    if (runRef.current !== run || !modelRef.current) return gained;
    model.animate = true;
    model.view = readView(model.board, new Set(), born);
    bump();
    await wait(reducedMotion() ? 40 : 320);
    return gained;
  }

  /** Evolves a rolled ward in the background so it is ready when the player gets there. */
  function evolveNext(id: number) {
    const current = saveRef.current;
    if (id < 3 || id > 15 || getLevel(id).bossHp) return;
    const attempt = attemptFor(current, id);
    void evolveWardAhead(id, attempt.seed, attempt.shiftId, formOffset(current.form));
  }

  function closeRound(model: Model, won: boolean, elapsed: number) {
    if (model.level.custom) {
      model.rankedUp = false;
      model.savedNow = false;
      return;
    }
    const prev = saveRef.current;
    const key = String(model.level.id);
    const formEntry = isRolledWard(model.level) ? { id: model.level.id, won, spare: won ? Math.max(0, model.moves) / Math.max(1, model.level.moves) : 0 } : null;
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
    const challengeDone = model.challenge
      ? challengeMet(model.challenge, {
          won,
          maxCombo: model.maxCombo,
          movesLeft: Math.max(0, model.moves),
          stars: won ? model.stars : 0,
          seconds: elapsed / 1000,
          boostersUsed: model.boostersUsed,
          destroyed,
        })
      : false;
    const care = applyCare(prev.evolution, {
      won,
      stars: won ? model.stars : 0,
      prevStars: prev.stars[key] ?? 0,
      maxCombo: model.maxCombo,
      movesLeft: Math.max(0, model.moves),
      boss: Boolean(model.level.bossHp || model.level.encounter === "microbe"),
      destroyed,
      challenge: model.challenge,
      challengeDone,
    });
    model.care = { ...care, before: prev.evolution.xp, challengeDone };
    model.evolving = care.reached.length > 0;
    const promotion = stageRewards(care.reached);
    patchSave((current) => {
      const base = won ? releaseAttempt(recordWin(current, model.level.id, model.stars, model.score, elapsed), model.level.id) : current;
      const paid = won ? payWin(current.wallet, payout, today) : { ...current.wallet, coins: current.wallet.coins + payout.total, earned: current.wallet.earned + payout.total };
      const wallet = care.reached.length ? grant(paid, promotion) : paid;
      return { ...base, career: applied.career, wallet, evolution: care.evolution, form: formEntry ? pushForm(current.form, formEntry) : current.form };
    }, won ? "checkpoint" : "session");
    // Start shaping the next ward while the result card is up.
    window.setTimeout(() => evolveNext(won ? model.level.id + 1 : model.level.id), 600);
    if (!won) patchSave((current) => current, "settings");
  }

  onBossTick.current = (dt, paint) => {
    const model = modelRef.current;
    if (!model || model.outcome || model.countdown || model.paused) return;
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
        hurtPlayer(model, bite, 0.4);
        model.germs = model.germs.filter((item) => item.id !== germ.id);
        say(model, "A microbe reached the ward");
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
    if (model.emergency) {
      for (const event of stepEmergency(model.emergency, dt, boss.phase)) {
        applyEmergencyEvent(model, event);
        if (model.outcome) return;
      }
    }
    if (paint) bump();
  };

  function applyEmergencyEvent(model: Model, event: EmergencyEvent) {
    if (event.type === "flatline") {
      hurtPlayer(model, event.bite);
      say(model, "Flatline! Get those hearts in");
      sfxBad();
      haptic("hurt");
      if (model.playerHp <= 0) loseRound(model, "The patient flatlined");
      return;
    }
    if (event.type === "audit-warn") {
      model.audited = auditTargets(model.board, model.rng);
      if (model.audited.length) {
        say(model, "Audit incoming! Use your powers");
        sfxBossWarn();
      }
      return;
    }
    const hit = applyStamp(model.board, model.audited);
    model.audited = [];
    if (!hit.length) return;
    say(model, hit.length > 1 ? "Stamped flat!" : "Stamped!");
    sfxBossStrike();
    haptic("hurt");
    particleRef.current?.paper(hit);
    if (model.phase === "idle") model.view = readView(model.board, new Set(), new Set());
  }

  /** The Overflow: after each move the flood rises, and spills over you at half the board. */
  function riseFlood(model: Model) {
    if (model.emergency?.kind !== "overflow" || !model.boss || model.boss.hp <= 0 || model.outcome) return;
    for (const cell of floodCells(model.jelly, model.mask, 2 + model.boss.phase, model.rng)) model.jelly[cell.r]![cell.c] = true;
    if (floodLevel(model.jelly, model.mask) >= SPILL_AT) {
      drainFlood(model.jelly, model.rng);
      hurtPlayer(model, SPILL_BITE);
      say(model, "It spilled over!");
      sfxBad();
      haptic("hurt");
      if (model.playerHp <= 0) loseRound(model, "The ward flooded");
    }
    bump();
  }

  /** Contagion and fevers get their turn once a move has fully resolved. Same order as the bot. */
  function wardTurn(model: Model) {
    if (model.outcome || model.level.bossHp || model.level.encounter) return;
    model.movesMade += 1;
    const turn = afterMove(model, model.mask, model.rng, model.level.fever);
    if (turn.burst.length) {
      particleRef.current?.spill(turn.burst, "red");
      loseRound(model, "A fever spiked!");
      return;
    }
    if (turn.spread) {
      model.contagionTotal = Math.max(model.contagionTotal, countLayer(model.contagion));
      say(model, "The contagion spread", 900);
    }
    if (turn.outbreak) {
      say(model, "New fever!", 900);
      sfxBossWarn();
    }
    if (turn.spread || turn.outbreak || countFevers(model.board) > 0) {
      model.view = readView(model.board, new Set(), new Set());
      bump();
    }
  }

  async function finish(run: number) {
    const model = modelRef.current;
    if (!model || runRef.current !== run || model.outcome) return;
    const progress = { score: model.score, collected: model.collected, jellyLeft: countJelly(model.jelly), wrapsLeft: countWraps(model.board), contagionLeft: countLayer(model.contagion), feversTreated: model.feversTreated };
    const healed = model.level.encounter === "heal" && model.heal >= (model.level.healNeed ?? 1);
    // A leak costs life, not the ward: the wave is cleared once every germ has been dealt with.
    const cleared = model.level.encounter === "microbe" && model.germLeft <= 0 && model.germs.length === 0;
    const wonGoal = model.boss ? model.boss.hp <= 0 : healed || cleared ? true : model.level.encounter ? false : goalsMet(model.level, progress);
    if (wonGoal) {
      const bonus = model.moves * 100;
      model.endBonus = bonus;
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
      holdCurtain(model, 2800);
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
    if (model.moves <= 0 && model.secondWind > 0) {
      // Healer ability: one rescue per ward.
      model.moves += model.secondWind;
      model.secondWind = 0;
      say(model, `Second wind! +${model.moves} moves`, 1600);
      particleRef.current?.stars();
      haptic("special");
      try {
        sfxSpecial();
      } catch (error) {
        note("Audio", error);
      }
    }
    if (model.moves <= 0) {
      model.elapsed = Math.max(0, Date.now() - model.startedAt);
      model.badges = model.maxCombo >= 5 ? [{ id: "streak", label: "5 streak" }] : [];
      model.outcome = "lose";
      holdCurtain(model, 1700);
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

  /**
   * Plays a move's clears and cascades, and returns how many clear steps it took.
   * With `judge`, the finished move is judged for combo perks (swaps only, not boosters).
   */
  async function runClears(run: number, first: ClearPlan | null, comboStart: number, judge = false): Promise<number> {
    let combo = comboStart;
    let plan = first;
    let celebrated = false;
    let yelled = false;
    let step = 0;
    let powers = 0;
    let gained = 0;
    let judged = !judge;
    let moveSteps = 0;
    for (;;) {
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
        if (depth >= 2) pulseMusic(Math.min(1, depth / 6));
        const current = modelRef.current;
        if (current) {
          current.maxCombo = Math.max(current.maxCombo, Math.max(step, plan.combo));
          powers += powersIn(current.board, plan);
        }
        gained += await playPlan(run, plan);
        if (runRef.current !== run || !modelRef.current) return step;
        combo += 1;
        plan = planFromMatches(modelRef.current.board, combo);
      }
      if (judged || runRef.current !== run) break;
      judged = true;
      moveSteps = step;
      const model = modelRef.current;
      if (!model || model.outcome) break;
      plan = firePerks(model, { steps: step, powers, score: gained });
      if (!plan) break;
      await wait(reducedMotion() ? 40 : 520);
      if (runRef.current !== run || !modelRef.current) return step;
    }
    if (modelRef.current && runRef.current === run) {
      modelRef.current.dive = 0;
      bump();
    }
    await finish(run);
    return judge ? moveSteps : step;
  }

  /** Judges a finished move for combo perks, shows the effect, and returns a follow-up clear if one fired. */
  function firePerks(model: Model, stats: { steps: number; powers: number; score: number }): ClearPlan | null {
    const result = judgeMove(model.perks, stats, model.board, model.rng, model.mask);
    if (result.bonus > 0) {
      model.score += result.bonus;
      const floatId = ++seq.current;
      model.floats = [...model.floats.slice(-4), { id: floatId, text: `+${result.bonus}`, r: model.level.rows / 2 - 0.5, c: model.level.cols / 2 - 0.5 }];
      window.setTimeout(() => {
        const current = modelRef.current;
        if (!current) return;
        current.floats = current.floats.filter((item) => item.id !== floatId);
        bump();
      }, 900);
      if (!result.perk) playSfx("perk.bonus");
    }
    model.moves += result.extraMoves;
    const shown: PerkId | null = result.perk ?? (result.armedBedside ? "bedside" : null);
    if (shown) {
      const key = ++seq.current;
      model.perkFx = { id: shown, key, zap: result.zap, planted: result.planted };
      playSfx(`perk.${shown}`);
      if (result.armedBedside && result.perk) playSfx("perk.bedside", { delay: 0.5, gain: 0.8 });
      if (shown === "defib" || shown === "miracle") haptic("power");
      else haptic("special");
      if (shown === "miracle") particleRef.current?.stars();
      if (result.planted.length > 0) {
        const ids = result.planted.flatMap((pos) => {
          const tile = model.board[pos.r]?.[pos.c];
          return tile ? [tile.id] : [];
        });
        model.view = readView(model.board, new Set(), new Set(ids));
        liquidRef.current?.splash(result.planted, 1.2);
      }
      window.setTimeout(() => {
        const current = modelRef.current;
        if (current?.perkFx?.key === key) current.perkFx = null;
        bump();
      }, 1900);
    }
    bump();
    return result.plan;
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
    bump();
    const steps = await runClears(run, planAfterSwap(model.board, a, b, 1), 1, true);
    if (runRef.current === run && modelRef.current) {
      trackAssist(modelRef.current, modelRef.current.level.id, steps >= 2);
      riseFlood(modelRef.current);
      wardTurn(modelRef.current);
    }
  }

  function handleTap(pos: Pos) {
    const model = modelRef.current;
    if (!model || model.outcome || model.paused) return;
    unlockAudio();
    if (model.phase === "aim-blast") {
      if (model.boosters.blast <= 0) return;
      const plan = planCross(model.board, pos);
      if (!plan) return;
      drawBooster(model, "blast");
      model.phase = "busy";
      model.selected = null;
      clearHint();
      firePower(model, "blast", pos);
      particleRef.current?.detonate([{ ...pos, special: "row" }, { ...pos, special: "col" }]);
      const run = runRef.current;
      // A beat for the beams and the shout to land before the cross clears.
      void wait(reducedMotion() ? 0 : 260).then(() => {
        if (runRef.current === run && modelRef.current === model) void runClears(run, plan, 1);
      });
      return;
    }
    if (model.phase === "aim-stripe") {
      const tile = model.board[pos.r]?.[pos.c];
      if (!tile || model.boosters.stripe <= 0) return;
      drawBooster(model, "stripe");
      upgradeSpecial(tile, pos.c);
      model.phase = "idle";
      model.selected = null;
      model.view = readView(model.board, new Set(), new Set([tile.id]));
      firePower(model, "stripe", pos);
      particleRef.current?.pop([{ ...pos, kind: tile.kind }], 4);
      scheduleHint();
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

  /** The shout above the board, the sound and the board effect for a power up that just landed. */
  function firePower(model: Model, id: BoosterId, at: Pos | null) {
    const key = ++seq.current;
    model.powerFx = { id, key, at };
    model.shake = id === "blast" && saveRef.current.prefs.shake;
    playSfx(`power.${id === "stripe" ? "pill" : id}`);
    shout(POWERS[id].callout);
    haptic(id === "blast" ? "power" : "special");
    window.setTimeout(() => {
      const current = modelRef.current;
      if (current?.powerFx?.key === key) current.powerFx = null;
      bump();
    }, reducedMotion() ? 900 : 1600);
  }

  function useAid() {
    const model = modelRef.current;
    if (!model || model.phase === "busy" || model.outcome || model.boosters.aid <= 0) return;
    if (!powersUnlocked(saveRef.current.unlocked, model.level)) return;
    unlockAudio();
    drawBooster(model, "aid");
    model.moves += 5;
    model.phase = "idle";
    firePower(model, "aid", null);
    const mid = { r: Math.floor((model.level.rows - 1) / 2), c: Math.floor((model.level.cols - 1) / 2) };
    summonImps(
      model,
      [
        mid,
        { r: mid.r, c: Math.max(0, mid.c - 1) },
        { r: mid.r, c: Math.min(model.level.cols - 1, mid.c + 1) },
      ],
      9,
      true,
    );
    bump();
  }

  function arm(which: "blast" | "stripe") {
    const model = modelRef.current;
    if (!model || model.phase === "busy" || model.outcome) return;
    if (model.boosters[which] <= 0) return;
    if (!powersUnlocked(saveRef.current.unlocked, model.level)) return;
    unlockAudio();
    playSfx("power.arm");
    haptic("tap");
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
        <HomeScreen
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
          noteCount={notes.length}
          logOpen={logOpen}
          onToggleLog={() => setLogOpen((open) => !open)}
          log={<LaunchLog notes={notes} />}
        />
      ) : null}
      {screen === "cast" ? (
        <Cast
          save={save}
          onBack={() => setScreen("home")}
          onStart={(look, name) => {
            patchSave((prev) => ({ ...prev, career: { ...prev.career, look, name } }), "settings");
            // First time through: the opening story, which ends on the island map. After that, straight to Ward 1.
            if (hasSeen("prologue")) openLevel(1);
            else withScene("prologue", () => setScreen("map"));
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
      {screen === "map" && mapView === "roam" ? (
        <Overworld
          save={save}
          onBack={() => setScreen("home")}
          onPick={(id) => openLevel(id)}
          onCollect={collectGift}
          onClassic={() => pickMapView("classic")}
          renderReveal={(id, close) => <CardReveal levelId={id} onClose={close} />}
          onStep={(index) => playSfx("map.step", { index })}
          onEarnCert={earnCertificate}
          certPrompt={certPrompt}
          onPromptSeen={() => setCertPrompt(null)}
        />
      ) : null}
      {screen === "map" && mapView === "classic" ? <MapScreen save={save} onBack={() => setScreen("home")} onPick={(id) => openLevel(id)} onCollect={collectGift} onRoam={() => pickMapView("roam")} onEarnCert={earnCertificate} certPrompt={certPrompt} onPromptSeen={() => setCertPrompt(null)} /> : null}
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
          onScene={(id) => { sfxClick(); setCutscene({ id, then: () => {} }); }}
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
          onScene={(id) => setCutscene({ id, then: () => {} })}
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
          onPause={pausePlay}
          onResume={resumePlay}
          onSound={toggleSound}
          onMusic={toggleMusic}
          onHaptics={toggleHaptics}
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
            // Aiming a power up also starts on a press: the release taps the candy.
            if (!current || (current.phase !== "idle" && current.phase !== "aim-blast" && current.phase !== "aim-stripe") || current.outcome || current.paused) return;
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
      {cutscene ? <Cutscene id={cutscene.id} name={save.career.name} portraitSrc={portrait(save.career)} onDone={endScene} /> : null}
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

function EmergencyMeter({ state, flood }: { state: EmergencyState; flood: number }) {
  const label = state.kind === "code-blue" ? `Code Blue · ♥ ×${state.clock > 0 ? 2 : 1}` : state.kind === "overflow" ? "The Overflow" : "Audit";
  const value = state.kind === "overflow" ? `${Math.round(flood * 100)}%` : `${Math.max(0, Math.ceil(state.clock))}s`;
  const fill = state.kind === "overflow" ? Math.min(1, flood / SPILL_AT) : Math.max(0, state.clock / state.span);
  const hot = state.kind === "overflow" ? fill > 0.75 : state.kind === "audit" ? state.warned : fill < 0.3;
  return (
    <div className={`emergency-meter ${state.kind}${hot ? " hot" : ""}`}>
      <div className="meter-label"><span>{label}</span><span>{value}</span></div>
      <div className="boss-bar" role="meter" aria-label={label} aria-valuenow={Math.round(fill * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.round(fill * 100)}%` }} />
      </div>
      <p className="emergency-tip">{EMERGENCY_TIP[state.kind]}</p>
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

function DevMenu({
  onBack,
  onLevel,
  onUnlock,
  onProfile,
  onCase,
  onScene,
  notes,
}: {
  onBack: () => void;
  onLevel: (id: number) => void;
  onScene: (id: SceneId) => void;
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
        <h3>Story scenes</h3>
        <div className="stack">
          {SCENE_IDS.map((id) => (
            <button key={id} className="btn secondary" type="button" onClick={() => onScene(id)}>{SCENES[id].title}</button>
          ))}
        </div>
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

function MapScreen({ save, onBack, onPick, onCollect, onRoam, onEarnCert, certPrompt, onPromptSeen }: { save: SaveData; onBack: () => void; onPick: (id: number) => void; onCollect: (levelId: number) => void; onRoam?: () => void; onEarnCert: (id: CertId) => void; certPrompt?: CertId | null; onPromptSeen?: () => void }) {
  const [center, setCenter] = useState<{ highlight: CertId | null } | null>(() => (certPrompt ? { highlight: certPrompt } : null));
  useEffect(() => {
    if (certPrompt) onPromptSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nextId = continueLevel(save);
  const preview = attemptFor(save, nextId);
  const rolled = nextId >= 3 && nextId <= 15 && !getLevel(nextId).bossHp;
  const [evolvedNext, setEvolvedNext] = useState<LevelDef | null>(() => (rolled ? lockedWard(nextId, preview.seed, preview.shiftId) : null));
  const next = evolvedNext ?? (save.seeds[String(nextId)] ? generateWard(nextId, preview.seed, preview.shiftId) : getLevel(nextId));
  useEffect(() => {
    if (!rolled) return;
    let live = true;
    // Evolve the next ward while the player looks at the map. A started attempt keeps what it got.
    void evolveWardAhead(nextId, preview.seed, preview.shiftId, formOffset(save.form)).then((level) => {
      if (live && level) setEvolvedNext(level);
    });
    return () => {
      live = false;
    };
  }, [nextId, preview.seed, preview.shiftId, rolled, save.form]);
  const spot = MAP_SPOTS.find((item) => item.id === nextId) ?? MAP_SPOTS[0]!;
  const [zoomed, setZoomed] = useState(true);
  const [opening, setOpening] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const opened = save.openedGifts ?? [];
  const pendingGifts = MAP_SPOTS.filter((pin) => {
    const stars = save.stars[String(pin.id)] ?? 0;
    const finished = stars >= 1 || pin.id < save.unlocked;
    return finished && hasGift(pin.id) && !missingCert(save, pin.id) && !opened.includes(pin.id);
  });
  return (
    <div className="column map">
      <div className="map-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h2>World map</h2>
        <span className="star-total"><Star className="star on" aria-hidden />{totalStars(save)}</span>
      </div>
      <div className="map-bar">
        <ShiftChip />
        <button className="zoom-toggle" type="button" onClick={() => setZoomed((on) => !on)}>
          {zoomed ? "Whole island" : "Zoom to next"}
        </button>
        {onRoam ? <button className="zoom-toggle" type="button" onClick={onRoam}>Walk the island</button> : null}
        <button className="zoom-toggle" type="button" onClick={() => { sfxClick(); setCenter({ highlight: null }); }}>Certificates</button>
      </div>
      <div className={zoomed ? "island-wrap zoomed" : "island-wrap"}>
        <IslandCamera focusX={spot.x} focusY={spot.y} zoom={zoomed}>
          <MapTrail reached={Math.min(save.unlocked, 15)} />
          {MAP_SPOTS.map((pin) => {
            const bonus = pin.id >= 26;
            const side = pin.id >= 16 && !bonus;
            const locked = Boolean(missingCert(save, pin.id)) || (bonus ? false : !side && pin.id > save.unlocked);
            const stars = save.stars[String(pin.id)] ?? 0;
            const mark = pin.id === 16 ? "N" : pin.id === 17 ? "L" : pin.id === 18 ? "O" : String(pin.id);
            const kind = levelKind(getLevel(pin.id));
            return (
              <button key={pin.id} type="button" className={`pin kind-${kind}${locked ? " locked" : ""}${stars > 0 ? " done" : ""}${pin.id === nextId ? " current" : ""}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} disabled={locked} onClick={() => { sfxClick(); setPreviewId(pin.id); }} aria-label={side ? getLevel(pin.id).name : `Level ${pin.id}`}>
                {mark}
                <Stars n={locked ? 0 : stars} tiny />
              </button>
            );
          })}
          {MAP_SPOTS.map((pin) => {
            const stars = save.stars[String(pin.id)] ?? 0;
            if (stars < 1 || opened.includes(pin.id) || !hasGift(pin.id) || missingCert(save, pin.id)) return null;
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
        <p className="map-caption">{(save.stars["5"] ?? 0) > 0 ? `Pick your next ward${next.evolved ? ` · ${nextId} evolved${next.evolved.note ? `, ${next.evolved.note}` : ""}` : ""}` : zoomed ? `Next · ${next.name}${next.evolved ? ` · evolved${next.evolved.note ? `, ${next.evolved.note}` : ""}` : ""}` : "Pick a ward"}</p>
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
      {center ? <CertificateCenter save={save} highlight={center.highlight} onEarn={onEarnCert} onClose={() => setCenter(null)} /> : null}
      {previewId != null ? (
        <LevelSheet
          levelId={previewId}
          level={previewId === nextId ? next : undefined}
          save={save}
          onClose={() => setPreviewId(null)}
          onPlay={() => {
            const id = previewId;
            setPreviewId(null);
            onPick(id);
          }}
        />
      ) : null}
      <div className="ward-row">
        {WARD_IDS.map((id) => {
          const open = wardsOpen(save.stars);
          const level = getLevel(id);
          return (
            <button key={id} type="button" className={(save.stars[String(id)] ?? 0) > 0 ? "done" : undefined} disabled={!open} onClick={() => { sfxClick(); setPreviewId(id); }}>
              {level.name}
              {(save.stars[String(id)] ?? 0) > 0 ? <Stars n={save.stars[String(id)] ?? 0} tiny /> : null}
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
  const [camScale, setCamScale] = useState(1);
  useEffect(() => {
    const wrap = frameRef.current?.parentElement;
    const frame = frameRef.current;
    if (!wrap || !frame) return;
    const apply = () => {
      if (!zoom) {
        setXf("translate(0px, 0px) scale(1)");
        setCamScale(1);
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
      setCamScale(scale);
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
    <div className="island-frame camera" ref={frameRef} style={{ transform: xf, ["--cam" as string]: camScale }}>
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
        <h3 className="help-sub">Combo perks</h3>
        <div className="rules">
          {Object.values(PERKS).map((perk) => (
            <div className="rule" key={perk.id}><img src={perk.icon} alt="" /><p><b>{perk.name}</b> · {perk.trigger}: {perk.effect}.</p></div>
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

/**
 * Height an arena board can take without pushing the power-up dock off screen. The stage above
 * it keeps its minimum height; everything else in the column is measured as laid out.
 */
function arenaRoom(slot: HTMLElement): { width: number; height: number } {
  const column = slot.closest(".column");
  if (!(column instanceof HTMLElement)) return { width: 0, height: Infinity };
  const style = window.getComputedStyle(column);
  const gap = parseFloat(style.rowGap) || 0;
  let used = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  for (const child of Array.from(column.children)) {
    if (!(child instanceof HTMLElement) || child === slot) continue;
    const position = window.getComputedStyle(child).position;
    if (position === "absolute" || position === "fixed") continue;
    if (child.classList.contains("play-stage")) {
      used += (parseFloat(window.getComputedStyle(child).minHeight) || 0) + gap;
      continue;
    }
    used += child.getBoundingClientRect().height + gap;
  }
  const width = column.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
  return { width, height: Math.max(120, column.clientHeight - used) };
}

function Play({
  model, save, side, cell, slotRef, frame, boardRef, liquidRef, particleRef, onBack, onPause, onResume, onSound, onMusic, onHaptics, onProfile, onAid, onCancel, onArm, onAdvance, onRetry, onNext, onHome, onCollect, onPointerDown, onPointerMove, onPointerUp,
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
  onPause: () => void;
  onResume: () => void;
  onSound: () => void;
  onMusic: () => void;
  onHaptics: () => void;
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
  const progress = { score: model.score, collected: model.collected, jellyLeft: countJelly(model.jelly), wrapsLeft: countWraps(model.board), contagionLeft: countLayer(model.contagion), feversTreated: model.feversTreated };
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
        : goalFraction(model.level, progress, model.jellyTotal, model.wrapsTotal, model.contagionTotal);
  const chips = arena ? [] : goalChips(model.level, progress, model.jellyTotal, model.wrapsTotal);
  const best = save.best[String(model.level.id)] ?? 0;
  const hintKeys = new Set((model.hint ?? []).map((pos) => keyOf(pos)));
  const icon = cell * 1.08;
  const scoreRef = useRef<HTMLElement | null>(null);
  const bossRef = useRef<HTMLElement | null>(null);
  const [kitOpen, setKitOpen] = useState(false);
  const powersOpen = powersUnlocked(save.unlocked, model.level);
  const aiming = model.phase === "aim-blast" || model.phase === "aim-stripe";
  const aimInfo = model.phase === "aim-blast" ? POWERS.blast : model.phase === "aim-stripe" ? POWERS.stripe : null;
  // Lines and shouts sit in a rail just above the board so they never cover a candy.
  const talking = Boolean(model.banner || model.perkFx || model.powerFx);
  const rail = (
    <div className={`talk-rail${arena ? " arena" : ""}${talking ? " live" : ""}`} style={arena ? undefined : { bottom: `calc(${((1 - frame.y) * 100).toFixed(2)}% + 0.7rem)` }} aria-live="polite">
      {model.powerFx ? <PowerCallout key={model.powerFx.key} fx={model.powerFx} /> : model.perkFx ? <PerkFx fx={model.perkFx} rows={model.level.rows} cols={model.level.cols} part="toast" /> : null}
      {model.banner && !model.powerFx ? <div className="banner" key={model.banner}>{model.banner}</div> : null}
    </div>
  );
  const scene = bossMax ? "/scenes/boss.jpg" : arena ? "/scenes/care.jpg" : `/scenes/${String(sceneFor(model.level)).padStart(2, "0")}.jpg`;
  const cols = model.level.cols;
  const rows = model.level.rows;
  const boardH = Math.round(side * rows / cols);
  const lifePct = Math.max(0, Math.min(100, model.playerHp));
  const lifeBar = (
    <div className={`vital life${lifePct <= 30 ? " low" : ""}${model.sting > 0 ? " hit" : ""}`}>
      <span className="vital-tag">You</span>
      {model.hit && model.sting > 0 ? <i key={model.hit.id} className="hit-pop" aria-hidden>{model.hit.label}</i> : null}
      <div className="vital-bar" role="meter" aria-label="Your life" aria-valuenow={Math.ceil(lifePct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${lifePct}%` }} />
      </div>
      <b className="vital-num">{Math.ceil(lifePct)}</b>
    </div>
  );
  const bossPct = boss && bossMax ? Math.max(0, Math.min(100, (boss.hp / bossMax) * 100)) : 0;
  const vitals = boss ? (
    <div className="hud-vitals">
      <div className={`vital foe${boss.guard > 0 ? " guarded" : ""}`}>
        <span className="vital-tag">{boss.profile.name.split(" ").pop()}</span>
        <div className="vital-bar" role="meter" aria-label={`${boss.profile.name} health`} aria-valuenow={Math.max(0, boss.hp)} aria-valuemin={0} aria-valuemax={bossMax}>
          <em style={{ width: `${bossPct}%` }} />
          <span style={{ width: `${bossPct}%` }} />
          <s style={{ left: "33.3%" }} />
          <s style={{ left: "66.6%" }} />
        </div>
        <b className="vital-num">{boss.hp <= 0 ? "Down" : boss.guard > 0 ? "Guard" : Math.ceil(boss.hp)}</b>
      </div>
      {lifeBar}
    </div>
  ) : microbes ? (
    <div className="hud-vitals">
      <div className="vital foe germs">
        <span className="vital-tag">Germs</span>
        <div className="vital-bar" role="meter" aria-label="Microbes fended off" aria-valuenow={model.germKills} aria-valuemin={0} aria-valuemax={germQuota}>
          <span style={{ width: `${Math.min(100, Math.round((model.germKills / germQuota) * 100))}%` }} />
        </div>
        <b className="vital-num">{model.germKills}/{germQuota}</b>
      </div>
      {lifeBar}
    </div>
  ) : null;
  const grid = (
    <>
      <LiquidBoard rows={rows} cols={cols} jelly={model.jelly} holes={model.mask} revision={model.score + model.moves + countJelly(model.jelly)} scene={scene} frame={arena ? { x: 0, y: 0, w: 1, h: 1 } : frame} apiRef={liquidRef} />
      <div className={`board-shell${model.shake ? " shake" : ""}${arena ? " icon-panel footer-grid" : ""}${arena && model.sting > 0 ? " contact" : ""}${model.perks.armed ? " bedside" : ""}${aiming ? ` aiming aim-${model.phase === "aim-blast" ? "blast" : "pill"}` : ""}`} style={{ width: side, height: boardH }}>
        <div className="board" ref={boardRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="application" aria-label={`${model.level.name} board`}>
          <div className={`pieces${model.animate ? " anim" : ""}`}>
            {model.view.map((tile) => {
              const selected = model.selected?.r === tile.r && model.selected?.c === tile.c;
              const roll = model.rolls.find((item) => item.id === tile.id);
              return (
                <div key={tile.id} className={["tile", tile.dying ? "dying" : "", tile.born ? "born" : "", selected ? "sel" : "", tile.wrap ? `wrapped wrap-${tile.wrap}` : "", tile.fuse ? `fever${tile.fuse <= 3 ? " fever-hot" : ""}` : "", hintKeys.has(`${tile.r},${tile.c}`) ? "hint" : "", model.locks.has(tile.id) ? "taped" : "", model.marked.includes(tile.id) ? "marked" : "", model.audited.includes(tile.id) ? "audited" : "", tile.special ? `power-${tile.special}` : "", roll ? (roll.dir > 0 ? "roll-cw" : "roll-ccw") : ""].filter(Boolean).join(" ")} style={{ width: icon, height: icon, transform: `translate(${tile.c * cell + (cell - icon) / 2}px, ${tile.r * cell + (cell - icon) / 2}px)` }}>
                  {arena && model.jelly[tile.r]?.[tile.c] ? <span className="goo" aria-hidden /> : null}
                  <img className="candy" src={spriteFor(tile)} alt="" draggable={false} />
                  {tile.special === "row" || tile.special === "col" ? <span className="shine" /> : null}
                  {tile.special === "bomb" ? <span className="ring" /> : null}
                  {tile.wrap ? <span className="wrap-band" aria-hidden /> : null}
                  {tile.fuse && !tile.dying ? <span className="fever-badge" aria-label={`Fever, ${tile.fuse} moves left`}>{tile.fuse}</span> : null}
                </div>
              );
            })}
          </div>
          {countLayer(model.contagion) > 0 ? (
            <div className="contagion-layer" aria-hidden>
              {model.contagion.flatMap((row, r) => row.map((on, c) => (on ? <span key={`${r}-${c}`} className="contagion-cell" style={{ width: cell, height: cell, transform: `translate(${c * cell}px, ${r * cell}px)` }} /> : null)))}
            </div>
          ) : null}
          {model.floats.map((item) => (
            <span key={item.id} className="floater" style={{ left: `${((item.c + 0.5) / cols) * 100}%`, top: `${((item.r + 0.5) / rows) * 100}%` }}>{item.text}</span>
          ))}
          {model.flash ? <div className={`fx-flash ${model.flash}`} /> : null}
          {model.perkFx ? <PerkFx fx={model.perkFx} rows={rows} cols={cols} part="board" /> : null}
          {model.powerFx ? <PowerFx fx={model.powerFx} rows={rows} cols={cols} /> : null}
          {model.perks.armed && !model.perkFx ? <span className="bedside-chip">Bedside +50%</span> : null}
          {model.countdown ? (
            <div className="count-down" aria-live="assertive"><b key={model.countdown} className={/\d/.test(model.countdown) ? "" : "word"}>{model.countdown}</b></div>
          ) : null}
        </div>
      </div>
    </>
  );
  return (
    <div className={`column play${arena ? " boss-play" : ""}${model.outcome && model.curtain === "done" ? (model.outcome === "win" ? " slowmo" : " slowmo lost") : ""}`}>
      {model.hit ? <span key={model.hit.id} className={`hurt-flash${lifePctFor(model) <= 30 ? " critical" : ""}`} aria-hidden /> : null}
      <div className="crush-nav">
        <span className="nav-side">
          {model.outcome ? (
            <button className="icon-btn" type="button" onClick={onBack} aria-label="Back to map"><ChevronLeft /></button>
          ) : (
            <button className="icon-btn" type="button" onClick={onPause} disabled={Boolean(model.countdown)} aria-label="Pause"><Pause /></button>
          )}
          <button className="icon-btn" type="button" onClick={onSound} aria-label={save.sound ? "Mute sound" : "Sound on"}>{save.sound ? <Volume2 /> : <VolumeX />}</button>
        </span>
        <img className="header-title" src="/ui/crush-title.png" alt="Sweet Care Crush" />
        <button className={`avatar-btn evo-ring evo-ring-s${save.evolution.stage}`} type="button" onClick={onProfile} aria-label={`${save.career.name} profile`}>
          <DocAvatar career={save.career} />
        </button>
      </div>
      <section className={["crush-hud", vitals ? "with-vitals" : "", boss ? `phase-${boss.phase}` : "", (boss || microbes) && model.sting > 0 ? "stung" : ""].filter(Boolean).join(" ")} aria-label="Ward status">
        <div className="hud-level">
          <b className="lvl-num">{model.level.custom ? "✎" : model.level.id}</b>
          <div className="lvl-copy">
            <div className="lvl-line">
              <span className="lvl-kicker">{model.level.boss || model.level.shiftLabel || "Ward"}</span>
              <span className="lvl-name">{model.level.name}</span>
              {boss ? <i className="phase-pips" aria-label={`Phase ${boss.phase + 1} of 3`}>{[0, 1, 2].map((n) => <b key={n} className={n <= boss.phase ? "on" : ""} />)}</i> : null}
            </div>
            {vitals ?? <div className="bar" aria-hidden><span style={{ width: `${Math.round(frac * 100)}%` }} /></div>}
          </div>
        </div>
        <div className="hud-score">
          <span className="kicker">Score</span>
          <strong className="live-score" ref={scoreRef} key={model.score}>{model.score}</strong>
          <span className="sr-only">Score {model.score}. Best {best}.</span>
        </div>
        <div className={`hud-moves${model.moves <= 5 && !arena ? " low" : ""}`}>
          <span className="kicker">Moves</span>
          <strong key={model.moves}>{model.moves}</strong>
        </div>
      </section>
      <div className="hud-meta">
        {chips.length ? (
          <ul className="goal-chips" aria-label="Goals">
            {chips.map((chip) => (
              <li key={chip.key} className={chip.done ? "done" : ""}>
                {chip.kind ? <img src={`/sprites/${chip.kind}.png`} alt={chip.kind} /> : <i className={chip.mark ? `chip-${chip.mark}` : chip.jelly ? "chip-jelly" : chip.wrap ? "chip-wrap" : "chip-score"} aria-label={chip.mark === "contagion" ? "Contagion" : chip.mark === "fever" ? "Fevers" : chip.jelly ? "Jelly" : chip.wrap ? "Wraps" : "Score"} />}
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ComboCounter live={model.dive} best={model.maxCombo} />
        {model.challenge && !model.outcome ? (
          <ChallengeChip
            challenge={model.challenge}
            done={challengeMet(model.challenge, { won: false, maxCombo: model.maxCombo, movesLeft: model.moves, stars: 0, seconds: 0, boostersUsed: model.boostersUsed, destroyed: KINDS.reduce((sum, kind) => sum + model.collected[kind], 0) })}
          />
        ) : null}
      </div>
      {boss && model.emergency ? (
        <div className="boss-strip emergency-strip">
          <EmergencyMeter state={model.emergency} flood={floodLevel(model.jelly, model.mask)} />
        </div>
      ) : null}
      <div className={`play-stage${arena ? " boss-stage" : ""}`} ref={arena ? undefined : slotRef}>
        {boss ? (
          <>
            <span className="danger-glow" aria-hidden style={{ opacity: Math.max(0, (boss.near - 55) / 45) }} />
            {boss.action?.move === "charge" ? (
              <span className="charge-lane" aria-hidden style={{ left: `${karenLeft(boss.lane)}%`, top: `${karenTop(boss.near)}%`, ["--wind" as string]: String(windupProgress(boss)) }} />
            ) : null}
            <span ref={bossRef} className={["karen-walk", boss.hot > 0 ? "hot" : "", boss.slow > 0 ? "hurt" : "", boss.action ? `winding ${boss.action.move}` : "", boss.guard > 0 ? "guard" : "", `phase-${boss.phase}`, boss.hp <= 0 ? "down" : ""].filter(Boolean).join(" ")} style={{ left: `${karenLeft(boss.lane)}%`, top: `${karenTop(boss.near)}%`, ["--depth" as string]: String(0.86 + boss.near * 0.0026) }}>
              {boss.action ? (
                <span className={`intent ${boss.action.move}`} role="status" style={{ ["--wind" as string]: String(windupProgress(boss)) }}>
                  <i aria-hidden />
                  {MOVE_LABEL[boss.action.move]}
                </span>
              ) : boss.hot > 0 ? <span className="hot-line">I'm hot!</span> : null}
              {boss.hot > 0 || boss.action?.move === "coffee" ? <span className="steam" /> : null}
              <span className="karen-fan">
                <KarenWalk slow={boss.slow > 0 || boss.hot > 0} facing={boss.dir} paused={Boolean(model.outcome) || model.paused || boss.hp <= 0 || Boolean(boss.action)} />
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
        {rail}
      </div>
      {aimInfo ? (
        <p className="aim-note"><img src={aimInfo.sprite} alt="" />{aimInfo.hint}<button type="button" onClick={onCancel}>Cancel</button></p>
      ) : null}
      {arena ? <div className="boss-footer" ref={slotRef} style={{ width: side }}>{grid}</div> : null}
      <div className={`kit-dock${powersOpen ? "" : " locked"}`}>
        {kitOpen && powersOpen ? (
          <div className="kit-pop" role="dialog" aria-label="Power up">
            <div className="kit-row">
              <button type="button" className={`kit-card${model.phase === "aim-blast" ? " on" : ""}`} disabled={model.boosters.blast <= 0 || model.phase === "busy" || Boolean(model.outcome)} onClick={() => { onArm("blast"); setKitOpen(false); }}>
                <img src={POWERS.blast.sprite} alt="" />
                <span className="kit-pill">{POWERS.blast.name}<b>{model.boosters.blast}</b></span>
              </button>
              <button type="button" className={`kit-card${model.phase === "aim-stripe" ? " on" : ""}`} disabled={model.boosters.stripe <= 0 || model.phase === "busy" || Boolean(model.outcome)} onClick={() => { onArm("stripe"); setKitOpen(false); }}>
                <img src={POWERS.stripe.sprite} alt="" />
                <span className="kit-pill">{POWERS.stripe.name}<b>{model.boosters.stripe}</b></span>
              </button>
              <button type="button" className="kit-card" disabled={model.boosters.aid <= 0 || model.phase === "busy" || Boolean(model.outcome)} onClick={() => { onAid(); setKitOpen(false); }}>
                <img src={POWERS.aid.sprite} alt="" />
                <span className="kit-pill">{POWERS.aid.name}<b>{model.boosters.aid}</b></span>
              </button>
            </div>
          </div>
        ) : null}
        {powersOpen ? (
          <button className={`kit-toggle${kitOpen ? " open" : ""}${aiming ? " aiming" : ""}`} type="button" aria-expanded={kitOpen} onClick={() => { if (aiming) onCancel(); setKitOpen((open) => !open); }}>
            {aiming ? "Cancel power up" : "Power up"}
          </button>
        ) : (
          <button className="kit-toggle" type="button" disabled aria-disabled="true">
            <Lock className="kit-lock" aria-hidden /> Power ups unlock after Ward {POWER_UNLOCK_WARD}
          </button>
        )}
      </div>
      <ParticleLayer boardRef={boardRef} scoreRef={scoreRef} bossRef={bossRef} rows={rows} cols={cols} apiRef={particleRef} />
      {model.paused && !model.outcome ? (
        <PauseSheet save={save} level={model.level} onResume={onResume} onRestart={onRetry} onQuit={onBack} onSound={onSound} onMusic={onMusic} onHaptics={onHaptics} />
      ) : null}
      {model.outcome && model.curtain === "done" ? (
        <LevelComplete won={model.outcome === "win"} name={model.level.custom ? "Your test level" : model.level.name} reason={model.outcome === "lose" ? model.endReason ?? null : null} stars={model.stars} bonus={model.endBonus ?? 0} onSkip={onAdvance} />
      ) : model.outcome ? (
        <Outro model={model} save={save} destroyed={KINDS.filter((kind) => model.collected[kind] > 0)} onAdvance={onAdvance} onRetry={onRetry} onNext={onNext} onBack={onBack} onProfile={onProfile} onHome={onHome} onCollect={onCollect} />
      ) : null}
    </div>
  );
}

/** Takes life from the player and arms the red screen flash plus the floating damage number. */
function lifePctFor(model: Model) {
  return Math.max(0, Math.min(100, model.playerHp));
}

function hurtPlayer(model: Model, amount: number, sting = 0.5) {
  model.playerHp = Math.max(0, model.playerHp - amount);
  model.sting = Math.max(model.sting, sting);
  model.hit = { id: (model.hit?.id ?? 0) + 1, label: `-${Math.round(amount)}` };
}

/** Karen paces the open aisle between the desk arms (not on top of them) and walks down toward the board. */
function karenLeft(lane: number) {
  return 28 + lane * 44;
}

function karenTop(near: number) {
  return 5 + near * 0.53;
}

const KAREN_SHEET = "/sprites/karen-walk-sheet.webp";
const KAREN_FRAMES = 73;
const KAREN_COLS = 12;
const KAREN_ROWS = 7;

/**
 * Karen's walk cycle, pre-keyed into a transparent sprite sheet (12x7, 73 frames).
 * The old version chroma-keyed an mp4 every frame, which flickered, ate her sneakers,
 * resized her mid-stride and stayed blank on iPhone, where a detached video never decodes.
 */
function KarenWalk({ slow, facing, paused }: { slow: boolean; facing: number; paused: boolean }) {
  const spriteRef = useRef<HTMLSpanElement | null>(null);
  const slowRef = useRef(slow);
  const pausedRef = useRef(paused);
  slowRef.current = slow;
  pausedRef.current = paused;
  useEffect(() => {
    const el = spriteRef.current;
    if (!el) return;
    let raf = 0;
    let frame = 0;
    let acc = 0;
    let last = performance.now();
    const place = () => {
      const col = frame % KAREN_COLS;
      const row = Math.floor(frame / KAREN_COLS);
      el.style.backgroundPosition = `${(col / (KAREN_COLS - 1)) * 100}% ${(row / (KAREN_ROWS - 1)) * 100}%`;
    };
    place();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (pausedRef.current || reducedMotion()) return;
      acc += dt * (slowRef.current ? 2.8 : 6.6);
      if (acc < 1) return;
      frame = (frame + Math.floor(acc)) % KAREN_FRAMES;
      acc %= 1;
      place();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="karen-clip" style={{ transform: `scaleX(${facing < 0 ? -1 : 1})` }}>
      <span ref={spriteRef} className="karen-sprite" />
    </span>
  );
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
      <p className="card-reveal-note">Card added. Hand cards in at the Certificate Center to open new paths.</p>
      <button className="btn" type="button" onClick={onClose}>Keep</button>
    </div>
  );
}
function PauseSheet({ save, level, onResume, onRestart, onQuit, onSound, onMusic, onHaptics }: {
  save: SaveData;
  level: LevelDef;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onSound: () => void;
  onMusic: () => void;
  onHaptics: () => void;
}) {
  const [confirm, setConfirm] = useState<"restart" | "quit" | null>(null);
  const resumeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    resumeRef.current?.focus();
  }, [confirm]);
  const realTime = Boolean(level.bossHp || level.encounter === "microbe");
  if (confirm) {
    return (
      <div className="pause-sheet">
        <div className="modal" role="alertdialog" aria-label={confirm === "quit" ? "Quit this ward?" : "Restart this ward?"}>
          <h2>{confirm === "quit" ? "Quit ward?" : "Restart?"}</h2>
          <p>{confirm === "quit" ? (level.custom ? "You'll go back to the editor." : "This attempt won't count and your moves are lost.") : "You'll start this ward again from the first move."}</p>
          <div className="pause-actions">
            <button className="btn" type="button" ref={resumeRef} onClick={() => setConfirm(null)}>Keep playing</button>
            <button className="btn secondary" type="button" onClick={confirm === "quit" ? onQuit : onRestart}>{confirm === "quit" ? "Quit" : "Restart"}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pause-sheet">
      <div className="modal" role="dialog" aria-label="Paused">
        <h2>Paused</h2>
        <p>{level.custom ? "Your test level" : level.name}{realTime ? " · the ward is holding still" : ""}</p>
        <div className="pause-actions">
          <button className="btn" type="button" ref={resumeRef} onClick={onResume}>Resume</button>
          <button className="btn secondary" type="button" onClick={() => setConfirm("restart")}>Restart</button>
          <button className="btn secondary" type="button" onClick={() => setConfirm("quit")}>{level.custom ? "Back to editor" : "Quit to map"}</button>
        </div>
        <div className="pause-toggles" role="group" aria-label="Quick settings">
          <button type="button" className={save.sound ? "on" : ""} aria-pressed={save.sound} onClick={onSound}>Sound</button>
          <button type="button" className={save.music ? "on" : ""} aria-pressed={save.music} onClick={onMusic}>Music</button>
          <button type="button" className={save.haptics ? "on" : ""} aria-pressed={save.haptics} onClick={onHaptics}>Vibration</button>
        </div>
        <p className="pause-key">Esc or P pauses and resumes.</p>
      </div>
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
  const pending = won && !model.level.custom && hasGift(model.level.id) && !(save.openedGifts ?? []).includes(model.level.id);
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
  const [evolving, setEvolving] = useState(model.evolving);
  const cutscene = evolving && model.care ? (
    <EvolutionCutscene
      career={save.career}
      from={model.care.reached[0]!.index - 1}
      to={model.care.reached}
      onDone={() => {
        model.evolving = false;
        setEvolving(false);
      }}
    />
  ) : null;
  if (model.curtain !== "next") {
    return (
      <div className={present ? "outro card-hold has-gift" : "outro card-hold"}>
        {won ? <Confetti /> : null}
        <div className={`modal summary${won ? " won" : " lost"}`} role="dialog" aria-label={won ? "Level summary" : "Out of moves"}>
          <div className="summary-body">
            <div className="summary-hero">
              <span className="hero-halo" aria-hidden />
              {won ? <span className="hero-rays" aria-hidden /> : null}
              {won ? <Cheer career={save.career} /> : <DocAvatar career={save.career} className="cheer" />}
            </div>
            <Stars n={won ? model.stars : 0} />
            <h2>{won ? model.level.name : "Out of moves"}</h2>
            {model.rankedUp ? <p className="rank-up">Rank up · {rankTitle(save.career.rank)}</p> : null}
            <p className="summary-score rise">Score <b><CountUp value={model.score} /></b><span>{formatClock(model.elapsed)}</span></p>
            <p className="combo-line rise">Best combo <b>x<CountUp value={model.maxCombo} /></b></p>
            {model.care ? <StageBar from={model.care.before} to={model.care.evolution.xp} gained={model.care.points.total} /> : null}
            <div className="wreck rise">
              <span className="kicker">Destroyed</span>
              <div className="wreck-row">
                {destroyed.map((kind, index) => (
                  <span key={kind} className="wreck-item" style={{ animationDelay: `${900 + index * 90}ms` }}><img src={`/sprites/${kind}.png`} alt="" /><CountUp value={model.collected[kind]} /></span>
                ))}
                {destroyed.length === 0 ? <span>None yet</span> : null}
              </div>
            </div>
            {model.payout ? <PayoutCard payout={model.payout} /> : null}
            {model.care ? <CareCard points={model.care.points} before={model.care.before} after={model.care.evolution} challenge={model.challenge} challengeDone={model.care.challengeDone} bar={false} /> : null}
            {model.badges.length > 0 ? <BadgeFlash badges={model.badges} /> : <p className="summary-note rise">No badges this round.</p>}
          </div>
          <div className="summary-foot">
            <button className="btn" type="button" onClick={onAdvance}>Next</button>
          </div>
        </div>
        {dock}
        {reveal}
        {cutscene}
      </div>
    );
  }
  return (
    <div className={present ? "outro after has-gift" : "outro after"}>
      <EvolvedAvatar career={save.career} evolution={save.evolution} className="after-doc" />
      <h2>{won ? model.level.name : "Out of moves"}</h2>
      <Stars n={won ? model.stars : 0} />
      {model.savedNow ? (
        <p className="save-banner">Progress saved.</p>
      ) : null}
      {model.care ? (
        <p className="care-banner">+{model.care.points.total} CP{model.care.evolution.streak > 1 ? ` · ${model.care.evolution.streak} wins in a row` : ""}</p>
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
    <div className="payout rise" aria-label={`${payout.total} coins earned`}>
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
