/**
 * Story scenes: short, skippable, tap-through cutscenes before and after key wards.
 * Plain data, so writing a new scene is adding an entry here. `Cutscene.tsx` plays them.
 *
 * Seen scenes live in their own storage key, so they never touch the campaign save.
 */

import type { MusicScene } from "./music.ts";
import type { SfxName } from "./sfx.ts";

export type ActorId = "you" | "teddy" | "karen" | "germ";
export type Pose = "enter" | "bounce" | "shake" | "dizzy" | "stomp" | "exit" | "glow";
export type SceneFx = "alarm" | "flash" | "sparkle" | "paper" | "flood" | "hearts" | "spores" | "stamp" | "caps" | "confetti";
/** Illustrated backdrops drawn in CSS (src/prologue.css) instead of a photo. */
export type SetId = "campus" | "study" | "exam" | "exam-off" | "result" | "letter" | "ferry" | "island";

export interface Beat {
  /** Who is talking. Leave out for a narrator caption. */
  speaker?: ActorId;
  /** {name} becomes the player's name. */
  line?: string;
  /** Who stands on the left and right from this beat on. null clears the spot. */
  left?: ActorId | null;
  right?: ActorId | null;
  pose?: Partial<Record<ActorId, Pose>>;
  fx?: SceneFx;
  sfx?: SfxName;
  /** A big title card instead of a speech bubble. */
  card?: { kicker: string; title: string; tone: "story" | "boss" | "microbe" | "heal" | "win" };
  /** Swap the backdrop from this beat on. */
  bg?: string;
  /** Swap to an illustrated set from this beat on. null goes back to the photo backdrop. */
  set?: SetId | null;
  /** Text on the stamp effect. Defaults to APPROVED. */
  stamp?: string;
  /** Change the music from this beat on. */
  music?: MusicScene;
}

export interface Scene {
  id: SceneId;
  title: string;
  bg: string;
  music: MusicScene;
  beats: Beat[];
  /** Illustrated set the scene opens on. */
  set?: SetId;
}

export const ACTOR_NAMES: Record<ActorId, string> = { you: "You", teddy: "Chief Teddy", karen: "Nurse Karen", germ: "Mother Cell" };

