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

export interface Building {
  id: string;
  name: string;
  /** Footprint in art pixels: the walker cannot step inside it. */
  poly: Pt[];
}

/** Every site on the island the walker has to walk around, traced from the art in percent. */
const BUILDING_PCT: Array<{ id: string; name: string; pts: Array<[number, number]> }> = [
  { id: "hospital", name: "General Hospital", pts: [[13.5, 37], [18, 31.5], [22, 30], [22.5, 26], [30, 26], [32, 30], [38.5, 31], [38.8, 49], [31.5, 51], [30.5, 57.5], [22, 58], [14, 56.5], [13.3, 45]] },
  { id: "clinic", name: "Care Clinic", pts: [[45.5, 38.5], [50, 33], [55, 29.5], [59.5, 31], [64.3, 36], [64.3, 46], [59, 49], [56, 53.5], [50, 53.5], [45.5, 48]] },
  { id: "teddy", name: "Giant Teddy", pts: [[65, 25], [67.5, 18.5], [74.5, 18.5], [76.5, 25], [76.5, 37], [73.5, 42.5], [67, 42.5], [65, 37]] },
  { id: "peds", name: "Pediatric Clinic", pts: [[74, 45], [78, 39.5], [84, 37.5], [92, 40], [92.5, 50], [88.5, 57.5], [80, 58], [75.5, 53]] },
  { id: "gazebo", name: "Gazebo", pts: [[88.5, 34], [91, 31], [94.5, 33], [94.5, 42.5], [89, 43]] },
  { id: "kiosk", name: "Harbor Kiosk", pts: [[16.5, 70], [23.5, 70], [24, 80.5], [16.5, 80.5]] },
  { id: "slide", name: "Dino Slide", pts: [[57, 62], [61, 60], [65.5, 66], [66, 76], [61.5, 78], [57, 74]] },
  { id: "cabin", name: "Hill Cabin", pts: [[92.5, 26.5], [95.5, 26.5], [95.5, 30.5], [92.5, 30.5]] },
];

export const BUILDINGS: Building[] = BUILDING_PCT.map((b) => ({ id: b.id, name: b.name, poly: b.pts.map(([x, y]) => pct(x, y)) }));

/** Spots for the side wards 19-25, which only had a button row before the overworld. */
const EXTRA_SPOTS: Array<{ id: number; x: number; y: number }> = [
  { id: 19, x: 62, y: 72 },
  { id: 20, x: 61, y: 27 },
  { id: 21, x: 86, y: 22 },
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

/** The building at a point, if the point is inside a footprint. */
export function buildingAt(p: Pt): Building | null {
  for (const building of BUILDINGS) if (insidePoly(p, building.poly)) return building;
  return null;
}

/** Feet can stand here: on the island and outside every building. */
export function walkable(p: Pt): boolean {
  return onLand(p) && !buildingAt(p);
}

/** Walker speed in art pixels per second. Crossing the island takes about five seconds. */
export const WALK_SPEED = 300;

/**
 * Move by a velocity for dt seconds. If the full move would step into the sea or a
 * building, try each axis alone so the walker slides along the wall instead of sticking.
 */
export function stepWalker(pos: Pt, vx: number, vy: number, dt: number): Pt {
  const dx = vx * dt;
  const dy = vy * dt;
  if (dx === 0 && dy === 0) return pos;
  const full = { x: pos.x + dx, y: pos.y + dy };
  if (walkable(full)) return full;
  const sideways = { x: pos.x + dx, y: pos.y };
  if (dx !== 0 && walkable(sideways)) return sideways;
  const upDown = { x: pos.x, y: pos.y + dy };
  if (dy !== 0 && walkable(upDown)) return upDown;
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
    return walkable(target) ? { pos: { ...target }, arrived: true, blocked: false } : { pos, arrived: true, blocked: true };
  }
  const vx = ((target.x - pos.x) / dist) * speed;
  const vy = ((target.y - pos.y) / dist) * speed;
  const next = stepWalker(pos, vx, vy, dt);
  const blocked = next.x === pos.x && next.y === pos.y;
  return { pos: next, arrived: blocked, blocked };
}

