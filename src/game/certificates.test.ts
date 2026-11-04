import { test } from "node:test";
import assert from "node:assert/strict";
import { CERTIFICATES, GIFT_LEVELS, cardsEarned, cardsHeld, certStatus, earnCert, hasGift, lockedCerts, missingCert, readCerts, type CertProgress } from "./certificates.ts";
import { CENTER, WARD_NODES, atCenter, fenceAt, findPath, nearestNode, nodeState, setFences, spawnPoint, standFor, walkable } from "./overworld.ts";

test("only some wards end with a gift card", () => {
  assert.ok(GIFT_LEVELS.length > 0 && GIFT_LEVELS.length < 30);
  assert.equal(hasGift(1), true);
  assert.equal(hasGift(4), false);
  assert.equal(hasGift(26), false);
});

test("cards come from opened gifts on gift wards only", () => {
  const save: CertProgress = { openedGifts: [1, 2, 4, 2, 26, 3] };
  assert.equal(cardsEarned(save), 3);
  assert.equal(cardsHeld({ ...save, cardsSpent: 2 }), 1);
});

test("certificates are earned in order and cost cards", () => {
  let save: CertProgress & { unlocked: number } = { unlocked: 6, openedGifts: [1, 2, 3, 5, 23, 24] };
  assert.deepEqual(certStatus(save, "peds"), { kind: "blocked", first: CERTIFICATES[0] });
  assert.equal(certStatus(save, "clinic").kind, "ready");
  assert.equal(earnCert(save, "peds"), save, "can't skip ahead");
  save = earnCert(save, "clinic");
  assert.deepEqual(save.certs, ["clinic"]);
  assert.equal(cardsHeld(save), 3);
  assert.deepEqual(certStatus(save, "peds"), { kind: "short", need: 1 });
  assert.equal(earnCert(save, "clinic"), save, "no double purchase");
});

test("the open island always has enough cards for the next certificate", () => {
  let save: CertProgress = { certs: [], cardsSpent: 0, openedGifts: [] };
  for (const cert of CERTIFICATES) {
    // Every gift ward outside the still-closed districts.
    const open = GIFT_LEVELS.filter((id) => !missingCert(save, id));
    save = { ...save, openedGifts: [...new Set([...(save.openedGifts ?? []), ...open])] };
    assert.equal(certStatus(save, cert.id).kind, "ready", `${cert.id} affordable`);
    save = earnCert(save, cert.id);
  }
  assert.deepEqual(lockedCerts(save), []);
});

test("every gated ward's doorstep is inside its fence, every other doorstep outside", () => {
  setFences(["clinic", "peds", "wound"]);
  try {
    for (const node of WARD_NODES) {
      const cert = CERTIFICATES.find((c) => c.wards.includes(node.id));
      assert.equal(fenceAt(standFor(node)), cert?.id ?? null, `ward ${node.id}`);
    }
    assert.equal(walkable(CENTER.door), true, "certificate center is open from the start");
  } finally {
    setFences([]);
  }
});

test("with every fence up, the open wards and the center are still reachable", () => {
  setFences(["clinic", "peds", "wound"]);
  try {
    const start = standFor(WARD_NODES[0]!);
    const open = WARD_NODES.filter((node) => !CERTIFICATES.some((c) => c.wards.includes(node.id)));
    for (const node of [...open.map((n) => standFor(n)), CENTER.door]) {
      const path = findPath(start, node);
      const end = path[path.length - 1]!;
      assert.ok(Math.hypot(end.x - node.x, end.y - node.y) < 12, `reach ${node.x},${node.y}`);
    }
    // A walk into a fenced ward stops at the fence.
    const inside = findPath(start, standFor(WARD_NODES.find((n) => n.id === 7)!));
    for (const p of inside) assert.equal(fenceAt(p), null);
  } finally {
    setFences([]);
  }
});

test("locked districts lock their wards with a certificate reason", () => {
  const state = nodeState({ unlocked: 7, stars: { "5": 1, "6": 2 }, certs: [] }, 6);
  assert.equal(state.locked, true);
  assert.match(state.reason ?? "", /Clinic certificate/);
  assert.equal(nodeState({ unlocked: 7, stars: { "5": 1, "6": 2 }, certs: ["clinic"] }, 6).locked, false);
  // No gift waiting on a ward without a card.
  assert.equal(nodeState({ unlocked: 6, stars: { "4": 3 }, openedGifts: [] }, 4).giftWaiting, false);
  assert.equal(nodeState({ unlocked: 6, stars: { "3": 3 }, openedGifts: [] }, 3).giftWaiting, true);
});

test("spawn falls back to the center when the next ward is fenced", () => {
  setFences(["clinic"]);
  try {
    const spot = spawnPoint(null, 6);
    assert.equal(atCenter(spot), true);
    assert.equal(nearestNode(CENTER.door), null, "center door doesn't overlap a ward door");
  } finally {
    setFences([]);
  }
});

test("readCerts drops junk", () => {
  assert.deepEqual(readCerts(["clinic", "x", "clinic", 3, "wound"]), ["clinic", "wound"]);
  assert.deepEqual(readCerts(null), []);
});
