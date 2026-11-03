import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BAG_CAP,
  CHESTS,
  DAILY,
  buy,
  claimChest,
  claimDaily,
  dailyDay,
  defaultWallet,
  lossPayout,
  openChests,
  payWin,
  readWallet,
  rewardsWaiting,
  spendFromBag,
  winPayout,
} from "./rewards.ts";

const win = { levelId: 3, stars: 2, prevStars: 0, movesLeft: 6, boss: false, today: "2026-10-26" };

describe("win payout", () => {
  it("pays stars, a first clear, spare moves and the first win of the day", () => {
    const payout = winPayout(defaultWallet(), win);
    assert.deepEqual(payout.lines.map((line) => line.label), ["Shift pay", "First clear", "Spare moves", "First win today"]);
    assert.equal(payout.total, 40 + 50 + 12 + 25);
  });

  it("pays only new stars on a replay, and the daily bonus once", () => {
    const paid = payWin(defaultWallet(), winPayout(defaultWallet(), win), win.today);
    const replay = winPayout(paid, { ...win, stars: 3, prevStars: 2, movesLeft: 0 });
    assert.deepEqual(replay.lines.map((line) => line.label), ["Shift pay", "New stars"]);
    assert.equal(replay.total, 50 + 15);
  });

  it("adds a boss bounty and caps spare moves", () => {
    const payout = winPayout(defaultWallet(), { ...win, boss: true, movesLeft: 40, prevStars: 3, stars: 1 });
    assert.equal(payout.lines.find((line) => line.label === "Spare moves")?.coins, 30);
    assert.equal(payout.lines.find((line) => line.label === "Boss bounty")?.coins, 40);
  });

  it("still pays a little on a loss", () => {
    assert.equal(lossPayout().total, 5);
  });
});

describe("daily package", () => {
  it("claims once a day and walks the 7 day run", () => {
    let wallet = defaultWallet();
    const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"];
    const got: number[] = [];
    for (const day of days) {
      const result = claimDaily(wallet, day);
      assert.ok(result);
      got.push(result.day);
      wallet = result.wallet;
      assert.equal(claimDaily(wallet, day), null);
    }
    assert.deepEqual(got, [1, 2, 3, 4, 5, 6, 7, 1]);
    assert.ok(wallet.bag.blast >= 2);
  });

  it("starts the run over after a missed day", () => {
    let wallet = claimDaily(defaultWallet(), "2026-10-26")!.wallet;
    wallet = claimDaily(wallet, "2026-10-27")!.wallet;
    assert.equal(dailyDay(wallet, "2026-10-29"), 1);
  });

  it("pays the listed reward", () => {
    const result = claimDaily(defaultWallet(), "2026-10-26")!;
    assert.equal(result.wallet.coins, DAILY[0]!.coins);
  });
});

describe("star chests", () => {
  it("opens each milestone once", () => {
    const wallet = defaultWallet();
    assert.equal(openChests(wallet, 4).length, 0);
    assert.equal(openChests(wallet, 12).length, 2);
    const opened = claimChest(wallet, 12, 5)!;
    assert.equal(opened.coins, CHESTS[0]!.reward.coins);
    assert.equal(claimChest(opened, 12, 5), null);
    assert.equal(claimChest(opened, 12, 20), null);
    assert.equal(rewardsWaiting(opened, 12, "2026-10-26"), 2);
  });
});

describe("supply shop", () => {
  it("spends coins and fills the bag up to the cap", () => {
    let wallet = { ...defaultWallet(), coins: 2000 };
    for (let i = 0; i < BAG_CAP; i++) wallet = buy(wallet, "blast")!;
    assert.equal(wallet.bag.blast, BAG_CAP);
    assert.equal(buy(wallet, "blast"), null);
    assert.equal(buy({ ...defaultWallet(), coins: 10 }, "aid"), null);
    assert.equal(spendFromBag(wallet, "blast").bag.blast, BAG_CAP - 1);
    assert.equal(spendFromBag(defaultWallet(), "aid").bag.aid, 0);
  });
});

describe("wallet load", () => {
  it("drops junk and clamps counts", () => {
    const wallet = readWallet({ coins: -5, bag: { blast: 99, stripe: "x" }, chests: [5, 7, "12"], lastDaily: "yesterday", streak: 3.7 });
    assert.equal(wallet.coins, 0);
    assert.equal(wallet.bag.blast, BAG_CAP);
    assert.equal(wallet.bag.stripe, 0);
    assert.deepEqual(wallet.chests, [5]);
    assert.equal(wallet.lastDaily, null);
    assert.equal(wallet.streak, 3);
    assert.deepEqual(readWallet(null), defaultWallet());
  });
});