/* ---------- Pathfinding: A* over a walkability grid, then string-pulled. ---------- */

/**
 * Cobblestone cells of the art, found by colour (10 px cells, rows split by "|",
 * each run "start+length"), so walks and roads follow the paved paths.
 */
const PAVED_RLE =
  "||||||||||||||17+5 131+3|17+4|||||||||50+1|49+3|50+1|29+3|29+4 47+1|29+6 46+3|29+6 45+4 51+1|30+5 45+8 80+1|31" +
  "+4 45+8 80+2|32+3 45+8 80+1|33+2 45+8 87+1|33+2 50+3 86+3|33+2 51+1 71+1 86+3 99+2|33+2 71+1 87+2 98+4|21+3 99" +
  "+3|23+1 100+3|100+3|61+7|60+8|59+8|59+7|1+2 44+2 59+7 97+2|1+2 43+5 60+7 96+4|2+2 43+7 61+6 96+5|3+2 44+8 61+6" +
  " 96+6|4+2 46+9 61+6 95+8|4+2 48+9 60+6 96+7|4+2 50+15 97+6|3+3 52+13 98+2|3+2 54+12 86+1|58+10 84+4|62+9 83+5 " +
  "111+5|12+1 64+9 82+5 110+8|11+4 65+9 80+6 111+8|11+6 67+17 113+8|11+7 69+13 115+7|11+3 16+1 70+10 116+8|71+8 1" +
  "19+7|72+6 120+7|72+6 121+6|72+6 122+4|72+6 123+2|25+3 72+7|25+3 71+9|26+1 71+9|72+8|73+6|74+4|||||||||||||";

/** Paved stretches the colour pass misses (shaded or under trees), traced in percent. */
const PAVED_LINES: Array<Array<[number, number]>> = [
  [[40.5, 52], [41, 46], [43, 41], [46.5, 38.5]],
  [[61, 58], [64.5, 55], [66, 50], [68, 46], [71, 44], [74, 43.5]],
  [[30, 56], [34, 55], [38, 54]],
  [[72, 60], [78, 64], [84, 72]],
];

/** Walking on grass costs this much more than walking on paving. */
export const GRASS_COST = 2.2;


export const CELL = 10;
const GW = Math.ceil(MAP_W / CELL);
const GH = Math.ceil(MAP_H / CELL);
let gridCache: Uint8Array | null = null;
let pavedCache: Uint8Array | null = null;

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** 1 where a cell is paved path. */
export function pavedGrid(): Uint8Array {
  if (pavedCache) return pavedCache;
  const g = new Uint8Array(GW * GH);
  PAVED_RLE.split("|").forEach((row, gy) => {
    if (!row || gy >= GH) return;
    for (const run of row.split(" ")) {
      const [start, len] = run.split("+").map(Number) as [number, number];
      for (let gx = start; gx < start + len && gx < GW; gx++) g[gy * GW + gx] = 1;
    }
  });
  const lines = PAVED_LINES.map((line) => line.map(([x, y]) => pct(x, y)));
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      if (g[gy * GW + gx]) continue;
      const c = { x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 };
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          if (distToSegment(c, line[i - 1]!, line[i]!) < 16) g[gy * GW + gx] = 1;
        }
      }
    }
  }
  pavedCache = g;
  return g;
}

export function onPath(p: Pt): boolean {
  const gx = Math.floor(p.x / CELL);
  const gy = Math.floor(p.y / CELL);
  return gx >= 0 && gy >= 0 && gx < GW && gy < GH && pavedGrid()[gy * GW + gx] === 1;
}

/** 1 where a cell centre is walkable and not hugging a wall, so paths keep a little clearance. */
function grid(): Uint8Array {
  if (gridCache) return gridCache;
  const g = new Uint8Array(GW * GH);
  const pad = 7;
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL + CELL / 2;
      const y = gy * CELL + CELL / 2;
      const ok = walkable({ x, y }) && walkable({ x: x - pad, y }) && walkable({ x: x + pad, y }) && walkable({ x, y: y - pad }) && walkable({ x, y: y + pad });
      g[gy * GW + gx] = ok ? 1 : 0;
    }
  }
  gridCache = g;
  return g;
}

