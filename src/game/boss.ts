/**
 * Nurse Karen's brain. Pure state so the arena can tick it every frame and tests can drive it.
 *
 * She walks toward the icons, and between strides she winds up an attack. Every attack is
 * announced first (the windup), so the player always gets a beat to answer it. Landing a big
 * hit during a windup interrupts it. Losing a third of her chart pushes her into the next phase,
 * which unlocks harder moves and shortens the gap between them.
 */

export type BossMove = "charge" | "paperwork" | "writeup" | "coffee";

export interface BossProfile {
  name: string;
  tier: 1 | 2 | 3;
  /** Moves she can pick in each phase. Index 0 is the opening phase. */
  moves: [BossMove[], BossMove[], BossMove[]];
  /** Percent of the stage she covers per second while walking. */
  walk: number;
  /** Seconds between attacks in the opening phase. */
  rest: number;
  /** Life lost when she reaches the icons. */
  bite: number;
  /** Damage in one hit that cancels a windup. */
  interruptAt: number;
}

export interface BossAction {
  move: BossMove;
  /** Seconds since the windup started. */
  t: number;
  windup: number;
  /** Tiles taped by paperwork, moves taken by a write-up. */
  power: number;
}

export interface BossState {
  profile: BossProfile;
  hp: number;
  max: number;
  phase: 0 | 1 | 2;
  /** 0 is the back of the stage, 100 is on the icons. */
  near: number;
  /** 0 to 1 across the stage. */
  lane: number;
  dir: 1 | -1;
  /** Seconds left of a shove or stagger. She barely moves while it runs. */
  slow: number;
  /** Seconds left of the red-faced "I'm hot!" flinch after a hit. */
  hot: number;
  /** Seconds of phase-change armor. Hits do no damage while it runs. */
  guard: number;
  action: BossAction | null;
  /** Seconds until the next windup starts. */
  cooldown: number;
  hits: number;
  seed: number;
}

export type BossEvent =
  | { type: "telegraph"; move: BossMove; power: number }
  | { type: "strike"; move: BossMove; power: number }
  | { type: "interrupt"; move: BossMove }
  | { type: "phase"; phase: 1 | 2 }
  | { type: "heal"; amount: number }
  | { type: "contact"; bite: number }
  | { type: "down" };

export const MOVE_LABEL: Record<BossMove, string> = {
  charge: "Charging!",
  paperwork: "Paperwork!",
  writeup: "Write-up!",
  coffee: "Coffee break",
};

const WINDUP: Record<BossMove, number> = {
  charge: 1.6,
  paperwork: 2.2,
  writeup: 2.6,
  coffee: 3.2,
};

export const BOSSES: Record<1 | 2 | 3, BossProfile> = {
  1: {
    name: "Nurse Karen",
    tier: 1,
    moves: [["paperwork"], ["paperwork", "charge"], ["charge", "writeup"]],
    walk: 4.2,
    rest: 7.5,
    bite: 16,
    interruptAt: 12,
  },
  2: {
    name: "Karen Returns",
    tier: 2,
    moves: [["paperwork", "charge"], ["charge", "writeup", "coffee"], ["charge", "paperwork", "writeup", "coffee"]],
    walk: 5,
    rest: 6.5,
    bite: 18,
    interruptAt: 16,
  },
  3: {
    name: "Head Nurse Karen",
    tier: 3,
    moves: [["charge", "paperwork", "writeup"], ["charge", "paperwork", "writeup", "coffee"], ["charge", "paperwork", "writeup", "coffee"]],
    walk: 5.8,
    rest: 5.6,
    bite: 20,
    interruptAt: 20,
  },
};

/** Ward 5 is her first shift. Later boss wards get the meaner profiles. */
export function bossTierFor(levelId: number, bossHp: number): 1 | 2 | 3 {
  if (levelId >= 15 || bossHp >= 200) return 3;
  if (levelId >= 10 || bossHp >= 140) return 2;
  return 1;
}

export function createBoss(hp: number, tier: 1 | 2 | 3, seed = 1): BossState {
  const profile = BOSSES[tier];
  return {
    profile,
    hp,
    max: hp,
    phase: 0,
    near: 0,
    lane: 0.18,
    dir: 1,
    slow: 0,
    hot: 0,
    guard: 0,
    action: null,
    cooldown: profile.rest * 0.6,
    hits: 0,
    seed: (seed >>> 0) || 1,
  };
}

