import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDINGS,
  MAIN_ROAD,
  SPURS,
  buildingAt,
  clearLine,
  findPath,
  walkable,
  MAP_H,
  MAP_W,
  WARD_NODES,
  cameraFor,
  nearestNode,
  nodeById,
  nodeState,
  onLand,
  roadSplit,
  screenToMap,
  spawnPoint,
  standFor,
  stepToward,
  stepWalker,
  velocityFrom,
} from "./overworld.ts";

describe("ward nodes", () => {
  it("puts every ward 1 to 30 on land, once", () => {
    const ids = WARD_NODES.map((node) => node.id);
    assert.deepEqual(ids, Array.from({ length: 30 }, (_, i) => i + 1));
    for (const node of WARD_NODES) assert.ok(onLand(node), `ward ${node.id} is in the sea`);
  });

  it("keeps pins far enough apart to tell them apart", () => {
    for (const a of WARD_NODES) {
      for (const b of WARD_NODES) {
        if (a.id >= b.id) continue;
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 50, `wards ${a.id} and ${b.id} overlap`);
      }
    }
  });

  it("gives every pin a standing spot that resolves back to it", () => {
    for (const node of WARD_NODES) assert.equal(nearestNode(standFor(node))?.id, node.id);
  });

  it("marks the boss wards", () => {
    assert.deepEqual(WARD_NODES.filter((node) => node.kind === "boss").map((node) => node.id), [5, 10, 15]);
  });
});

describe("nodeState", () => {
  const fresh = { unlocked: 1, stars: {} as Record<string, number> };

  it("opens only the first ward on a new save", () => {
    assert.equal(nodeState(fresh, 1).locked, false);
    assert.equal(nodeState(fresh, 2).locked, true);
    assert.match(nodeState(fresh, 2).reason ?? "", /ward 1/);
  });

  it("holds the side wards until Karen falls", () => {
    assert.equal(nodeState(fresh, 19).locked, true);
    assert.equal(nodeState({ unlocked: 6, stars: { "5": 1 } }, 19).locked, false);
  });

  it("keeps bonus stages open like the classic map", () => {
    assert.equal(nodeState(fresh, 26).locked, false);
    assert.equal(nodeState(fresh, 30).locked, false);
  });

  it("flags a waiting gift until it is opened", () => {
    const save = { unlocked: 3, stars: { "1": 2 }, openedGifts: [] as number[] };
    assert.equal(nodeState(save, 1).giftWaiting, true);
    assert.equal(nodeState({ ...save, openedGifts: [1] }, 1).giftWaiting, false);
  });
});

describe("walking", () => {
  it("never leaves the island however long it walks into the sea", () => {
    let pos = standFor(nodeById(29)!);
    for (let i = 0; i < 400; i++) pos = stepWalker(pos, -300, 300, 1 / 60);
    assert.ok(onLand(pos));
  });

  it("slides along the shore instead of sticking", () => {
    // Walk down and left from ward 24 toward the west beach: the walker should keep moving down.
    const start = standFor(nodeById(24)!);
    let pos = start;
    for (let i = 0; i < 240; i++) pos = stepWalker(pos, -300, 120, 1 / 60);
    assert.ok(pos.y > start.y + 10);
  });

  it("caps diagonal speed at walking speed", () => {
    const { vx, vy } = velocityFrom(1, 1, 300);
    assert.ok(Math.abs(Math.hypot(vx, vy) - 300) < 1e-6);
    assert.deepEqual(velocityFrom(0.05, 0, 300), { vx: 0, vy: 0 });
  });

  it("arrives at a ward it walks to", () => {
    let pos = standFor(nodeById(1)!);
    const target = standFor(nodeById(3)!);
    let arrived = false;
    for (let i = 0; i < 600 && !arrived; i++) ({ pos, arrived } = stepToward(pos, target, 1 / 60));
    assert.ok(arrived);
    assert.equal(nearestNode(pos)?.id, 3);
  });
});

describe("camera", () => {
  it("always covers a phone screen with art", () => {
    for (const node of WARD_NODES) {
      const cam = cameraFor(node, 390, 600);
      assert.ok(cam.tx <= 0 && cam.ty <= 0);
      assert.ok(cam.tx + MAP_W * cam.scale >= 390 - 1e-6);
      assert.ok(cam.ty + MAP_H * cam.scale >= 600 - 1e-6);
    }
  });

  it("maps a screen tap back to the art", () => {
    const cam = cameraFor({ x: 700, y: 400 }, 390, 600);
    const p = screenToMap(195, 300, cam);
    assert.ok(Math.abs(p.x * cam.scale + cam.tx - 195) < 1e-6);
  });
});

