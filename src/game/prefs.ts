export type HapticStrength = "light" | "normal" | "strong";
export type MotionPref = "device" | "reduced";

export interface Prefs {
  /** 0 to 100. */
  sfxVolume: number;
  /** 0 to 100. */
  musicVolume: number;
  hapticStrength: HapticStrength;
  motion: MotionPref;
  shake: boolean;
  /** Seconds before a hint glows. 0 turns hints off. */
  hintDelay: number;
}

export const HINT_DELAYS = [0, 4, 7, 12] as const;

export function defaultPrefs(): Prefs {
  return { sfxVolume: 80, musicVolume: 50, hapticStrength: "normal", motion: "device", shake: true, hintDelay: 7 };
}

export function readPrefs(value: unknown): Prefs {
  const base = defaultPrefs();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Record<keyof Prefs, unknown>>;
  return {
    sfxVolume: volume(raw.sfxVolume, base.sfxVolume),
    musicVolume: volume(raw.musicVolume, base.musicVolume),
    hapticStrength: raw.hapticStrength === "light" || raw.hapticStrength === "strong" ? raw.hapticStrength : "normal",
    motion: raw.motion === "reduced" ? "reduced" : "device",
    shake: raw.shake !== false,
    hintDelay: HINT_DELAYS.includes(raw.hintDelay as (typeof HINT_DELAYS)[number]) ? (raw.hintDelay as number) : base.hintDelay,
  };
}

function volume(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

let motion: MotionPref = "device";

/** Mirrors the motion choice onto the page so CSS can follow it too. */
export function applyMotionPref(next: MotionPref) {
  motion = next;
  if (typeof document === "undefined") return;
  if (next === "reduced") document.documentElement.dataset.motion = "reduced";
  else delete document.documentElement.dataset.motion;
}

/** True when the player or the device asks for less motion. */
export function motionReduced() {
  if (motion === "reduced") return true;
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
