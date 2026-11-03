/**
 * Free-roam overworld: the walkable island, ward nodes and walker physics.
 *
 * Everything here is pure so it can be tested without a browser. Coordinates are in
 * pixels of the island art (public/map/island.jpg, 1500 x 844), so movement speed is
 * the same in every direction whatever the screen shape.
 */
import { MAP_SPOTS, WARD_IDS, wardsOpen } from "./levels.ts";

export const MAP_W = 1500;
export const MAP_H = 844;

export interface Pt {
  x: number;
  y: number;
}

export type NodeKind = "ward" | "boss" | "side" | "microbe" | "heal";
export type ZoneId = "hospital" | "clinic" | "peds" | "hills" | "harbor" | "park";

export interface WardNode extends Pt {
  id: number;
  kind: NodeKind;
  zone: ZoneId;
  /** Short mark drawn on the pin. */
  mark: string;
}

export const ZONE_NAMES: Record<ZoneId, string> = {
  hospital: "General Hospital",
  clinic: "Care Clinic",
  peds: "Pediatric Clinic",
  hills: "Spore Hills",
  harbor: "Harbor Dock",
  park: "Teddy Park",
};

const pct = (x: number, y: number): Pt => ({ x: (x / 100) * MAP_W, y: (y / 100) * MAP_H });

/** The shoreline and the foot of the mountains, in percent of the art. Clockwise. */
const LAND_PCT: Array<[number, number]> = [
  [0, 15], [100, 15], [100, 27], [96, 33], [97.5, 46], [96, 60], [92, 72], [86, 84],
  [76, 92], [62, 91], [50, 87], [42, 83], [37, 82], [33, 90], [30, 96], [11, 96],
  [9, 88], [10, 72], [7, 64], [3.5, 56], [3, 46], [0, 38],
];

export const LAND: Pt[] = LAND_PCT.map(([x, y]) => pct(x, y));

/** Spots for the side wards 19-25, which only had a button row before the overworld. */
const EXTRA_SPOTS: Array<{ id: number; x: number; y: number }> = [
  { id: 19, x: 62, y: 72 },
  { id: 20, x: 61, y: 27 },
  { id: 21, x: 72, y: 27 },
  { id: 22, x: 81, y: 30 },
  { id: 23, x: 50, y: 69 },
  { id: 24, x: 13, y: 57 },
  { id: 25, x: 86, y: 70 },
];

export function nodeKind(id: number): NodeKind {
  if (id === 5 || id === 10 || id === 15) return "boss";
  if (id >= 26 && id <= 28) return "microbe";
  if (id >= 29) return "heal";
  if (id >= 16) return "side";
  return "ward";
}

function zoneFor(id: number, x: number, y: number): ZoneId {
  if (id >= 26 && id <= 28) return "hills";
  if (id >= 29) return "harbor";
  if (id <= 5) return "hospital";
  if (id <= 10) return "clinic";
  if (id <= 15) return "peds";
  if (y > 62) return "park";
  if (x < 40) return "hospital";
  if (x < 66) return "clinic";
  return x > 76 ? "peds" : "park";
}

function markFor(id: number): string {
  if (id === 16) return "N";
  if (id === 17) return "L";
  if (id === 18) return "O";
  return String(id);
}

export const WARD_NODES: WardNode[] = [...MAP_SPOTS, ...EXTRA_SPOTS]
  .map((spot) => {
    const p = pct(spot.x, spot.y);
    return { id: spot.id, x: p.x, y: p.y, kind: nodeKind(spot.id), zone: zoneFor(spot.id, spot.x, spot.y), mark: markFor(spot.id) };
  })
  .sort((a, b) => a.id - b.id);

export function nodeById(id: number): WardNode | undefined {
  return WARD_NODES.find((node) => node.id === id);
}

/** The main road 1 to 15, then spurs from the road out to each side ward. */
export const MAIN_ROAD = WARD_NODES.filter((node) => node.id <= 15).map((node) => node.id);
export const SPURS: Array<[number, number]> = [
  [1, 16], [5, 17], [10, 18], [16, 26], [26, 27], [27, 28], [2, 29], [29, 30],
  [9, 19], [6, 20], [8, 21], [11, 22], [4, 23], [2, 24], [13, 25],
];

export interface ProgressLike {
  unlocked: number;
  stars: Record<string, number>;
  openedGifts?: number[];
}

export interface NodeState {
  locked: boolean;
  /** Why it is locked, in the game's voice. */
  reason: string | null;
  stars: number;
  cleared: boolean;
  giftWaiting: boolean;
}

/** Same rules the classic map uses, plus the side ward row that sat under it. */
export function nodeState(save: ProgressLike, id: number): NodeState {
  const stars = save.stars[String(id)] ?? 0;
  let locked = false;
  let reason: string | null = null;
  if (id <= 15 && id > save.unlocked) {
    locked = true;
    reason = `Clear ward ${id - 1} to open this one.`;
  } else if ((WARD_IDS as readonly number[]).includes(id) && !wardsOpen(save.stars)) {
    locked = true;
    reason = "Beat Nurse Karen in ward 5 to open the side wards.";
  }
  const cleared = stars >= 1 || (id <= 15 && id < save.unlocked);
  const giftWaiting = !locked && cleared && MAP_SPOTS.some((spot) => spot.id === id) && !(save.openedGifts ?? []).includes(id);
  return { locked, reason, stars, cleared, giftWaiting };
}

/** Ray-cast point in polygon. */
export function insidePoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function onLand(p: Pt): boolean {
  return insidePoly(p, LAND);
}

/** Walker speed in art pixels per second. Crossing the island takes about five seconds. */
export const WALK_SPEED = 300;