describe("road and spawn", () => {
  it("lights the road up to the open ward", () => {
    const { walked, ahead } = roadSplit(4);
    assert.deepEqual(walked[walked.length - 1], standFor(nodeById(4)!));
    assert.deepEqual(ahead[0], standFor(nodeById(4)!));
    assert.deepEqual(ahead[ahead.length - 1], standFor(nodeById(15)!));
  });

  it("spawns beside the next ward when nothing is remembered, or the spot is in the sea", () => {
    assert.equal(nearestNode(spawnPoint(null, 7))?.id, 7);
    assert.equal(nearestNode(spawnPoint({ x: 5, y: 830, view: "roam" }, 2))?.id, 2);
  });
});

describe("buildings", () => {
  it("gives every site a solid footprint", () => {
    for (const building of BUILDINGS) {
      const cx = building.poly.reduce((sum, p) => sum + p.x, 0) / building.poly.length;
      const cy = building.poly.reduce((sum, p) => sum + p.y, 0) / building.poly.length;
      assert.equal(buildingAt({ x: cx, y: cy })?.id, building.id);
      assert.equal(walkable({ x: cx, y: cy }), false);
    }
  });

  it("stops the walker at the hospital wall and lets it slide along", () => {
    // From the doorstep of ward 1, push straight up into the hospital.
    const start = standFor(nodeById(1)!);
    let pos = start;
    for (let i = 0; i < 300; i++) pos = stepWalker(pos, 0, -300, 1 / 60);
    assert.ok(walkable(pos));
    assert.ok(pos.y > start.y - 40, "walked into the hospital");
    // Push up and right: it should slide along the front wall to the right.
    let slid = pos;
    for (let i = 0; i < 120; i++) slid = stepWalker(slid, 300, -300, 1 / 60);
    assert.ok(slid.x > pos.x + 20);
  });

  it("puts every doorstep outside the buildings", () => {
    for (const node of WARD_NODES) assert.ok(walkable(standFor(node)), `ward ${node.id} doorstep is inside a wall`);
  });
});

describe("doorsteps", () => {
  it("keeps doorsteps far enough apart that each one picks its own ward", () => {
    for (const a of WARD_NODES) {
      for (const b of WARD_NODES) {
        if (a.id >= b.id) continue;
        const da = standFor(a);
        const db = standFor(b);
        assert.ok(Math.hypot(da.x - db.x, da.y - db.y) > 44, `doorsteps ${a.id} and ${b.id} overlap`);
      }
    }
  });
});

describe("paths", () => {
  const segmentsClear = (path: { x: number; y: number }[], from: { x: number; y: number }) => {
    let prev = from;
    for (const p of path) {
      assert.ok(clearLine(prev, p), "path cuts through a wall");
      prev = p;
    }
  };

  it("connects every ward to every other one without crossing a building", () => {
    const home = standFor(nodeById(1)!);
    for (const node of WARD_NODES) {
      const path = findPath(home, standFor(node));
      assert.ok(path.length > 0, `no way to ward ${node.id}`);
      const end = path[path.length - 1]!;
      assert.ok(Math.hypot(end.x - standFor(node).x, end.y - standFor(node).y) < 12, `stops short of ward ${node.id}`);
      segmentsClear(path, home);
    }
  });

  it("walks round the clinic rather than through it", () => {
    const a = standFor(nodeById(17)!);
    const b = standFor(nodeById(7)!);
    assert.equal(clearLine(a, b), false);
    const path = findPath(a, b);
    assert.ok(path.length >= 2);
    segmentsClear(path, a);
  });

  it("draws every road leg along open ground", () => {
    for (let i = 1; i < MAIN_ROAD.length; i++) assert.ok(findPath(standFor(nodeById(MAIN_ROAD[i - 1]!)!), standFor(nodeById(MAIN_ROAD[i]!)!)).length);
    for (const [a, b] of SPURS) assert.ok(findPath(standFor(nodeById(a)!), standFor(nodeById(b)!)).length, `spur ${a}-${b}`);
  });

  it("follows a path to the door in a walk", () => {
    let pos = standFor(nodeById(24)!);
    const path = findPath(pos, standFor(nodeById(12)!));
    for (let i = 0; i < 2000 && path.length; i++) {
      const step = stepToward(pos, path[0]!, 1 / 60);
      pos = step.pos;
      assert.ok(walkable(pos));
      if (step.arrived) path.shift();
    }
    assert.equal(path.length, 0);
    assert.equal(nearestNode(pos)?.id, 12);
  });
});
