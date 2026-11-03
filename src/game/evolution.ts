/**
 * Character evolution and Care Points.
 *
 * Every ward pays Care Points (CP). CP is progress, not money: it is never spent.
 * Lifetime CP moves the nurse through five evolution stages. Each stage changes
 * how the nurse looks (aura, halo, wings, emblem) and adds one ability that
 * changes play a little. Coins (rewards.ts) stay the spendable currency.
 *
 * Pure module: no DOM, no React. The UI lives in src/components/Evolution.tsx.
 */
import type { Reward } from "./rewards.ts";

export type StageId = "trainee" | "caregiver" | "ward-hero" | "healer" | "guardian";

export type AbilityId = "steady-hands" | "triage-eye" | "second-wind" | "healing-aura";

export interface Ability {
  id: AbilityId;
  label: string;
  blurb: string;
}

export interface Stage {
  /** 0 to 4. */
  index: number;
  id: StageId;
  title: string;
  /** Lifetime Care Points needed to reach this stage. */
  need: number;
  /** One line about the look, for the profile and the evolution cutscene. */
  look: string;
  /** Ability gained at this stage, if any. Abilities stack. */
  ability: Ability | null;
  /** Paid once, the first time the stage is reached. */
  reward: Reward;
  /** Aura colours for the avatar wrapper and the map walker: [inner, outer]. */
  aura: [string, string];
  /** Small emblem shown on the avatar badge. */
  emblem: string;
}

export const ABILITIES: Record<AbilityId, Ability> = {
  "steady-hands": { id: "steady-hands", label: "Steady hands", blurb: "Every ward starts with 1 extra move." },
  "triage-eye": { id: "triage-eye", label: "Triage eye", blurb: "Every ward starts with a striped power on the board." },
  "second-wind": { id: "second-wind", label: "Second wind", blurb: "Once per ward, running out of moves gives you 3 more." },
  "healing-aura": { id: "healing-aura", label: "Healing aura", blurb: "All Care Points are worth 25% more." },
};

export const STAGES: Stage[] = [
  {
    index: 0,
    id: "trainee",
    title: "Trainee",
    need: 0,
    look: "Fresh scrubs and a name badge.",
    ability: null,
    reward: {},
    aura: ["rgba(255,255,255,0)", "rgba(255,255,255,0)"],
    emblem: "✚",
  },
  {
    index: 1,
    id: "caregiver",
    title: "Caregiver",
    need: 1200,
    look: "A soft pink glow and a heart pin.",
    ability: ABILITIES["steady-hands"],
    reward: { coins: 100, blast: 1 },
    aura: ["rgba(255,150,205,0.75)", "rgba(255,59,166,0)"],
    emblem: "♥",
  },
  {
    index: 2,
    id: "ward-hero",
    title: "Ward Hero",
    need: 4000,
    look: "A mint hero ring that pulses with every combo.",
    ability: ABILITIES["triage-eye"],
    reward: { coins: 200, stripe: 1 },
    aura: ["rgba(150,255,210,0.8)", "rgba(40,200,150,0)"],
    emblem: "★",
  },
  {
    index: 3,
    id: "healer",
    title: "Healer",
    need: 9000,
    look: "A golden halo and drifting sparkles.",
    ability: ABILITIES["second-wind"],
    reward: { coins: 300, aid: 1 },
    aura: ["rgba(255,225,120,0.9)", "rgba(255,170,40,0)"],
    emblem: "✦",
  },
  {
    index: 4,
    id: "guardian",
    title: "Guardian Angel",
    need: 16000,
    look: "Candy wings, a halo and a rainbow aura.",
    ability: ABILITIES["healing-aura"],
    reward: { coins: 500, blast: 1, stripe: 1, aid: 1 },
    aura: ["rgba(255,255,255,0.95)", "rgba(170,140,255,0)"],
    emblem: "✧",
  },
];

export const MAX_STAGE = STAGES.length - 1;

export interface Evolution {
  /** Lifetime Care Points. */
  xp: number;
  /** Highest stage reached and rewarded. */
  stage: number;
  /** Wins in a row. A loss resets it. */
  streak: number;
  bestStreak: number;
  /** Ward challenges completed, by level id. Counted for the profile. */
  challenges: number;
}

export function defaultEvolution(): Evolution {
  return { xp: 0, stage: 0, streak: 0, bestStreak: 0, challenges: 0 };
}

export function readEvolution(value: unknown): Evolution {
  const base = defaultEvolution();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Record<keyof Evolution, unknown>>;
  const xp = whole(raw.xp, 99_999_999);
  // The stage can never run ahead of the points, so a hand-edited save cannot skip.
  const stage = Math.min(whole(raw.stage, MAX_STAGE), stageIndexFor(xp));
  return {
    xp,
    stage,
    streak: whole(raw.streak, 9999),
    bestStreak: whole(raw.bestStreak, 9999),
    challenges: whole(raw.challenges, 99999),
  };
}