/**
 * Move by a velocity for dt seconds. If the full move would step into the sea, try
 * each axis alone so the walker slides along the shore instead of sticking to it.
 */
export function stepWalker(pos: Pt, vx: number, vy: number, dt: number): Pt {
  const dx = vx * dt;
  const dy = vy * dt;
  if (dx === 0 && dy === 0) return pos;
  const full = { x: pos.x + dx, y: pos.y + dy };
  if (onLand(full)) return full;
  const sideways = { x: pos.x + dx, y: pos.y };
  if (dx !== 0 && onLand(sideways)) return sideways;
  const upDown = { x: pos.x, y: pos.y + dy };
  if (dy !== 0 && onLand(upDown)) return upDown;
  return pos;
}

/** Normalise a raw input vector (keys or stick) to a walking velocity. */
export function velocityFrom(ix: number, iy: number, speed = WALK_SPEED): { vx: number; vy: number } {
  const len = Math.hypot(ix, iy);
  if (len < 0.12) return { vx: 0, vy: 0 };
  const k = Math.min(1, len) / len;
  return { vx: ix * k * speed, vy: iy * k * speed };
}

/** Walk straight toward a target. Returns arrived once within a step of it. */
export function stepToward(pos: Pt, target: Pt, dt: number, speed = WALK_SPEED): { pos: Pt; arrived: boolean; blocked: boolean } {
  const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
  const reach = speed * dt;
  if (dist <= Math.max(reach, 2)) {
    return onLand(target) ? { pos: { ...target }, arrived: true, blocked: false } : { pos, arrived: true, blocked: true };
  }
  const vx = ((target.x - pos.x) / dist) * speed;
  const vy = ((target.y - pos.y) / dist) * speed;
  const next = stepWalker(pos, vx, vy, dt);
  const blocked = next.x === pos.x && next.y === pos.y;
  return { pos: next, arrived: blocked, blocked };
}

/** Where to stand when visiting a node: on its spot, a step toward the viewer. The pin lifts over the walker's head. */
export function standFor(node: Pt): Pt {
  const below = { x: node.x, y: node.y + 8 };
  return onLand(below) ? below : { x: node.x, y: node.y };
}

export const NEAR_RADIUS = 52;

export function nearestNode(pos: Pt, radius = NEAR_RADIUS): WardNode | null {
  let best: WardNode | null = null;
  let bestD = radius;
  for (const node of WARD_NODES) {
    const d = Math.hypot(node.x - pos.x, node.y - pos.y);
    if (d <= bestD) {
      best = node;
      bestD = d;
    }
  }
  return best;
}

/** The zone the walker is standing in, from the closest pin of any ward. */
export function zoneAt(pos: Pt): ZoneId {
  if (pos.y > 0.76 * MAP_H && pos.x < 0.4 * MAP_W) return "harbor";
  if (pos.y < 0.27 * MAP_H && pos.x < 0.48 * MAP_W) return "hills";
  let best = WARD_NODES[0]!;
  let bestD = Infinity;
  for (const node of WARD_NODES) {
    const d = Math.hypot(node.x - pos.x, node.y - pos.y);
    if (d < bestD) {
      best = node;
      bestD = d;
    }
  }
  return best.zone;
}

export interface Camera {
  scale: number;
  tx: number;
  ty: number;
}

/**
 * Fit the art to the view, zoom in, centre on the focus and clamp so the edge of the
 * art never shows. The art always covers the view.
 */
export function cameraFor(focus: Pt, viewW: number, viewH: number, zoom = 2.1): Camera {
  const cover = Math.max(viewW / MAP_W, viewH / MAP_H);
  const scale = Math.max(cover, (viewW / MAP_W) * zoom);
  const w = MAP_W * scale;
  const h = MAP_H * scale;
  const tx = Math.min(0, Math.max(viewW - w, viewW / 2 - focus.x * scale));
  const ty = Math.min(0, Math.max(viewH - h, viewH / 2 - focus.y * scale));
  return { scale, tx, ty };
}

export function screenToMap(sx: number, sy: number, cam: Camera): Pt {
  return { x: (sx - cam.tx) / cam.scale, y: (sy - cam.ty) / cam.scale };
}

/** Points along the road for drawing, split into the travelled and untravelled part. */
export function roadSplit(unlocked: number): { walked: Pt[]; ahead: Pt[] } {
  const nodes = MAIN_ROAD.map((id) => nodeById(id)!);
  const cut = Math.max(1, Math.min(nodes.length, unlocked));
  return { walked: nodes.slice(0, cut), ahead: nodes.slice(cut - 1) };
}

const STORE = "sweet-care-overworld-v1";

export interface RoamMemory {
  x: number;
  y: number;
  view: "roam" | "classic";
}

export function readRoam(): RoamMemory | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<RoamMemory> | null;
    if (!raw || typeof raw.x !== "number" || typeof raw.y !== "number") return null;
    return { x: raw.x, y: raw.y, view: raw.view === "classic" ? "classic" : "roam" };
  } catch {
    return null;
  }
}

export function writeRoam(patch: Partial<RoamMemory>) {
  try {
    if (typeof localStorage === "undefined") return;
    const prev = readRoam() ?? { x: -1, y: -1, view: "roam" as const };
    localStorage.setItem(STORE, JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* a full or blocked store only costs the walker's spot */
  }
}

/** Where the walker starts: where they last stood, else by the next ward to play. */
export function spawnPoint(memory: RoamMemory | null, nextId: number): Pt {
  if (memory && onLand(memory)) return { x: memory.x, y: memory.y };
  const node = nodeById(nextId) ?? WARD_NODES[0]!;
  return standFor(node);
}
