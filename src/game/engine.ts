export const KINDS = ["heart", "cross", "pill", "bandage", "nurse", "kit", "teddy", "diaper", "bottle", "pacifier", "gift", "rattle", "scan", "ruby", "gilt", "glow", "plus", "gem", "iv", "slate", "flask", "tubes", "scope", "biohaz", "eyewash", "cyl", "goggles", "extinguisher", "boot", "xray", "ribs", "calcium", "badge", "screw", "wrap", "pelvis"] as const;
export type Kind = (typeof KINDS)[number];
export type Power = "row" | "col" | "bomb" | "rainbow";
export type Special = Power | null;

export interface Tile {
  id: number;
  kind: Kind;
  special: Special;
}

export interface Pos {
  r: number;
  c: number;
}

export type Board = (Tile | null)[][];
export type Rng = () => number;

let seq = 1;

export function resetIds(start = 1) {
  seq = start;
}

export function makeTile(kind: Kind, special: Special = null): Tile {
  return { id: seq++, kind, special };
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function keyOf(p: Pos): string {
  return `${p.r},${p.c}`;
}

export function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function inBoard(board: Board, p: Pos): boolean {
  return p.r >= 0 && p.c >= 0 && p.r < board.length && p.c < (board[0]?.length ?? 0);
}

function swapCells(board: Board, a: Pos, b: Pos) {
  const tmp = board[a.r]![a.c]!;
  board[a.r]![a.c] = board[b.r]![b.c];
  board[b.r]![b.c] = tmp;
}

interface Run {
  dir: "h" | "v";
  cells: Pos[];
  kind: Kind;
}

function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const tile = board[r]![c];
      if (!tile || tile.special === "rainbow") {
        c += 1;
        continue;
      }
      let end = c + 1;
      while (end < cols) {
        const next = board[r]![end];
        if (!next || next.special === "rainbow" || next.kind !== tile.kind) break;
        end += 1;
      }
      if (end - c >= 3) {
        const cells: Pos[] = [];
        for (let i = c; i < end; i++) cells.push({ r, c: i });
        runs.push({ dir: "h", cells, kind: tile.kind });
      }
      c = Math.max(end, c + 1);
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const tile = board[r]![c];
      if (!tile || tile.special === "rainbow") {
        r += 1;
        continue;
      }
      let end = r + 1;
      while (end < rows) {
        const next = board[end]![c];
        if (!next || next.special === "rainbow" || next.kind !== tile.kind) break;
        end += 1;
      }
      if (end - r >= 3) {
        const cells: Pos[] = [];
        for (let i = r; i < end; i++) cells.push({ r: i, c });
        runs.push({ dir: "v", cells, kind: tile.kind });
      }
      r = Math.max(end, r + 1);
    }
  }

  return runs;
}

export interface MatchGroup {
  cells: Pos[];
  special: Power | null;
  anchor: Pos;
  kind: Kind;
}

function groupRuns(runs: Run[]): Run[][] {
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };
  const owner = new Map<string, number>();
  runs.forEach((run, index) => {
    for (const cell of run.cells) {
      const key = keyOf(cell);
      const prev = owner.get(key);
      if (prev === undefined) owner.set(key, index);
      else union(prev, index);
    }
  });
  const buckets = new Map<number, Run[]>();
  runs.forEach((run, index) => {
    const root = find(index);
    const list = buckets.get(root);
    if (list) list.push(run);
    else buckets.set(root, [run]);
  });
  return [...buckets.values()];
}

function summarize(runs: Run[], prefer: Pos[]): MatchGroup {
  const cells = new Map<string, Pos>();
  for (const run of runs) for (const cell of run.cells) cells.set(keyOf(cell), cell);
  const longest = runs.reduce((best, run) => (run.cells.length > best.cells.length ? run : best));
  const hasH = runs.some((run) => run.dir === "h");
  const hasV = runs.some((run) => run.dir === "v");
  let special: Power | null = null;
  if (runs.some((run) => run.cells.length >= 5)) special = "rainbow";
  else if (hasH && hasV) special = "bomb";
  else if (longest.cells.length >= 4) special = longest.dir === "h" ? "row" : "col";

  let anchor = longest.cells[Math.floor((longest.cells.length - 1) / 2)]!;
  for (const cand of prefer) {
    if (cells.has(keyOf(cand))) {
      anchor = cand;
      break;
    }
  }
  return { cells: [...cells.values()], special, anchor, kind: longest.kind };
}

