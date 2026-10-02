
export type NurseLook = "m" | "f";

export interface Career {
  name: string;
  look: NurseLook;
  rounds: number;
  wins: number;
  destroyed: number;
  rank: number;
  progress: number;
  scrub: string;
  coat: boolean;
  accessory: string;
  achievements: string[];
}

export function defaultCareer(): Career {
  return {
    name: "Alex",
    look: "m",
    rounds: 0,
    wins: 0,
    destroyed: 0,
    rank: 1,
    progress: 0,
    scrub: "blue",
    coat: false,
    accessory: "none",
    achievements: [],
  };
}

const TITLES = ["Intern", "Orderly", "Nurse", "Medic", "Resident", "Doctor", "Attending", "Chief", "Director"];

export function rankTitle(rank: number) {
  if (rank <= 1) return TITLES[0]!;
  return TITLES[Math.min(TITLES.length - 1, rank - 1)]!;
}

/** First promotion is 2 rounds. Then 3, 4, 3, and that cycle repeats. */
export function gapFor(rank: number) {
  if (rank <= 1) return 2;
  const cycle = [3, 4, 3];
  return cycle[(rank - 2) % cycle.length]!;
}

export interface Cosmetic {
  id: string;
  slot: "scrub" | "coat" | "accessory";
  label: string;
  need: number;
  filter: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: "blue", slot: "scrub", label: "Blue scrubs", need: 1, filter: "none" },
  { id: "pink", slot: "scrub", label: "Pink scrubs", need: 2, filter: "hue-rotate(278deg) saturate(1.35)" },
  { id: "mint", slot: "scrub", label: "Mint scrubs", need: 3, filter: "hue-rotate(82deg) saturate(1.15)" },
  { id: "coat", slot: "coat", label: "Lab coat", need: 4, filter: "none" },
  { id: "glasses", slot: "accessory", label: "Glasses", need: 5, filter: "none" },
  { id: "gold", slot: "scrub", label: "Gold scrubs", need: 6, filter: "hue-rotate(168deg) saturate(1.7) brightness(1.12)" },
  { id: "bow", slot: "accessory", label: "Bow tie", need: 7, filter: "none" },
  { id: "cap", slot: "accessory", label: "Surgical cap", need: 8, filter: "none" },
];

export function cosmeticOwned(rank: number, item: Cosmetic) {
  return rank >= item.need;
}

export function scrubFilter(id: string) {
  return COSMETICS.find((item) => item.slot === "scrub" && item.id === id)?.filter ?? "none";
}

export interface Achievement {
  id: string;
  label: string;
  hint: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-clear", label: "First clear", hint: "Finish a ward" },
  { id: "streak", label: "5 streak", hint: "Land a 5 cascade" },
  { id: "perfect", label: "Perfect care", hint: "Earn 3 stars" },
  { id: "swift", label: "Time record", hint: "Set a best time" },
  { id: "century", label: "Century", hint: "Destroy 100 icons" },
  { id: "rounds-10", label: "Dedicated", hint: "Finish 10 rounds" },
  { id: "five-wards", label: "Ward hopper", hint: "Clear 5 levels" },
  { id: "rescue", label: "Rescue", hint: "Clear level 15" },
  { id: "rank-4", label: "On the ward", hint: "Reach Medic" },
];

export interface RoundReport {
  won: boolean;
  score: number;
  prevBest: number;
  stars: number;
  maxCombo: number;
  levelId: number;
  destroyed: number;
  timeRecord: boolean;
  elapsed: number;
}

export function applyRound(careerIn: Career, report: RoundReport, clearedLevels: number): { career: Career; rankedUp: boolean } {
  const career: Career = {
    ...careerIn,
    achievements: [...careerIn.achievements],
  };
  career.rounds += 1;
  if (report.won) career.wins += 1;
  career.destroyed += report.destroyed;
  let steps = 1;
  if (report.prevBest > 0 && report.score >= report.prevBest) steps += 1;
  career.progress += steps;
  let rankedUp = false;
  let guard = 0;
  while (career.progress >= gapFor(career.rank) && guard < 6) {
    career.progress -= gapFor(career.rank);
    career.rank += 1;
    rankedUp = true;
    guard += 1;
  }
  const have = new Set(career.achievements);
  const grant = (id: string, ok: boolean) => {
    if (ok && !have.has(id)) {
      have.add(id);
      career.achievements.push(id);
    }
  };
  grant("first-clear", report.won);
  grant("streak", report.maxCombo >= 5);
  grant("perfect", report.won && report.stars >= 3);
  grant("swift", report.timeRecord);
  grant("century", career.destroyed >= 100);
  grant("rounds-10", career.rounds >= 10);
  grant("five-wards", clearedLevels >= 5);
  grant("rescue", report.won && report.levelId === 15);
  grant("rank-4", career.rank >= 4);
  return { career, rankedUp };
}