const cellOf = (p: Pt) => ({ gx: Math.max(0, Math.min(GW - 1, Math.floor(p.x / CELL))), gy: Math.max(0, Math.min(GH - 1, Math.floor(p.y / CELL))) });
const centre = (gx: number, gy: number): Pt => ({ x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 });

/** The open cell closest to a point, searching outward in rings. */
function nearestOpenCell(p: Pt): { gx: number; gy: number } | null {
  const g = grid();
  const c = cellOf(p);
  for (let r = 0; r < 40; r++) {
    let best: { gx: number; gy: number } | null = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const gx = c.gx + dx;
        const gy = c.gy + dy;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || !g[gy * GW + gx]) continue;
        const d = Math.hypot(centre(gx, gy).x - p.x, centre(gx, gy).y - p.y);
        if (d < bestD) {
          bestD = d;
          best = { gx, gy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Nothing solid between two points (sampled every few pixels). */
export function clearLine(a: Pt, b: Pt): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(dist / 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (!walkable(p)) return false;
  }
  return true;
}

/** Every step between two points is on paving. */
function pavedLine(a: Pt, b: Pt): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(dist / 5);
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps);
    if (!onPath({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}

/** A shortcut keeps to the paving when the walk it replaces was on paving. */
function goodShortcut(a: Pt, b: Pt): boolean {
  if (!clearLine(a, b)) return false;
  if (onPath(a) && onPath(b)) return pavedLine(a, b);
  return Math.hypot(b.x - a.x, b.y - a.y) < 140 || pavedLine(a, b);
}

/**
 * Shortest walk from a to b around the sea and every building. Returns waypoints
 * ending at b (or the nearest reachable point to it), or [] when there is no way.
 */
export function findPath(a: Pt, b: Pt): Pt[] {
  if (walkable(b) && clearLine(a, b) && (Math.hypot(b.x - a.x, b.y - a.y) < 140 || pavedLine(a, b))) return [b];
  const g = grid();
  const paved = pavedGrid();
  const start = nearestOpenCell(a);
  const goal = nearestOpenCell(b);
  if (!start || !goal) return [];
  const si = start.gy * GW + start.gx;
  const gi = goal.gy * GW + goal.gx;
  const cost = new Float64Array(GW * GH).fill(Infinity);
  const from = new Int32Array(GW * GH).fill(-1);
  const closed = new Uint8Array(GW * GH);
  const h = (i: number) => {
    const dx = Math.abs((i % GW) - goal.gx);
    const dy = Math.abs(Math.floor(i / GW) - goal.gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // Binary heap of [f, index].
  const heap: Array<[number, number]> = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heap[parent]![0] <= heap[k]![0]) break;
      [heap[parent], heap[k]] = [heap[k]!, heap[parent]!];
      k = parent;
    }
  };
  const pop = (): number => {
    const top = heap[0]![1];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        k = m;
      }
    }
    return top;
  };
  cost[si] = 0;
  push(h(si), si);
  while (heap.length) {
    const i = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === gi) break;
    const x = i % GW;
    const y = Math.floor(i / GW);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (!g[j] || closed[j]) continue;
        // No corner cutting past a wall.
        if (dx && dy && (!g[y * GW + nx] || !g[ny * GW + x])) continue;
        const next = cost[i]! + (dx && dy ? Math.SQRT2 : 1) * (paved[j] ? 1 : GRASS_COST);
        if (next < cost[j]!) {
          cost[j] = next;
          from[j] = i;
          push(next + h(j), j);
        }
      }
    }
  }
  if (!closed[gi]) return [];
  const cells: Pt[] = [];
  for (let i = gi; i !== -1; i = from[i]!) cells.push(centre(i % GW, Math.floor(i / GW)));
  cells.reverse();
  const end = walkable(b) && clearLine(cells[cells.length - 1]!, b) ? b : cells[cells.length - 1]!;
  cells.push(end);
  // String pulling: keep only the turns the walker actually needs.
  const out: Pt[] = [];
  let anchor = a;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) {
      if (goodShortcut(anchor, cells[m]!)) {
        far = m;
        break;
      }
    }
    out.push(cells[far]!);
    anchor = cells[far]!;
    k = far + 1;
  }
  return out;
}