export function findGroups(board: Board, prefer: Pos[] = []): MatchGroup[] {
  const runs = findRuns(board);
  if (!runs.length) return [];
  return groupRuns(runs).map((runsInGroup) => summarize(runsInGroup, prefer));
}

function rowCells(board: Board, r: number): Pos[] {
  if (r < 0 || r >= board.length) return [];
  const out: Pos[] = [];
  for (let c = 0; c < board[0]!.length; c++) if (board[r]![c]) out.push({ r, c });
  return out;
}

function colCells(board: Board, c: number): Pos[] {
  const cols = board[0]?.length ?? 0;
  if (c < 0 || c >= cols) return [];
  const out: Pos[] = [];
  for (let r = 0; r < board.length; r++) if (board[r]![c]) out.push({ r, c });
  return out;
}

function areaCells(board: Board, r: number, c: number, rad: number): Pos[] {
  const out: Pos[] = [];
  for (let rr = r - rad; rr <= r + rad; rr++) {
    for (let cc = c - rad; cc <= c + rad; cc++) {
      if (!inBoard(board, { r: rr, c: cc })) continue;
      if (board[rr]![cc]) out.push({ r: rr, c: cc });
    }
  }
  return out;
}

function kindCells(board: Board, kind: Kind): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0]!.length; c++) {
      const tile = board[r]![c];
      if (tile && tile.kind === kind && tile.special !== "rainbow") out.push({ r, c });
    }
  }
  return out;
}

function mostCommon(board: Board): Kind {
  const counts = new Map<Kind, number>();
  for (const row of board) {
    for (const tile of row) {
      if (!tile || tile.special === "rainbow") continue;
      counts.set(tile.kind, (counts.get(tile.kind) ?? 0) + 1);
    }
  }
  let best: Kind = KINDS[0];
  let bestN = -1;
  for (const [kind, n] of counts) {
    if (n > bestN) {
      best = kind;
      bestN = n;
    }
  }
  return best;
}

type Burst = "normal" | "stripe-all" | "bomb-all";

function expand(board: Board, seeds: Pos[], burst: Burst, focus: Kind | null): Pos[] {
  const dead = new Set<string>();
  const queue: Pos[] = [];
  const add = (p: Pos) => {
    if (!inBoard(board, p) || !board[p.r]![p.c]) return;
    const key = keyOf(p);
    if (dead.has(key)) return;
    dead.add(key);
    queue.push(p);
  };
  for (const seed of seeds) add(seed);

  const detonated = new Set<number>();
  while (queue.length) {
    const pos = queue.shift()!;
    const tile = board[pos.r]![pos.c];
    if (!tile || detonated.has(tile.id)) continue;
    let extras: Pos[] | null = null;
    if (tile.special === "rainbow") {
      extras = kindCells(board, focus ?? mostCommon(board));
    } else if (burst === "stripe-all" && focus && tile.kind === focus) {
      extras = pos.c % 2 === 0 ? rowCells(board, pos.r) : colCells(board, pos.c);
    } else if (burst === "bomb-all" && focus && tile.kind === focus) {
      extras = areaCells(board, pos.r, pos.c, 1);
    } else if (tile.special === "row") extras = rowCells(board, pos.r);
    else if (tile.special === "col") extras = colCells(board, pos.c);
    else if (tile.special === "bomb") extras = areaCells(board, pos.r, pos.c, 1);
    if (!extras) continue;
    detonated.add(tile.id);
    for (const extra of extras) add(extra);
  }

  return [...dead].map((key) => {
    const [r, c] = key.split(",").map(Number);
    return { r: r!, c: c! };
  });
}

export interface ScoreFeed {
  kind: Kind;
  r: number;
  c: number;
  points: number;
}

export interface ClearPlan {
  removals: Pos[];
  spawns: { r: number; c: number; kind: Kind; special: Power }[];
  collected: Record<Kind, number>;
  score: number;
  banner: string | null;
  combo: number;
  feeds: ScoreFeed[];
}

export function emptyCollected(): Record<Kind, number> {
  return Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<Kind, number>;
}

export function comboWeight(combo: number): number {
  if (combo < 6) return combo;
  return combo * 2 - 5;
}

