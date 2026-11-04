import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POWER_UNLOCK_WARD, POWERS, powersUnlocked } from "./powers.ts";

describe("power ups", () => {
  it("stay locked until ward 5 is cleared", () => {
    assert.equal(POWER_UNLOCK_WARD, 5);
    for (let id = 1; id <= 5; id++) assert.equal(powersUnlocked(id, { id }), false, `ward ${id}`);
    assert.equal(powersUnlocked(5, { id: 5 }), false);
    assert.equal(powersUnlocked(6, { id: 6 }), true);
  });

  it("stay open on replays once unlocked, and in custom test levels", () => {
    assert.equal(powersUnlocked(9, { id: 2 }), true);
    assert.equal(powersUnlocked(1, { id: 90, custom: true }), true);
  });

  it("every power has a shout", () => {
    for (const info of Object.values(POWERS)) assert.match(info.callout, /!/);
    assert.equal(POWERS.stripe.callout, "Power pill!");
  });
});
