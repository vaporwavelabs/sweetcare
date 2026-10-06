import { defaultCareer, type Career } from "./profile.ts";
import { previewSeed } from "./generator.ts";
import { dayKey, shiftForDate, type ShiftId } from "./shifts.ts";

export interface SaveData {
  version: 1;
  unlocked: number;
  stars: Record<string, number>;
  best: Record<string, number>;
  times: Record<string, number>;
  sound: boolean;
  music: boolean;
  career: Career;
  gifts: string[];
  /** Level ids whose secret gift was opened. */
  openedGifts: number[];
  /** Stable board seed for an open attempt. Cleared on a win. */
  seeds: Record<string, number>;
  /** Shift snapshotted when the attempt started, so midnight does not reshuffle a retry. */
  attemptShifts: Record<string, ShiftId>;
  /** Clears since the last seed roll. Bumps the next seed. */
  clears: Record<string, number>;
}

const KEY = "sweet-care-save-v1";

export function defaultSave(): SaveData {
  return { version: 1, unlocked: 1, stars: {}, best: {}, times: {}, sound: true, music: true, career: defaultCareer(), gifts: [], openedGifts: [], seeds: {}, attemptShifts: {}, clears: {} };
}

export function rememberOpened(opened: number[] | undefined, levelId: number): number[] {
  const next = opened ? [...opened] : [];
  if (!next.includes(levelId)) next.push(levelId);
  return next;
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return defaultSave();
    return {
      version: 1,
      unlocked: clampLevel(parsed.unlocked ?? 1),
      stars: parsed.stars ?? {},
      best: parsed.best ?? {},
      times: parsed.times ?? {},
      sound: parsed.sound !== false,
      music: parsed.music !== false,
      career: {
        ...defaultCareer(),
        ...parsed.career,
        achievements: parsed.career?.achievements ?? [],
        look: parsed.career?.look === "f" ? "f" : "m",
      },
      gifts: Array.isArray(parsed.gifts) ? parsed.gifts.filter((id) => typeof id === "string") : [],
      openedGifts: Array.isArray(parsed.openedGifts)
        ? parsed.openedGifts.filter((id) => typeof id === "number" && id >= 1 && id <= 15)
        : [],
      seeds: numberMap(parsed.seeds),
      attemptShifts: shiftMap(parsed.attemptShifts),
      clears: numberMap(parsed.clears),
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(save));
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw >>> 0;
  }
  return out;
}

function shiftMap(value: unknown): Record<string, ShiftId> {
  if (!value || typeof value !== "object") return {};
  const allowed = new Set(["fully-staffed", "short-staffed", "float-pool", "supply-shortage", "in-service", "night-shift", "spill-risk", "visitor-hour"]);
  const out: Record<string, ShiftId> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && allowed.has(raw)) out[key] = raw as ShiftId;
  }
  return out;
}

/** Opens or resumes an attempt. A retry keeps the seed. A clear releases it. */
export function attemptFor(save: SaveData, levelId: number, now = new Date()) {
  const key = String(levelId);
  const existing = save.seeds[key];
  if (existing) {
    return { save, seed: existing, shiftId: save.attemptShifts[key] ?? shiftForDate(now).id };
  }
  const shift = shiftForDate(now);
  const seed = previewSeed(levelId, dayKey(now), save.clears[key] ?? 0);
  const next: SaveData = {
    ...save,
    seeds: { ...save.seeds, [key]: seed },
    attemptShifts: { ...save.attemptShifts, [key]: shift.id },
  };
  return { save: next, seed, shiftId: shift.id };
}

/** Drop the open seed so the next visit rolls a new ward. */
export function releaseAttempt(save: SaveData, levelId: number): SaveData {
  const key = String(levelId);
  const seeds = { ...save.seeds };
  const attemptShifts = { ...save.attemptShifts };
  delete seeds[key];
  delete attemptShifts[key];
  return {
    ...save,
    seeds,
    attemptShifts,
    clears: { ...save.clears, [key]: (save.clears[key] ?? 0) + 1 },
  };
}

function clampLevel(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(15, Math.floor(n)));
}

export function continueLevel(save: SaveData): number {
  for (let id = 1; id <= save.unlocked; id++) {
    if ((save.stars[String(id)] ?? 0) < 1) return id;
  }
  for (let id = 1; id <= save.unlocked; id++) {
    if ((save.stars[String(id)] ?? 0) < 3) return id;
  }
  return save.unlocked;
}

export function totalStars(save: SaveData): number {
  return Object.values(save.stars).reduce((sum, n) => sum + n, 0);
}

export function recordWin(save: SaveData, levelId: number, stars: number, score: number, timeMs?: number): SaveData {
  const next: SaveData = {
    ...save,
    stars: { ...save.stars },
    best: { ...save.best },
    times: { ...save.times },
  };
  const key = String(levelId);
  next.stars[key] = Math.max(next.stars[key] ?? 0, stars);
  next.best[key] = Math.max(next.best[key] ?? 0, score);
  if (timeMs != null && timeMs > 0 && (next.times[key] == null || timeMs < next.times[key]!)) next.times[key] = timeMs;
  if (levelId >= next.unlocked && levelId < 15) next.unlocked = levelId + 1;
  return next;
}