/** One assisted refill. Only level 3 and up, and only while a charge is armed. */
export function diveFavor(levelId: number, armed: boolean): number {
  if (levelId < 3 || !armed) return 0;
  return 2;
}

export function comboLabel(combo: number): string | null {
  if (combo < 2) return null;
  if (combo === 2) return "Nice!";
  if (combo === 3) return "Sweet!";
  if (combo === 4) return "Super care!";
  if (combo === 5) return "Wow!";
  if (combo === 6) return "Deep dive!";
  if (combo === 7) return "Faaah!";
  return "Abyss!";
}

function finalize(
  board: Board,
  removals: Pos[],
  spawns: ClearPlan["spawns"],
  combo: number,
  banner: string | null,
): ClearPlan {
  const collected = emptyCollected();
  const seen = new Set<string>();
  const unique: Pos[] = [];
  for (const pos of removals) {
    const key = keyOf(pos);
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = board[pos.r]?.[pos.c];
    if (!tile) continue;
    unique.push(pos);
    collected[tile.kind] += 1;
  }
  return {
    removals: unique,
    spawns,
    collected,
    score: unique.length * 50 * comboWeight(combo) + spawns.length * 100,
    banner: banner ?? comboLabel(combo),
    combo,
    feeds: [],
  };
}

export function planFromMatches(board: Board, combo: number, prefer: Pos[] = []): ClearPlan | null {
  const groups = findGroups(board, prefer);
  if (!groups.length) return null;
  const used = new Set<string>();
  const spawns: ClearPlan["spawns"] = [];
  const seeds: Pos[] = [];
  for (const group of groups) {
    seeds.push(...group.cells);
    if (!group.special) continue;
    const key = keyOf(group.anchor);
    if (used.has(key)) continue;
    const tile = board[group.anchor.r]![group.anchor.c];
    if (!tile) continue;
    used.add(key);
    spawns.push({ r: group.anchor.r, c: group.anchor.c, kind: tile.kind, special: group.special });
  }
  const plan = finalize(board, expand(board, seeds, "normal", groups[0]!.kind), spawns, combo, null);
  const share = Math.floor(plan.score / groups.length);
  let rest = plan.score - share * groups.length;
  plan.feeds = groups.map((group) => {
    const points = share + rest;
    rest = 0;
    return { kind: group.kind, r: group.anchor.r, c: group.anchor.c, points };
  });
  return plan;
}

function combineSeeds(board: Board, a: Pos, b: Pos): Pos[] {
  const ta = board[a.r]![a.c]!;
  const tb = board[b.r]![b.c]!;
  const map = new Map<string, Pos>();
  const put = (list: Pos[]) => {
    for (const pos of list) map.set(keyOf(pos), pos);
  };
  put([a, b]);
  const stripe = (special: Special) => special === "row" || special === "col";
  if (stripe(ta.special) && stripe(tb.special)) {
    put(rowCells(board, a.r));
    put(colCells(board, a.c));
    put(rowCells(board, b.r));
    put(colCells(board, b.c));
  } else if (
    (ta.special === "bomb" && stripe(tb.special)) ||
    (tb.special === "bomb" && stripe(ta.special))
  ) {
    const center = ta.special === "bomb" ? a : b;
    for (let d = -1; d <= 1; d++) {
      put(rowCells(board, center.r + d));
      put(colCells(board, center.c + d));
    }
  } else if (ta.special === "bomb" && tb.special === "bomb") {
    put(areaCells(board, a.r, a.c, 2));
    put(areaCells(board, b.r, b.c, 2));
  }
  return [...map.values()];
}

/** Board must already be swapped. */
export function planAfterSwap(board: Board, a: Pos, b: Pos, combo: number): ClearPlan | null {
  const ta = board[a.r]![a.c];
  const tb = board[b.r]![b.c];
  if (!ta || !tb) return null;
  if (ta.special === "rainbow" && tb.special === "rainbow") {
    const all: Pos[] = [];
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0]!.length; c++) if (board[r]![c]) all.push({ r, c });
    }
    return finalize(board, expand(board, all, "normal", null), [], combo, "Full ward!");
  }
  if (ta.special === "rainbow" || tb.special === "rainbow") {
    const other = ta.special === "rainbow" ? tb : ta;
    const origin = ta.special === "rainbow" ? a : b;
    const seeds = [origin, ...kindCells(board, other.kind)];
    if (other.special === "row" || other.special === "col") {
      return finalize(board, expand(board, seeds, "stripe-all", other.kind), [], combo, "Stripe storm!");
    }
    if (other.special === "bomb") {
      return finalize(board, expand(board, seeds, "bomb-all", other.kind), [], combo, "Care burst!");
    }
    return finalize(board, expand(board, seeds, "normal", other.kind), [], combo, "Color clear!");
  }
  if (ta.special && tb.special) {
    return finalize(board, expand(board, combineSeeds(board, a, b), "normal", null), [], combo, "Power mix!");
  }
  return planFromMatches(board, combo, [b, a]);
}