function roll(state: BossState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function phaseFor(hp: number, max: number): 0 | 1 | 2 {
  if (max <= 0) return 0;
  const left = hp / max;
  if (left > 2 / 3) return 0;
  if (left > 1 / 3) return 1;
  return 2;
}

function restFor(state: BossState): number {
  return state.profile.rest * (1 - state.phase * 0.18);
}

function powerFor(state: BossState, move: BossMove): number {
  if (move === "paperwork") return 2 + state.phase + (state.profile.tier >= 3 ? 1 : 0);
  if (move === "writeup") return state.phase >= 2 ? 2 : 1;
  if (move === "coffee") return Math.round(state.max * (0.06 + state.profile.tier * 0.02));
  return 26 + state.phase * 6;
}

function pickMove(state: BossState): BossMove {
  const list = state.profile.moves[state.phase];
  let move = list[Math.floor(roll(state) * list.length)] ?? list[0]!;
  // Coffee is only worth it once she is hurt, and a charge from the front row is pointless.
  if (move === "coffee" && state.hp > state.max * 0.8) move = list.find((item) => item !== "coffee") ?? "charge";
  if (move === "charge" && state.near > 70) move = list.find((item) => item !== "charge") ?? "paperwork";
  return move;
}

/** True while she is winding up. Hits land harder then. */
export function exposed(state: BossState): boolean {
  return Boolean(state.action);
}

export function windupProgress(state: BossState): number {
  if (!state.action) return 0;
  return Math.min(1, state.action.t / state.action.windup);
}

function land(state: BossState, action: BossAction, events: BossEvent[]) {
  const { move, power } = action;
  if (move === "charge") {
    state.near = Math.min(100, state.near + power);
  } else if (move === "coffee") {
    const before = state.hp;
    state.hp = Math.min(state.max, state.hp + power);
    if (state.hp > before) events.push({ type: "heal", amount: state.hp - before });
  }
  events.push({ type: "strike", move, power });
}

export function stepBoss(state: BossState, dt: number): BossEvent[] {
  const events: BossEvent[] = [];
  if (state.hp <= 0 || dt <= 0) return events;
  state.slow = Math.max(0, state.slow - dt);
  state.hot = Math.max(0, state.hot - dt);
  state.guard = Math.max(0, state.guard - dt);

  const action = state.action;
  if (action) {
    // She plants her feet while winding up, except for a charge, where she leans in.
    action.t += dt;
    if (state.slow > 0) action.t -= dt * 0.5;
    if (action.t >= action.windup) {
      state.action = null;
      state.cooldown = restFor(state);
      land(state, action, events);
    }
  } else {
    const stride = state.slow > 0 ? 0.04 : 0.18 + state.phase * 0.04;
    state.lane += state.dir * stride * dt;
    if (state.lane <= 0) {
      state.lane = 0;
      state.dir = 1;
    } else if (state.lane >= 1) {
      state.lane = 1;
      state.dir = -1;
    }
    const pace = state.slow > 0 ? 1.2 : state.profile.walk * (1 + state.phase * 0.2);
    state.near = Math.min(100, state.near + pace * dt);
    if (state.slow <= 0) state.cooldown -= dt;
    if (state.cooldown <= 0 && state.guard <= 0) {
      const move = pickMove(state);
      const power = powerFor(state, move);
      state.action = { move, t: 0, windup: WINDUP[move] * (1 - state.phase * 0.08), power };
      events.push({ type: "telegraph", move, power });
    }
  }

  if (state.near >= 98) {
    events.push({ type: "contact", bite: state.profile.bite });
    // She grabs the chart and gets shooed back to the middle of the room.
    state.near = 48;
    state.slow = Math.max(state.slow, 1.2);
    if (state.action) state.action = null;
    state.cooldown = Math.max(state.cooldown, restFor(state) * 0.5);
  }
  return events;
}

/**
 * One volley from the board. `big` is a cascade of three or more, or a power piece going off.
 * Damage is multiplied while she is exposed in a windup.
 */
export function hitBoss(state: BossState, damage: number, big = false): { dealt: number; events: BossEvent[] } {
  const events: BossEvent[] = [];
  if (state.hp <= 0 || damage <= 0) return { dealt: 0, events };
  if (state.guard > 0) return { dealt: 0, events };
  const dealt = Math.round(damage * (state.action ? 1.5 : 1));
  const before = state.phase;
  state.hp = Math.max(0, state.hp - dealt);
  state.hits += 1;
  state.hot = 1.35;
  if (state.action && (big || dealt >= state.profile.interruptAt)) {
    events.push({ type: "interrupt", move: state.action.move });
    state.action = null;
    state.cooldown = restFor(state);
    state.slow = Math.max(state.slow, 1.6);
  }
  if (state.hp <= 0) {
    state.action = null;
    events.push({ type: "down" });
    return { dealt, events };
  }
  const next = phaseFor(state.hp, state.max);
  if (next > before) {
    state.phase = next;
    state.guard = 1;
    state.action = null;
    state.near = Math.max(0, state.near - 30);
    state.cooldown = restFor(state) * 0.5;
    events.push({ type: "phase", phase: next as 1 | 2 });
  }
  return { dealt, events };
}

/** A shove from the board. Pushes her back and slows her stride for a moment. */
export function shoveBoss(state: BossState, push: boolean) {
  if (state.hp <= 0) return;
  state.slow = Math.max(state.slow, push ? 2.4 : 1.6);
  state.near = Math.max(0, state.near - (push ? 14 : 4));
}