/* ---------- Ward doorsteps ---------- */

const standCache = new Map<number, Pt>();

/** Doorsteps placed by hand where the straight-down search lands too close to another ward. */
const DOOR_OVERRIDES: Record<number, [number, number]> = {
  16: [34, 23.5],
};

/**
 * Where to stand to visit a ward. Pins sit on their buildings, so the doorstep is the
 * first open spot straight below the pin (toward the viewer), else the closest open spot.
 */
export function standFor(node: Pt & { id?: number }): Pt {
  if (node.id != null && standCache.has(node.id)) return standCache.get(node.id)!;
  const fixed = node.id != null ? DOOR_OVERRIDES[node.id] : undefined;
  let spot: Pt | null = fixed ? pct(fixed[0], fixed[1]) : null;
  const g = grid();
  const open = (p: Pt) => {
    const c = cellOf(p);
    return walkable(p) && g[c.gy * GW + c.gx] === 1;
  };
  for (let dy = 8; dy <= 220 && !spot; dy += 4) {
    const p = { x: node.x, y: node.y + dy };
    if (open(p)) {
      spot = p;
      break;
    }
    if (!onLand(p)) break;
  }
  if (!spot) {
    const c = nearestOpenCell(node);
    spot = c ? centre(c.gx, c.gy) : { x: node.x, y: node.y };
  }
  if (node.id != null) standCache.set(node.id, spot);
  return spot;
}

export const NEAR_RADIUS = 46;

/** The ward whose doorstep the walker is standing on. */
export function nearestNode(pos: Pt, radius = NEAR_RADIUS): WardNode | null {
  let best: WardNode | null = null;
  let bestD = radius;
  for (const node of WARD_NODES) {
    const spot = standFor(node);
    const d = Math.hypot(spot.x - pos.x, spot.y - pos.y);
    if (d <= bestD) {
      best = node;
      bestD = d;
    }
  }
  return best;
}

/** The pin drawn nearest a point (for taps on the pin art itself). */
export function pinNear(pos: Pt, radius: number): WardNode | null {
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

const roadCache = new Map<string, Pt[]>();

/** The walked route between two wards' doorsteps, as drawn on the map. */
export function roadBetween(a: number, b: number): Pt[] {
  const key = `${a}-${b}`;
  const hit = roadCache.get(key);
  if (hit) return hit;
  const from = standFor(nodeById(a)!);
  const path = [from, ...findPath(from, standFor(nodeById(b)!))];
  roadCache.set(key, path);
  return path;
}

/** The main road split into the travelled and untravelled part, following the real paths. */
export function roadSplit(unlocked: number): { walked: Pt[]; ahead: Pt[] } {
  const cut = Math.max(1, Math.min(MAIN_ROAD.length, unlocked));
  const walked: Pt[] = [standFor(nodeById(MAIN_ROAD[0]!)!)];
  const ahead: Pt[] = [];
  for (let i = 1; i < MAIN_ROAD.length; i++) {
    const leg = roadBetween(MAIN_ROAD[i - 1]!, MAIN_ROAD[i]!);
    if (i < cut) walked.push(...leg.slice(1));
    else {
      if (!ahead.length) ahead.push(leg[0]!);
      ahead.push(...leg.slice(1));
    }
  }
  return { walked, ahead };
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
  if (memory && walkable(memory)) return { x: memory.x, y: memory.y };
  const node = nodeById(nextId) ?? WARD_NODES[0]!;
  return standFor(node);
}