export function planCross(board: Board, pos: Pos): ClearPlan | null {
  const tile = board[pos.r]?.[pos.c];
  if (!tile) return null;
  const seeds = [...rowCells(board, pos.r), ...colCells(board, pos.c)];
  return finalize(board, expand(board, seeds, "normal", tile.kind), [], 1, "Cross blast!");
}

export function swapWouldMatch(board: Board, a: Pos, b: Pos): boolean {
  if (!adjacent(a, b) || !board[a.r]?.[a.c] || !board[b.r]?.[b.c]) return false;
  swapCells(board, a, b);
  const ta = board[a.r]![a.c]!;
  const tb = board[b.r]![b.c]!;
  const special = ta.special === "rainbow" || tb.special === "rainbow" || Boolean(ta.special && tb.special);
  const ok = special || findGroups(board).length > 0;
  swapCells(board, a, b);
  return ok;
}

/** Swaps in place when the move is legal. */
export function commitSwap(board: Board, a: Pos, b: Pos): boolean {
  if (!swapWouldMatch(board, a, b)) return false;
  swapCells(board, a, b);
  return true;
}

export function hasMove(board: Board): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && swapWouldMatch(board, { r, c }, { r, c: c + 1 })) return true;
      if (r + 1 < rows && swapWouldMatch(board, { r, c }, { r: r + 1, c })) return true;
    }
  }
  return false;
}

export function findHint(board: Board): [Pos, Pos] | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const neighbors: Pos[] = [
        { r, c: c + 1 },
        { r: r + 1, c },
      ];
      for (const next of neighbors) {
        if (next.c < cols && next.r < rows && swapWouldMatch(board, { r, c }, next)) {
          return [{ r, c }, next];
        }
      }
    }
  }
  return null;
}

export function paintSpecials(board: Board, plan: ClearPlan): { dyingIds: number[]; bornIds: number[] } {
  const spawnAt = new Set(plan.spawns.map((spawn) => `${spawn.r},${spawn.c}`));
  const dyingIds: number[] = [];
  const bornIds: number[] = [];
  for (const pos of plan.removals) {
    const tile = board[pos.r]?.[pos.c];
    if (!tile) continue;
    if (spawnAt.has(keyOf(pos))) bornIds.push(tile.id);
    else dyingIds.push(tile.id);
  }
  for (const spawn of plan.spawns) {
    const tile = board[spawn.r]![spawn.c];
    if (tile) tile.special = spawn.special;
    else {
      const made = makeTile(spawn.kind, spawn.special);
      board[spawn.r]![spawn.c] = made;
      bornIds.push(made.id);
    }
  }
  return { dyingIds, bornIds };
}

export function eraseIds(board: Board, ids: number[]) {
  if (!ids.length) return;
  const drop = new Set(ids);
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0]!.length; c++) {
      const tile = board[r]![c];
      if (tile && drop.has(tile.id)) board[r]![c] = null;
    }
  }
}

export interface SpawnDrop {
  id: number;
  r: number;
  c: number;
  fromR: number;
}

