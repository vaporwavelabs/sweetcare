export type BoosterId = "blast" | "stripe" | "aid";

export interface Bag {
  blast: number;
  stripe: number;
  aid: number;
}

export interface Wallet {
  coins: number;
  /** Boosters bought or won. Spent after the free one each ward hands out. */
  bag: Bag;
  /** Days in the current daily-reward run. */
  streak: number;
  lastDaily: string | null;
  lastWinDay: string | null;
  /** Star milestones already opened. */
  chests: number[];
  /** Coins earned over the whole career. */
  earned: number;
}

export interface Reward {
  coins?: number;
  blast?: number;
  stripe?: number;
  aid?: number;
}

export interface PayLine {
  label: string;
  coins: number;
}

export interface Payout {
  lines: PayLine[];
  total: number;
}

export const BAG_CAP = 9;

export const BOOSTER_INFO: Record<BoosterId, { label: string; blurb: string; price: number; sprite: string }> = {
  blast: { label: "Blast", blurb: "Clears a cross on the board.", price: 60, sprite: "/sprites/heart.png" },
  stripe: { label: "Stripe", blurb: "Turns any tile into a striped power.", price: 60, sprite: "/sprites/pill.png" },
  aid: { label: "Aid", blurb: "Adds 5 moves.", price: 90, sprite: "/sprites/bandage.png" },
};

/** One reward per day. Day 7 is the big one, then the run loops. */
export const DAILY: Reward[] = [
  { coins: 20 },
  { blast: 1 },
  { coins: 40 },
  { stripe: 1 },
  { coins: 60 },
  { aid: 1 },
  { coins: 120, blast: 1, stripe: 1 },
];

export interface Chest {
  stars: number;
  reward: Reward;
}

export const CHESTS: Chest[] = [
  { stars: 5, reward: { coins: 50 } },
  { stars: 12, reward: { coins: 80, blast: 1 } },
  { stars: 20, reward: { coins: 100, stripe: 1 } },
  { stars: 30, reward: { coins: 150, aid: 1 } },
  { stars: 45, reward: { coins: 200, blast: 1, stripe: 1 } },
  { stars: 60, reward: { coins: 250, aid: 1, blast: 1 } },
  { stars: 75, reward: { coins: 300, stripe: 2 } },
  { stars: 90, reward: { coins: 500, blast: 2, stripe: 2, aid: 2 } },
];

export function defaultWallet(): Wallet {
  return { coins: 0, bag: { blast: 0, stripe: 0, aid: 0 }, streak: 0, lastDaily: null, lastWinDay: null, chests: [], earned: 0 };
}

export function readWallet(value: unknown): Wallet {
  const base = defaultWallet();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Record<keyof Wallet, unknown>>;
  const bag = (raw.bag && typeof raw.bag === "object" ? raw.bag : {}) as Partial<Record<BoosterId, unknown>>;
  const milestones = new Set(CHESTS.map((chest) => chest.stars));
  return {
    coins: count(raw.coins, 999999),
    bag: { blast: count(bag.blast, BAG_CAP), stripe: count(bag.stripe, BAG_CAP), aid: count(bag.aid, BAG_CAP) },
    streak: count(raw.streak, 9999),
    lastDaily: dayText(raw.lastDaily),
    lastWinDay: dayText(raw.lastWinDay),
    chests: Array.isArray(raw.chests) ? raw.chests.filter((n): n is number => typeof n === "number" && milestones.has(n)) : [],
    earned: count(raw.earned, 99999999),
  };
}

function count(value: unknown, cap: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(cap, Math.floor(value)));
}