function whole(value: unknown, cap: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(cap, Math.floor(value)));
}

/** The stage index lifetime points have earned. */
export function stageIndexFor(xp: number): number {
  let index = 0;
  for (const stage of STAGES) if (xp >= stage.need) index = stage.index;
  return index;
}

export function stageFor(xp: number): Stage {
  return STAGES[stageIndexFor(xp)]!;
}

/** Progress inside the current stage, 0 to 1 (1 at the final stage). */
export function stageProgress(xp: number) {
  const index = stageIndexFor(xp);
  const stage = STAGES[index]!;
  const next = STAGES[index + 1];
  if (!next) return { stage, next: null, into: xp - stage.need, span: 0, ratio: 1 };
  const span = next.need - stage.need;
  const into = xp - stage.need;
  return { stage, next, into, span, ratio: Math.max(0, Math.min(1, into / span)) };
}

/** Every ability the nurse has at a stage. They stack. */
export function abilitiesAt(stageIndex: number): AbilityId[] {
  return STAGES.filter((stage) => stage.index <= stageIndex && stage.ability).map((stage) => stage.ability!.id);
}

export function hasAbility(evolution: Evolution, id: AbilityId) {
  return abilitiesAt(evolution.stage).includes(id);
}

/** How the abilities change the start of a ward. Kept here so the game wiring stays a few lines. */
export function wardPerks(evolution: Evolution) {
  const owned = abilitiesAt(evolution.stage);
  return {
    extraMoves: owned.includes("steady-hands") ? 1 : 0,
    startStripe: owned.includes("triage-eye"),
    secondWind: owned.includes("second-wind") ? 3 : 0,
    pointBoost: owned.includes("healing-aura") ? 1.25 : 1,
  };
}

/* ------------------------------------------------------------------ */
/* Ward challenges: one small optional goal per ward, for bonus points. */
/* ------------------------------------------------------------------ */

export type ChallengeKind = "combo" | "spare" | "perfect" | "swift" | "clean" | "destroy";

export interface Challenge {
  kind: ChallengeKind;
  target: number;
  label: string;
  points: number;
}

export interface ChallengeInput {
  levelId: number;
  /** How many times this ward has been cleared. A new clear rolls a new challenge. */
  clears: number;
  /** Boss, microbe and heal stages: move-based challenges make no sense there. */
  encounter: boolean;
  moves: number;
}

