import test from "node:test";
import assert from "node:assert/strict";
import { defaultSave, loadSave, writeSave } from "./save.ts";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  },
};

test("opened gifts from side wards survive a reload", () => {
  writeSave({ ...defaultSave(), openedGifts: [3, 17, 29, 30, 90, 0] });
  assert.deepEqual(loadSave().openedGifts, [3, 17, 29, 30]);
});