export const SCENE_IDS = ["prologue", "intro", "boss-5-in", "boss-5-out", "boss-10-in", "boss-10-out", "boss-15-in", "boss-15-out", "swarm-26-in", "heal-29-in"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const SCENES: Record<SceneId, Scene> = {
  prologue: {
    id: "prologue",
    title: "Prologue: becoming a nurse",
    bg: "/map/island.jpg",
    set: "campus",
    music: "cutscene",
    beats: [
      { card: { kicker: "Prologue", title: "Graduation day", tone: "story" }, fx: "sparkle", sfx: "cut.sparkle" },
      { line: "Four years of care plans, clinicals and 5 a.m. alarms. All of it, for one walk across this stage." },
      { left: "you", pose: { you: "enter" }, speaker: "you", line: "They just called my name. {name}, Bachelor of Science in Nursing!", sfx: "cut.whoosh" },
      { pose: { you: "bounce" }, fx: "caps", sfx: "cut.sparkle", speaker: "you", line: "I DID IT! Caps in the air, everybody!" },
      { pose: { you: "shake" }, fx: "alarm", sfx: "cut.thud", line: "But one last test still stands between a graduate and a nurse..." },
      { set: "study", card: { kicker: "Six weeks later", title: "The NCLEX", tone: "boss" }, sfx: "cut.alarm", music: "microbe" },
      { fx: "paper", sfx: "cut.blip", speaker: "you", line: "Priorities. Delegation. Lab values. I'm answering select-all-that-apply in my sleep." },
      { pose: { you: "dizzy" }, speaker: "you", line: "One more practice set. And maybe one more coffee." },
      { set: "exam", music: "boss", sfx: "cut.door", line: "Exam day. Question after question after question..." },
      { set: "exam-off", fx: "flash", sfx: "cut.gasp", line: "Then, without warning, the screen goes dark." },
      { pose: { you: "shake" }, sfx: "cut.thud", speaker: "you", line: "Wait. Did it shut off because I passed... or because I failed?!" },
      { set: "result", music: "heal", fx: "stamp", stamp: "PASSED", sfx: "cut.stamp", line: "The results are in." },
      { pose: { you: "glow" }, fx: "confetti", sfx: "reward.levelup", speaker: "you", line: "{name}, RN. I'm a real nurse!" },
      { set: "letter", right: "teddy", pose: { teddy: "enter" }, sfx: "cut.door", speaker: "teddy", line: "Congratulations, {name}! Chief Teddy here, from Sweet Care Island Hospital." },
      { pose: { teddy: "bounce" }, fx: "hearts", sfx: "cut.sparkle", speaker: "teddy", line: "Our little patients need a nurse with a big heart. Your ferry leaves at dawn!" },
      { set: "ferry", left: null, right: null, pose: { you: "exit", teddy: "exit" }, music: "title", sfx: "cut.whoosh", line: "Across the candy sea, past the lighthouse, an island is waiting..." },
      { set: "island", music: "map", card: { kicker: "Welcome to", title: "Sweet Care Island", tone: "heal" }, fx: "sparkle", sfx: "map.unlock" },
      { line: "Wards, clinics and labs, all full of patients. Walk to Ward 1 to start your first shift." },
    ],
  },
  intro: {
    id: "intro",
    title: "Night shift begins",
    bg: "/scenes/01.jpg",
    music: "cutscene",
    beats: [
      { card: { kicker: "Sweet Care", title: "Your first shift", tone: "story" }, fx: "sparkle", sfx: "cut.sparkle" },
      { right: "teddy", pose: { teddy: "enter" }, speaker: "teddy", line: "You made it, {name}! Chief Teddy, at your service. Welcome to Sweet Care.", sfx: "cut.door" },
      { speaker: "teddy", line: "Our little patients get better with candy medicine. Swap neighbours to line up three of a kind." },
      { left: "you", pose: { you: "enter" }, speaker: "you", line: "Three in a row. Got it!", sfx: "cut.whoosh" },
      { speaker: "teddy", pose: { teddy: "bounce" }, line: "Chain your matches. Big cascades wake up perks: extra moves, defib zaps, even miracles.", fx: "hearts", sfx: "perk.ready" },
      { speaker: "teddy", pose: { teddy: "shake" }, line: "And whatever you do... don't let Nurse Karen catch you with the candy cart.", fx: "alarm", sfx: "cut.alarm" },
      { right: null, pose: { teddy: "exit" }, speaker: "you", line: "Who's Karen? ...Teddy?", sfx: "cut.whoosh" },
    ],
  },
  "boss-5-in": {
    id: "boss-5-in",
    title: "Code Blue",
    bg: "/scenes/boss.jpg",
    music: "boss",
    beats: [
      { card: { kicker: "Ward 5", title: "Code Blue", tone: "boss" }, fx: "alarm", sfx: "cut.alarm" },
      { left: "you", right: "karen", pose: { karen: "stomp" }, speaker: "karen", line: "Candy? In MY ward? Absolutely not.", sfx: "cut.thud" },
      { speaker: "you", line: "It's medicine, Karen. The kids love it." },
      { speaker: "karen", pose: { karen: "shake" }, line: "Rules are rules. And I just called a Code Blue.", fx: "flash", sfx: "cut.gasp" },
      { line: "Hearts hit twice as hard while the clock runs. Big combos break her windups." },
    ],
  },
  "boss-5-out": {
    id: "boss-5-out",
    title: "Karen retreats",
    bg: "/scenes/boss.jpg",
    music: "cutscene",
    beats: [
      { left: "you", right: "karen", pose: { karen: "dizzy" }, speaker: "karen", line: "This... isn't over. I'm filing a report.", sfx: "cut.thud" },
      { speaker: "you", pose: { you: "bounce" }, line: "File it under 'patients are smiling'.", fx: "hearts", sfx: "cut.sparkle" },
      { right: null, pose: { karen: "exit" }, line: "The side wards are open. Pick where to go next on the map.", sfx: "cut.whoosh" },
    ],
  },
  "boss-10-in": {
    id: "boss-10-in",
    title: "The Overflow",
    bg: "/scenes/boss.jpg",
    music: "boss",
    beats: [
      { left: "you", right: "karen", pose: { karen: "stomp" }, speaker: "karen", line: "You mopped up my Code Blue. Let's see you mop THIS.", sfx: "cut.thud" },
      { card: { kicker: "Ward 10", title: "The Overflow", tone: "boss" }, fx: "flood", sfx: "cut.gasp" },
      { line: "The goo rises every move. Clear it to hit her, and don't let it spill over." },
    ],
  },
  "boss-10-out": {
    id: "boss-10-out",
    title: "Soaked",
    bg: "/scenes/boss.jpg",
    music: "cutscene",
    beats: [
      { left: "you", right: "karen", pose: { karen: "shake" }, speaker: "karen", line: "My shoes are soaked. My shoes are SOAKED.", sfx: "cut.gasp" },
      { right: "teddy", pose: { teddy: "enter", karen: "exit" }, speaker: "teddy", line: "Good work, {name}. The pediatric clinic needs you next.", sfx: "cut.door" },
      { speaker: "you", pose: { you: "bounce" }, line: "On my way!", fx: "sparkle", sfx: "cut.sparkle" },
    ],
  },
  "boss-15-in": {
    id: "boss-15-in",
    title: "The Audit",
    bg: "/scenes/boss.jpg",
    music: "boss",
    beats: [
      { card: { kicker: "Ward 15", title: "The Audit", tone: "boss" }, fx: "paper", sfx: "cut.stamp" },
      { left: "you", right: "karen", pose: { karen: "stomp" }, speaker: "karen", line: "Every stripe. Every burst. Every rainbow. I am auditing ALL of it.", sfx: "cut.thud" },
      { speaker: "you", line: "Then I'd better make every power count." },
      { line: "She stamps your power pieces flat. Use them before the stamp lands.", fx: "stamp", sfx: "cut.stamp" },
    ],
  },
  "boss-15-out": {
    id: "boss-15-out",
    title: "Head Nurse",
    bg: "/scenes/boss.jpg",
    music: "cutscene",
    beats: [
      { left: "you", right: "karen", pose: { karen: "dizzy" }, speaker: "karen", line: "...Fine. The kids ARE smiling.", sfx: "cut.thud" },
      { speaker: "karen", pose: { karen: "glow" }, line: "You're not bad at this, {name}.", fx: "hearts", sfx: "cut.sparkle" },
      { right: "teddy", pose: { teddy: "enter", karen: "exit" }, speaker: "teddy", line: "Head Nurse {name}. It has a nice ring to it.", fx: "stamp", sfx: "cut.stamp" },
      { card: { kicker: "Main story complete", title: "Thank you for caring", tone: "win" }, fx: "sparkle", sfx: "reward.levelup" },
      { line: "Side wards, microbe labs and organ rescues are still waiting on the map." },
    ],
  },
  "swarm-26-in": {
    id: "swarm-26-in",
    title: "Something in the culture",
    bg: "/scenes/care.jpg",
    music: "microbe",
    beats: [
      { card: { kicker: "Microbe lab", title: "Spore Drift", tone: "microbe" }, fx: "spores", sfx: "cut.gasp" },
      { right: "germ", pose: { germ: "enter" }, speaker: "germ", line: "Bloop. BLOOP.", sfx: "cut.thud" },
      { left: "you", pose: { you: "enter", germ: "shake" }, speaker: "you", line: "Microbes! Match fast before they reach the ward." },
      { line: "Every match fires medicine at the closest germ. The big one splits." },
    ],
  },
  "heal-29-in": {
    id: "heal-29-in",
    title: "Organ rescue",
    bg: "/scenes/care.jpg",
    music: "heal",
    beats: [
      { card: { kicker: "Organ rescue", title: "Brain Calm", tone: "heal" }, fx: "hearts", sfx: "cut.sparkle" },
      { left: "you", pose: { you: "enter" }, speaker: "you", line: "This one needs a gentle hand." },
      { line: "Match hearts and crosses to heal the patient." },
    ],
  },
};

/** The scene that plays before a level starts, if any. */
export function sceneBefore(levelId: number): SceneId | null {
  if (levelId === 1) return "intro";
  if (levelId === 5) return "boss-5-in";
  if (levelId === 10) return "boss-10-in";
  if (levelId === 15) return "boss-15-in";
  if (levelId === 26) return "swarm-26-in";
  if (levelId === 29) return "heal-29-in";
  return null;
}

/** The scene that plays after a level is won, if any. */
export function sceneAfter(levelId: number): SceneId | null {
  if (levelId === 5) return "boss-5-out";
  if (levelId === 10) return "boss-10-out";
  if (levelId === 15) return "boss-15-out";
  return null;
}

/** Fills in {name}. */
export function lineFor(line: string, name: string) {
  return line.replaceAll("{name}", name || "Nurse");
}

/** The illustrated set showing at a beat, carried forward from earlier beats. */
export function setAt(scene: Scene, index: number): SetId | null {
  let set: SetId | null = scene.set ?? null;
  for (let i = 0; i <= index && i < scene.beats.length; i++) {
    const beat = scene.beats[i]!;
    if (beat.set !== undefined) set = beat.set;
  }
  return set;
}

/** Scenes the player has already watched, in story order, for the replay list in Settings. */
export function seenScenes(): SceneId[] {
  const seen = read();
  return SCENE_IDS.filter((id) => seen.includes(id));
}

/** Who stands where at each beat, carried forward from earlier beats. */
export function stageAt(scene: Scene, index: number): { left: ActorId | null; right: ActorId | null } {
  let left: ActorId | null = null;
  let right: ActorId | null = null;
  for (let i = 0; i <= index && i < scene.beats.length; i++) {
    const beat = scene.beats[i]!;
    if (beat.left !== undefined) left = beat.left;
    if (beat.right !== undefined) right = beat.right;
  }
  return { left, right };
}

const KEY = "sweet-care-scenes-v1";

function read(): SceneId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is SceneId => (SCENE_IDS as readonly string[]).includes(id)) : [];
  } catch {
    return [];
  }
}

export function hasSeen(id: SceneId): boolean {
  return read().includes(id);
}

export function markSeen(id: SceneId) {
  try {
    const seen = read();
    if (!seen.includes(id)) localStorage.setItem(KEY, JSON.stringify([...seen, id]));
  } catch {
    /* private mode: the scene may play again, which is fine */
  }
}

export function resetSeen() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