function hash(a: number, b: number) {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

/** The ward's bonus challenge. Stable for an attempt, changes after each clear. */
export function challengeFor(input: ChallengeInput): Challenge {
  const pool: ChallengeKind[] = input.encounter ? ["combo", "swift", "clean", "destroy"] : ["combo", "spare", "perfect", "swift", "clean", "destroy"];
  const h = hash(input.levelId, input.clears);
  const kind = pool[h % pool.length]!;
  const tier = Math.min(2, Math.floor((input.levelId - 1) / 10));
  switch (kind) {
    case "combo": {
      const target = 3 + tier;
      return { kind, target, label: `Land a x${target} combo`, points: 80 + tier * 20 };
    }
    case "spare": {
      const target = Math.max(2, Math.min(8, Math.round(input.moves * 0.2)));
      return { kind, target, label: `Win with ${target}+ moves left`, points: 100 + tier * 20 };
    }
    case "perfect":
      return { kind, target: 3, label: "Earn 3 stars", points: 120 + tier * 20 };
    case "swift": {
      const target = input.encounter ? 150 - tier * 15 : 120 - tier * 15;
      return { kind, target, label: `Win in under ${target}s`, points: 90 + tier * 20 };
    }
    case "clean":
      return { kind, target: 0, label: "Win without boosters", points: 90 + tier * 20 };
    case "destroy": {
      const target = 60 + tier * 30;
      return { kind, target, label: `Clear ${target} icons`, points: 80 + tier * 20 };
    }
  }
}

export interface ChallengeState {
  won: boolean;
  maxCombo: number;
  movesLeft: number;
  stars: number;
  seconds: number;
  boostersUsed: number;
  destroyed: number;
}

/** Whether the challenge is met. Live checks (combo, destroy) can pass mid-ward; the rest need the win. */
export function challengeMet(challenge: Challenge, state: ChallengeState): boolean {
  switch (challenge.kind) {
    case "combo":
      return state.maxCombo >= challenge.target;
    case "destroy":
      return state.destroyed >= challenge.target;
    case "spare":
      return state.won && state.movesLeft >= challenge.target;
    case "perfect":
      return state.won && state.stars >= 3;
    case "swift":
      return state.won && state.seconds < challenge.target;
    case "clean":
      return state.won && state.boostersUsed === 0;
  }
}

/* --------------------------------------------- */
/* Care Points: what a round pays toward evolving. */
/* --------------------------------------------- */

export interface PointLine {
  label: string;
  points: number;
}

export interface CareReport {
  won: boolean;
  stars: number;
  prevStars: number;
  maxCombo: number;
  movesLeft: number;
  boss: boolean;
  destroyed: number;
  challenge: Challenge | null;
  challengeDone: boolean;
}

export interface CarePoints {
  lines: PointLine[];
  /** Sum of the lines before multipliers. */
  base: number;
  /** Win streak multiplier, 1 to 1.5. */
  streakMult: number;
  /** Healing aura multiplier, 1 or 1.25. */
  auraMult: number;
  total: number;
}

/** Streak multiplier for the streak a win lands on: x1.0 on the first win, +0.1 each, capped at x1.5. */
export function streakMultiplier(streak: number) {
  return 1 + Math.min(5, Math.max(0, streak - 1)) * 0.1;
}

export function carePoints(evolution: Evolution, report: CareReport): CarePoints {
  const lines: PointLine[] = [];
  if (report.won) {
    lines.push({ label: "Ward cleared", points: 100 });
    if (report.stars > 0) lines.push({ label: `${report.stars} star${report.stars === 1 ? "" : "s"}`, points: report.stars * 50 });
    if (report.prevStars === 0) lines.push({ label: "First clear", points: 100 });
    if (report.boss) lines.push({ label: "Emergency handled", points: 150 });
    const spare = Math.min(20, Math.max(0, report.movesLeft)) * 10;
    if (spare > 0) lines.push({ label: "Spare moves", points: spare });
  } else {
    lines.push({ label: "Shift experience", points: 20 });
  }
  const combo = Math.min(10, Math.max(0, report.maxCombo - 1)) * 15;
  if (combo > 0) lines.push({ label: `Combo x${report.maxCombo}`, points: combo });
  const care = Math.min(60, Math.floor(report.destroyed / 10) * 2);
  if (care > 0) lines.push({ label: "Icons cleared", points: care });
  if (report.challenge && report.challengeDone) lines.push({ label: report.challenge.label, points: report.challenge.points });
  const base = lines.reduce((sum, line) => sum + line.points, 0);
  const streakMult = report.won ? streakMultiplier(evolution.streak + 1) : 1;
  const auraMult = wardPerks(evolution).pointBoost;
  return { lines, base, streakMult, auraMult, total: Math.round(base * streakMult * auraMult) };
}

export interface EvolveResult {
  evolution: Evolution;
  points: CarePoints;
  /** Stages reached for the first time this round, in order. Usually empty, sometimes one. */
  reached: Stage[];
}

/** Apply a finished round. Returns the new evolution state and any stages just reached. */
export function applyCare(evolution: Evolution, report: CareReport): EvolveResult {
  const points = carePoints(evolution, report);
  const xp = evolution.xp + points.total;
  const streak = report.won ? evolution.streak + 1 : 0;
  const target = stageIndexFor(xp);
  const reached = STAGES.filter((stage) => stage.index > evolution.stage && stage.index <= target);
  return {
    points,
    reached,
    evolution: {
      xp,
      stage: Math.max(evolution.stage, target),
      streak,
      bestStreak: Math.max(evolution.bestStreak, streak),
      challenges: evolution.challenges + (report.challenge && report.challengeDone ? 1 : 0),
    },
  };
}

/** The combined reward for every stage reached, for granting into the wallet. */
export function stageRewards(reached: Stage[]): Reward {
  const total: Required<Reward> = { coins: 0, blast: 0, stripe: 0, aid: 0 };
  for (const stage of reached) {
    total.coins += stage.reward.coins ?? 0;
    total.blast += stage.reward.blast ?? 0;
    total.stripe += stage.reward.stripe ?? 0;
    total.aid += stage.reward.aid ?? 0;
  }
  return total;
}

/**
 * What the overworld walker (and any other small sprite of the nurse) needs to show her stage.
 * aura is null for the Trainee so the walker stays plain.
 */
export function walkerLook(evolution: Evolution) {
  const stage = STAGES[evolution.stage] ?? STAGES[0]!;
  return {
    stage: stage.index,
    title: stage.title,
    emblem: stage.emblem,
    aura: stage.index > 0 ? stage.aura[0] : null,
    /** Walker size in rem: she stands a little taller as she evolves. */
    size: 3.2 + stage.index * 0.15,
    halo: stage.index >= 3,
    wings: stage.index >= 4,
  };
}
