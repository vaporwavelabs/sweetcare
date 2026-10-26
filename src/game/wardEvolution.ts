import { evolve, evolveAsync, wardPlan, type EvolveOptions } from "./evolve.ts";
import { generateWard } from "./generator.ts";
import type { LevelDef } from "./levels.ts";
import type { ShiftId } from "./shifts.ts";
import { targetRate } from "./simulate.ts";

/**
 * Rolled wards (3 to 15, not bosses) are evolved for the player.
 *
 * The roll from generator.ts is the seed of a short evolve run whose target win rate follows how
 * the player has been doing lately (`formOffset`). The run is too slow to block a tap, so the
 * map starts it in the background for the next ward. When a ward starts, whatever is ready is
 * locked to that attempt: the evolved ward if it finished, the plain roll if not. A retry
 * always gets the same board.
 */

/** Bump when the engine changes so stale evolved wards are not reused. */
const VERSION = 1;
const STORE = "sweet-care-evolved-v1";
const KEEP = 16;

export interface FormEntry {
  id: number;
  won: boolean;
  /** Share of the moves left over on a win, 0 on a loss. */
  spare: number;
}

export const FORM_SIZE = 6;

export function pushForm(form: FormEntry[] | undefined, entry: FormEntry): FormEntry[] {
  return [...(form ?? []), entry].slice(-FORM_SIZE);
}

/**
 * How far to move a ward's target win rate. Losses ease the next roll, comfortable wins firm it
 * up. Recent results count more. Bounded so a bad day never flattens the campaign.
 */
export function formOffset(form: FormEntry[] | undefined): number {
  if (!form?.length) return 0;
  let offset = 0;
  form.forEach((entry, i) => {
    const weight = (i + 1) / form.length;
    if (!entry.won) offset += 0.045 * weight;
    else if (entry.spare >= 0.35) offset -= 0.03 * weight;
    else if (entry.spare <= 0.08) offset += 0.01 * weight;
  });
  return Math.max(-0.08, Math.min(0.12, Math.round(offset * 100) / 100));
}

export function formLabel(offset: number): string | null {
  if (offset >= 0.04) return "eased for you";
  if (offset <= -0.04) return "sharpened for you";
  return null;
}

export function isRolledWard(level: LevelDef): boolean {
  return level.id >= 3 && level.id <= 15 && !level.bossHp && !level.encounter && !level.custom;
}

function keyOf(id: number, seed: number, shiftId: ShiftId) {
  return `${VERSION}|${id}|${seed}|${shiftId}`;
}

export function wardOptions(plain: LevelDef, offset: number): EvolveOptions {
  let target = targetRate(plain.id);
  if (plain.shiftId === "short-staffed") target -= 0.08;
  target = Math.max(0.4, Math.min(0.95, target + offset));
  // Shifts whose whole point is the goal keep it.
  const lockGoals = plain.shiftId === "night-shift" || plain.shiftId === "spill-risk";
  return {
    target,
    seed: (plain.seed ?? plain.id) % 99991,
    population: 6,
    generations: 4,
    runs: 6,
    lockKinds: true,
    lockGoals,
    ...wardPlan(plain.id),
  };
}

function shape(plain: LevelDef, evolved: LevelDef, options: EvolveOptions, generations: number, offset: number): LevelDef {
  const lift = plain.shiftId === "night-shift" ? 1.12 : 1;
  return {
    ...evolved,
    id: plain.id,
    name: plain.name,
    seed: plain.seed,
    shiftId: plain.shiftId,
    shiftLabel: plain.shiftLabel,
    boss: null,
    star2: Math.round(evolved.star2 * lift),
    star3: Math.round(evolved.star3 * lift),
    evolved: { generations, target: Math.round(options.target * 100) / 100, note: formLabel(offset) },
  };
}

/** Runs the whole evolve pass now. Used by scripts and tests; the game uses the async path. */
export function evolveWardNow(id: number, seed: number, shiftId: ShiftId, offset = 0): LevelDef {
  const plain = generateWard(id, seed, shiftId);
  const options = wardOptions(plain, offset);
  const result = evolve(plain, options);
  return shape(plain, result.best.level, options, options.generations ?? 4, offset);
}

/* ---------- the attempt lock ---------- */

const memory = new Map<string, LevelDef>();
const running = new Map<string, Promise<LevelDef | null>>();

function readStore(): Record<string, LevelDef> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, LevelDef>) : {};
  } catch {
    return {};
  }
}

function writeStore(key: string, level: LevelDef) {
  if (typeof window === "undefined") return;
  try {
    const store = readStore();
    store[key] = level;
    const keys = Object.keys(store);
    for (const old of keys.slice(0, Math.max(0, keys.length - KEEP))) delete store[old];
    window.localStorage.setItem(STORE, JSON.stringify(store));
  } catch {
    /* storage full or blocked: the lock still holds for this session */
  }
}

function looksValid(level: unknown, id: number): level is LevelDef {
  if (!level || typeof level !== "object") return false;
  const item = level as LevelDef;
  return item.id === id && Number.isFinite(item.rows) && Number.isFinite(item.cols) && Number.isFinite(item.moves) && Array.isArray(item.kinds) && item.kinds.length >= 3 && Array.isArray(item.goals) && item.goals.length > 0;
}

/** The ward already locked to this attempt, if any. */
export function lockedWard(id: number, seed: number, shiftId: ShiftId): LevelDef | null {
  const key = keyOf(id, seed, shiftId);
  const hit = memory.get(key) ?? readStore()[key];
  if (!looksValid(hit, id)) return null;
  memory.set(key, hit);
  return structuredClone(hit);
}

function lock(key: string, level: LevelDef) {
  memory.set(key, level);
  writeStore(key, level);
}

/**
 * The ward to play for this attempt. Locks it on first call so every retry gets the same board.
 */
export function wardForAttempt(id: number, seed: number, shiftId: ShiftId): LevelDef {
  const locked = lockedWard(id, seed, shiftId);
  if (locked) return locked;
  const plain = generateWard(id, seed, shiftId);
  lock(keyOf(id, seed, shiftId), plain);
  return plain;
}

/**
 * Starts evolving a ward in the background. Resolves with the evolved ward, or null when the
 * attempt was locked to something else first (the player started before it finished).
 */
export function evolveWardAhead(id: number, seed: number, shiftId: ShiftId, offset: number): Promise<LevelDef | null> {
  const key = keyOf(id, seed, shiftId);
  const locked = lockedWard(id, seed, shiftId);
  if (locked) return Promise.resolve(locked.evolved ? locked : null);
  const busy = running.get(key);
  if (busy) return busy;
  const plain = generateWard(id, seed, shiftId);
  if (!isRolledWard(plain)) return Promise.resolve(null);
  const options = wardOptions(plain, offset);
  const job = evolveAsync(plain, options)
    .then((result) => {
      if (!result) return null;
      if (lockedWard(id, seed, shiftId)) return null;
      const level = shape(plain, result.best.level, options, options.generations ?? 4, offset);
      lock(key, level);
      return level;
    })
    .catch(() => null)
    .finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

export function isEvolving(id: number, seed: number, shiftId: ShiftId): boolean {
  return running.has(keyOf(id, seed, shiftId));
}
