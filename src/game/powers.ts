/**
 * Power ups (the dock under the board): who gets them, what they are called in play, and the
 * shouted callout when one lands. The wallet side (prices, bag, free one per ward) is in rewards.ts.
 */

import type { BoosterId } from "./rewards.ts";
import { soundEnabled, sfxVolume } from "./synth.ts";

/** Power ups open once this ward is cleared, so they are in play from ward 6 on. */
export const POWER_UNLOCK_WARD = 5;

export interface PowerInfo {
  /** Name on the dock card. */
  name: string;
  /** What the shout says when it lands. */
  callout: string;
  /** One line for the aim prompt or the dock. */
  hint: string;
  sprite: string;
}

export const POWERS: Record<BoosterId, PowerInfo> = {
  blast: { name: "Code Blast", callout: "Code Blast!", hint: "Tap a candy to clear its row and column", sprite: "/sprites/cross.png" },
  stripe: { name: "Power Pill", callout: "Power pill!", hint: "Tap a candy to turn it into a power piece", sprite: "/sprites/pill.png" },
  aid: { name: "First Aid", callout: "First aid! +5 moves", hint: "Adds 5 moves", sprite: "/sprites/bandage.png" },
};

/**
 * True when the player may use power ups in this ward. They open after ward 5 is cleared
 * (the save has unlocked ward 6). Custom test levels always allow them.
 */
export function powersUnlocked(unlocked: number, level: { id: number; custom?: boolean }): boolean {
  if (level.custom) return true;
  return unlocked > POWER_UNLOCK_WARD || level.id > POWER_UNLOCK_WARD;
}

const SEEN_KEY = "sweet-care-powers-v1";

/** True the first time it is called on this device after power ups unlock. Used for the "unlocked" shout. */
export function firstPowerWard(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false;
    localStorage.setItem(SEEN_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Shouts the callout with the browser's speech voice, pitched up and quick like a game announcer.
 * Quiet when Sound is off or the browser has no speech. Never throws.
 */
export function shout(text: string) {
  if (!soundEnabled()) return;
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
    synth.cancel();
    const line = new SpeechSynthesisUtterance(text.replace(/\+(\d)/, "plus $1"));
    line.rate = 1.15;
    line.pitch = 1.6;
    line.volume = Math.max(0.2, Math.min(1, sfxVolume() * 1.2));
    const voices = synth.getVoices();
    const english = voices.find((voice) => /^en/i.test(voice.lang) && /female|samantha|zira|google us/i.test(voice.name)) ?? voices.find((voice) => /^en/i.test(voice.lang));
    if (english) line.voice = english;
    synth.speak(line);
  } catch {
    /* a callout never blocks a move */
  }
}