function dayText(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Whole days from one day key to another. */
export function daysBetween(from: string, to: string) {
  const parse = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((parse(to) - parse(from)) / 86400000);
}

export function grant(wallet: Wallet, reward: Reward): Wallet {
  const coins = reward.coins ?? 0;
  return {
    ...wallet,
    coins: wallet.coins + coins,
    earned: wallet.earned + coins,
    bag: {
      blast: Math.min(BAG_CAP, wallet.bag.blast + (reward.blast ?? 0)),
      stripe: Math.min(BAG_CAP, wallet.bag.stripe + (reward.stripe ?? 0)),
      aid: Math.min(BAG_CAP, wallet.bag.aid + (reward.aid ?? 0)),
    },
  };
}

/** The streak day today's claim lands on, 1 to 7, or null once claimed. */
export function dailyDay(wallet: Wallet, today: string): number | null {
  if (wallet.lastDaily === today) return null;
  const kept = wallet.lastDaily != null && daysBetween(wallet.lastDaily, today) === 1;
  const streak = kept ? wallet.streak + 1 : 1;
  return ((streak - 1) % DAILY.length) + 1;
}

/** Where the calendar sits for display: the day to claim, or the day just claimed. */
export function dailyCursor(wallet: Wallet, today: string) {
  const day = dailyDay(wallet, today);
  if (day != null) return { day, claimed: false };
  return { day: ((Math.max(1, wallet.streak) - 1) % DAILY.length) + 1, claimed: true };
}

export function claimDaily(wallet: Wallet, today: string): { wallet: Wallet; reward: Reward; day: number } | null {
  const day = dailyDay(wallet, today);
  if (day == null) return null;
  const kept = wallet.lastDaily != null && daysBetween(wallet.lastDaily, today) === 1;
  const reward = DAILY[day - 1]!;
  const next = grant({ ...wallet, streak: kept ? wallet.streak + 1 : 1, lastDaily: today }, reward);
  return { wallet: next, reward, day };
}

export function openChests(wallet: Wallet, stars: number): Chest[] {
  return CHESTS.filter((chest) => stars >= chest.stars && !wallet.chests.includes(chest.stars));
}

export function claimChest(wallet: Wallet, stars: number, milestone: number): Wallet | null {
  const chest = openChests(wallet, stars).find((item) => item.stars === milestone);
  if (!chest) return null;
  return grant({ ...wallet, chests: [...wallet.chests, chest.stars] }, chest.reward);
}

/** How many rewards wait to be claimed: today's package plus open chests. */
export function rewardsWaiting(wallet: Wallet, stars: number, today: string) {
  return (dailyDay(wallet, today) != null ? 1 : 0) + openChests(wallet, stars).length;
}

export function buy(wallet: Wallet, id: BoosterId): Wallet | null {
  const price = BOOSTER_INFO[id].price;
  if (wallet.coins < price || wallet.bag[id] >= BAG_CAP) return null;
  return { ...wallet, coins: wallet.coins - price, bag: { ...wallet.bag, [id]: wallet.bag[id] + 1 } };
}

export function spendFromBag(wallet: Wallet, id: BoosterId): Wallet {
  if (wallet.bag[id] <= 0) return wallet;
  return { ...wallet, bag: { ...wallet.bag, [id]: wallet.bag[id] - 1 } };
}

export interface WinInput {
  levelId: number;
  stars: number;
  prevStars: number;
  movesLeft: number;
  boss: boolean;
  today: string;
}

export function winPayout(wallet: Wallet, input: WinInput): Payout {
  const lines: PayLine[] = [{ label: "Shift pay", coins: 20 + input.stars * 10 }];
  if (input.prevStars === 0) lines.push({ label: "First clear", coins: 50 });
  else if (input.stars > input.prevStars) lines.push({ label: "New stars", coins: (input.stars - input.prevStars) * 15 });
  const spare = Math.min(30, input.movesLeft * 2);
  if (spare > 0) lines.push({ label: "Spare moves", coins: spare });
  if (input.boss) lines.push({ label: "Boss bounty", coins: 40 });
  if (wallet.lastWinDay !== input.today) lines.push({ label: "First win today", coins: 25 });
  return { lines, total: lines.reduce((sum, line) => sum + line.coins, 0) };
}

export function lossPayout(): Payout {
  const lines = [{ label: "Overtime", coins: 5 }];
  return { lines, total: 5 };
}

export function payWin(wallet: Wallet, payout: Payout, today: string): Wallet {
  return { ...grant(wallet, { coins: payout.total }), lastWinDay: today };
}

export function rewardText(reward: Reward): string {
  const parts: string[] = [];
  if (reward.coins) parts.push(`${reward.coins} coins`);
  for (const id of ["blast", "stripe", "aid"] as const) {
    const n = reward[id];
    if (n) parts.push(`${n} ${BOOSTER_INFO[id].label}`);
  }
  return parts.join(" + ");
}
