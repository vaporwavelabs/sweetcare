export type Cue = "tap" | "swap" | "bad" | "match" | "special" | "power" | "boss-hit" | "hurt" | "win" | "lose";

let enabled = true;
let lastAt = 0;
const cueAt = new Map<Cue, number>();

/** Cues that always land, even inside the shared gap. */
const PRIORITY = new Set<Cue>(["bad", "power", "hurt", "win", "lose"]);

/** Shortest gap between any two pulses, and between repeats of one cue. */
const SHARED_GAP = 45;
const REPEAT_GAP: Partial<Record<Cue, number>> = { "boss-hit": 90, hurt: 450, match: 70 };

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function setHapticsPref(on: boolean) {
  enabled = on;
  if (!on && hapticsSupported()) navigator.vibrate(0);
}

/** Vibration pattern in ms (on, off, on, ...). A deeper chain hits harder and longer. */
export function patternFor(cue: Cue, combo = 1): number[] {
  const depth = Math.max(1, Math.min(8, Math.floor(combo)));
  switch (cue) {
    case "tap":
      return [6];
    case "swap":
      return [10];
    case "bad":
      return [22, 40, 22];
    case "match":
      if (depth >= 5) return [18 + depth * 3, 30, 14 + depth * 2];
      return [12 + depth * 4];
    case "special":
      return [16, 26, 28];
    case "power":
      return [34, 28, 52];
    case "boss-hit":
      return [14];
    case "hurt":
      return [55];
    case "win":
      return [30, 60, 30, 60, 90];
    case "lose":
      return [110, 70, 60];
  }
}

/** True when a cue may fire now. Updates the clocks when it does. */
export function admit(cue: Cue, now: number): boolean {
  const repeat = REPEAT_GAP[cue] ?? 0;
  const prevCue = cueAt.get(cue) ?? -Infinity;
  if (now - prevCue < repeat) return false;
  if (!PRIORITY.has(cue) && now - lastAt < SHARED_GAP) return false;
  lastAt = now;
  cueAt.set(cue, now);
  return true;
}

export function resetHapticClock() {
  lastAt = 0;
  cueAt.clear();
}

export function haptic(cue: Cue, combo = 1) {
  if (!enabled || !hapticsSupported()) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!admit(cue, now)) return;
  try {
    navigator.vibrate(patternFor(cue, combo));
  } catch {
    /* a blocked vibrate never blocks a move */
  }
}