function favoredKind(board: Board, r: number, c: number, kinds: readonly Kind[], rng: Rng, favor: number): Kind {
  const rows = board.length;
  const cols = board[0]!.length;
  const at = (rr: number, cc: number) => (rr >= 0 && rr < rows && cc >= 0 && cc < cols ? board[rr]![cc] : null);
  const allowed = (kind: Kind | undefined) => Boolean(kind && kinds.includes(kind));
  const below1 = at(r + 1, c);
  const below2 = at(r + 2, c);
  const left1 = at(r, c - 1);
  const left2 = at(r, c - 2);
  const completes: Kind[] = [];
  if (allowed(below1?.kind) && below1!.kind === below2?.kind) completes.push(below1!.kind);
  if (allowed(left1?.kind) && left1!.kind === left2?.kind) completes.push(left1!.kind);
  const mild = favor === 4;
  const deep = favor >= 6;
  const strong = favor === 2 || favor === 3 || deep;
  if (completes.length && (strong || (mild && rng() < 0.65))) {
    return completes[Math.floor(rng() * completes.length)]!;
  }
  if (deep && allowed(left1?.kind)) return left1!.kind;
  const above = at(r - 1, c);
  if (strong && allowed(below1?.kind) && !above) return below1!.kind;
  if (mild && allowed(below1?.kind) && !above && rng() < 0.5) return below1!.kind;
  return kinds[Math.floor(rng() * kinds.length)] ?? kinds[0]!;
}

export function collapse(
  board: Board,
  rng: Rng,
  kinds: readonly Kind[],
  favor = 0,
): { board: Board; spawned: SpawnDrop[] } {
  const rows = board.length;
  const cols = board[0]!.length;
  const next: Board = Array.from({ length: rows }, () => Array<Tile | null>(cols).fill(null));
  const spawned: SpawnDrop[] = [];
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const tile = board[r]![c];
      if (!tile) continue;
      next[write]![c] = tile;
      write -= 1;
    }
    let fromR = -1;
    for (let r = write; r >= 0; r--) {
      const kind = favor >= 2 ? favoredKind(next, r, c, kinds, rng, favor) : (kinds[Math.floor(rng() * kinds.length)] ?? kinds[0]!);
      const tile = makeTile(kind);
      next[r]![c] = tile;
      spawned.push({ id: tile.id, r, c, fromR });
      fromR -= 1;
    }
  }
  return { board: next, spawned };
}

function wouldMatchFill(board: Board, r: number, c: number, kind: Kind): boolean {
  if (c >= 2) {
    const a = board[r]![c - 1];
    const b = board[r]![c - 2];
    if (a && b && a.kind === kind && b.kind === kind) return true;
  }
  if (r >= 2) {
    const a = board[r - 1]![c];
    const b = board[r - 2]![c];
    if (a && b && a.kind === kind && b.kind === kind) return true;
  }
  return false;
}

export function createBoard(rng: Rng, rows: number, cols: number, kinds: readonly Kind[]): Board {
  let last: Board | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const board: Board = Array.from({ length: rows }, () => Array<Tile | null>(cols).fill(null));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let kind = kinds[0]!;
        for (let tryKind = 0; tryKind < 12; tryKind++) {
          kind = kinds[Math.floor(rng() * kinds.length)] ?? kinds[0]!;
          if (!wouldMatchFill(board, r, c, kind)) break;
        }
        board[r]![c] = makeTile(kind);
      }
    }
    last = board;
    if (findGroups(board).length === 0 && hasMove(board)) return board;
  }
  return last!;
}

export function shuffleBoard(board: Board, rng: Rng): Board {
  const rows = board.length;
  const cols = board[0]!.length;
  const tiles: Tile[] = [];
  for (const row of board) for (const tile of row) if (tile) tiles.push(tile);
  let fallback: Board | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const bag = tiles.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = bag[i]!;
      bag[i] = bag[j]!;
      bag[j] = tmp;
    }
    const next: Board = Array.from({ length: rows }, (_, r) =>
      bag.slice(r * cols, (r + 1) * cols),
    );
    fallback = next;
    if (findGroups(next).length === 0 && hasMove(next)) return next;
  }
  return fallback ?? board;
}

export function upgradeSpecial(tile: Tile, col: number) {
  if (!tile.special) tile.special = col % 2 === 0 ? "row" : "col";
  else if (tile.special === "row" || tile.special === "col") tile.special = "bomb";
  else if (tile.special === "bomb") tile.special = "rainbow";
  else tile.special = "row";
}

export function boardFull(board: Board): boolean {
  return board.every((row) => row.every(Boolean));
}

export function centroid(cells: Pos[]): Pos {
  if (!cells.length) return { r: 0, c: 0 };
  let r = 0;
  let c = 0;
  for (const cell of cells) {
    r += cell.r;
    c += cell.c;
  }
  return { r: r / cells.length, c: c / cells.length };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((tile) => (tile ? { ...tile } : null)));
}
