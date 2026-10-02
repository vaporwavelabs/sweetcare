import { i as __toESM } from "../_runtime.mjs";
import { d as require_react_dom, q as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as ChevronLeft, i as Star, n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B0cIbrad.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_react_dom = require_react_dom();
var KINDS = [
	"heart",
	"cross",
	"pill",
	"bandage",
	"nurse",
	"kit",
	"teddy",
	"diaper",
	"bottle",
	"pacifier",
	"gift",
	"rattle"
];
var seq = 1;
function makeTile(kind, special = null) {
	return {
		id: seq++,
		kind,
		special
	};
}
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function keyOf(p) {
	return `${p.r},${p.c}`;
}
function adjacent(a, b) {
	return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}
function inBoard(board, p) {
	return p.r >= 0 && p.c >= 0 && p.r < board.length && p.c < (board[0]?.length ?? 0);
}
function swapCells(board, a, b) {
	const tmp = board[a.r][a.c];
	board[a.r][a.c] = board[b.r][b.c];
	board[b.r][b.c] = tmp;
}
function findRuns(board) {
	const runs = [];
	const rows = board.length;
	const cols = board[0]?.length ?? 0;
	for (let r = 0; r < rows; r++) {
		let c = 0;
		while (c < cols) {
			const tile = board[r][c];
			if (!tile || tile.special === "rainbow") {
				c += 1;
				continue;
			}
			let end = c + 1;
			while (end < cols) {
				const next = board[r][end];
				if (!next || next.special === "rainbow" || next.kind !== tile.kind) break;
				end += 1;
			}
			if (end - c >= 3) {
				const cells = [];
				for (let i = c; i < end; i++) cells.push({
					r,
					c: i
				});
				runs.push({
					dir: "h",
					cells,
					kind: tile.kind
				});
			}
			c = Math.max(end, c + 1);
		}
	}
	for (let c = 0; c < cols; c++) {
		let r = 0;
		while (r < rows) {
			const tile = board[r][c];
			if (!tile || tile.special === "rainbow") {
				r += 1;
				continue;
			}
			let end = r + 1;
			while (end < rows) {
				const next = board[end][c];
				if (!next || next.special === "rainbow" || next.kind !== tile.kind) break;
				end += 1;
			}
			if (end - r >= 3) {
				const cells = [];
				for (let i = r; i < end; i++) cells.push({
					r: i,
					c
				});
				runs.push({
					dir: "v",
					cells,
					kind: tile.kind
				});
			}
			r = Math.max(end, r + 1);
		}
	}
	return runs;
}
function groupRuns(runs) {
	const parent = runs.map((_, i) => i);
	const find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
	const union = (a, b) => {
		const pa = find(a);
		const pb = find(b);
		if (pa !== pb) parent[pa] = pb;
	};
	const owner = /* @__PURE__ */ new Map();
	runs.forEach((run, index) => {
		for (const cell of run.cells) {
			const key = keyOf(cell);
			const prev = owner.get(key);
			if (prev === void 0) owner.set(key, index);
			else union(prev, index);
		}
	});
	const buckets = /* @__PURE__ */ new Map();
	runs.forEach((run, index) => {
		const root = find(index);
		const list = buckets.get(root);
		if (list) list.push(run);
		else buckets.set(root, [run]);
	});
	return [...buckets.values()];
}
function summarize(runs, prefer) {
	const cells = /* @__PURE__ */ new Map();
	for (const run of runs) for (const cell of run.cells) cells.set(keyOf(cell), cell);
	const longest = runs.reduce((best, run) => run.cells.length > best.cells.length ? run : best);
	const hasH = runs.some((run) => run.dir === "h");
	const hasV = runs.some((run) => run.dir === "v");
	let special = null;
	if (runs.some((run) => run.cells.length >= 5)) special = "rainbow";
	else if (hasH && hasV) special = "bomb";
	else if (longest.cells.length >= 4) special = longest.dir === "h" ? "row" : "col";
	let anchor = longest.cells[Math.floor((longest.cells.length - 1) / 2)];
	for (const cand of prefer) if (cells.has(keyOf(cand))) {
		anchor = cand;
		break;
	}
	return {
		cells: [...cells.values()],
		special,
		anchor,
		kind: longest.kind
	};
}
function findGroups(board, prefer = []) {
	const runs = findRuns(board);
	if (!runs.length) return [];
	return groupRuns(runs).map((runsInGroup) => summarize(runsInGroup, prefer));
}
function rowCells(board, r) {
	if (r < 0 || r >= board.length) return [];
	const out = [];
	for (let c = 0; c < board[0].length; c++) if (board[r][c]) out.push({
		r,
		c
	});
	return out;
}
function colCells(board, c) {
	const cols = board[0]?.length ?? 0;
	if (c < 0 || c >= cols) return [];
	const out = [];
	for (let r = 0; r < board.length; r++) if (board[r][c]) out.push({
		r,
		c
	});
	return out;
}
function areaCells(board, r, c, rad) {
	const out = [];
	for (let rr = r - rad; rr <= r + rad; rr++) for (let cc = c - rad; cc <= c + rad; cc++) {
		if (!inBoard(board, {
			r: rr,
			c: cc
		})) continue;
		if (board[rr][cc]) out.push({
			r: rr,
			c: cc
		});
	}
	return out;
}
function kindCells(board, kind) {
	const out = [];
	for (let r = 0; r < board.length; r++) for (let c = 0; c < board[0].length; c++) {
		const tile = board[r][c];
		if (tile && tile.kind === kind && tile.special !== "rainbow") out.push({
			r,
			c
		});
	}
	return out;
}
function mostCommon(board) {
	const counts = /* @__PURE__ */ new Map();
	for (const row of board) for (const tile of row) {
		if (!tile || tile.special === "rainbow") continue;
		counts.set(tile.kind, (counts.get(tile.kind) ?? 0) + 1);
	}
	let best = KINDS[0];
	let bestN = -1;
	for (const [kind, n] of counts) if (n > bestN) {
		best = kind;
		bestN = n;
	}
	return best;
}
function expand(board, seeds, burst, focus) {
	const dead = /* @__PURE__ */ new Set();
	const queue = [];
	const add = (p) => {
		if (!inBoard(board, p) || !board[p.r][p.c]) return;
		const key = keyOf(p);
		if (dead.has(key)) return;
		dead.add(key);
		queue.push(p);
	};
	for (const seed of seeds) add(seed);
	const detonated = /* @__PURE__ */ new Set();
	while (queue.length) {
		const pos = queue.shift();
		const tile = board[pos.r][pos.c];
		if (!tile || detonated.has(tile.id)) continue;
		let extras = null;
		if (tile.special === "rainbow") extras = kindCells(board, focus ?? mostCommon(board));
		else if (burst === "stripe-all" && focus && tile.kind === focus) extras = pos.c % 2 === 0 ? rowCells(board, pos.r) : colCells(board, pos.c);
		else if (burst === "bomb-all" && focus && tile.kind === focus) extras = areaCells(board, pos.r, pos.c, 1);
		else if (tile.special === "row") extras = rowCells(board, pos.r);
		else if (tile.special === "col") extras = colCells(board, pos.c);
		else if (tile.special === "bomb") extras = areaCells(board, pos.r, pos.c, 1);
		if (!extras) continue;
		detonated.add(tile.id);
		for (const extra of extras) add(extra);
	}
	return [...dead].map((key) => {
		const [r, c] = key.split(",").map(Number);
		return {
			r,
			c
		};
	});
}
function emptyCollected() {
	return Object.fromEntries(KINDS.map((kind) => [kind, 0]));
}
function comboWeight(combo) {
	if (combo < 6) return combo;
	return combo * 2 - 5;
}
/** One assisted refill. Only level 3 and up, and only while a charge is armed. */
function diveFavor(levelId, armed) {
	if (levelId < 3 || !armed) return 0;
	return 2;
}
function comboLabel(combo) {
	if (combo < 2) return null;
	if (combo === 2) return "Nice!";
	if (combo === 3) return "Sweet!";
	if (combo === 4) return "Super care!";
	if (combo === 5) return "Wow!";
	if (combo === 6) return "Deep dive!";
	if (combo === 7) return "Faaah!";
	return "Abyss!";
}
function finalize(board, removals, spawns, combo, banner) {
	const collected = emptyCollected();
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
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
		feeds: []
	};
}
function planFromMatches(board, combo, prefer = []) {
	const groups = findGroups(board, prefer);
	if (!groups.length) return null;
	const used = /* @__PURE__ */ new Set();
	const spawns = [];
	const seeds = [];
	for (const group of groups) {
		seeds.push(...group.cells);
		if (!group.special) continue;
		const key = keyOf(group.anchor);
		if (used.has(key)) continue;
		const tile = board[group.anchor.r][group.anchor.c];
		if (!tile) continue;
		used.add(key);
		spawns.push({
			r: group.anchor.r,
			c: group.anchor.c,
			kind: tile.kind,
			special: group.special
		});
	}
	const plan = finalize(board, expand(board, seeds, "normal", groups[0].kind), spawns, combo, null);
	const share = Math.floor(plan.score / groups.length);
	let rest = plan.score - share * groups.length;
	plan.feeds = groups.map((group) => {
		const points = share + rest;
		rest = 0;
		return {
			kind: group.kind,
			r: group.anchor.r,
			c: group.anchor.c,
			points
		};
	});
	return plan;
}
function combineSeeds(board, a, b) {
	const ta = board[a.r][a.c];
	const tb = board[b.r][b.c];
	const map = /* @__PURE__ */ new Map();
	const put = (list) => {
		for (const pos of list) map.set(keyOf(pos), pos);
	};
	put([a, b]);
	const stripe = (special) => special === "row" || special === "col";
	if (stripe(ta.special) && stripe(tb.special)) {
		put(rowCells(board, a.r));
		put(colCells(board, a.c));
		put(rowCells(board, b.r));
		put(colCells(board, b.c));
	} else if (ta.special === "bomb" && stripe(tb.special) || tb.special === "bomb" && stripe(ta.special)) {
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
function planAfterSwap(board, a, b, combo) {
	const ta = board[a.r][a.c];
	const tb = board[b.r][b.c];
	if (!ta || !tb) return null;
	if (ta.special === "rainbow" && tb.special === "rainbow") {
		const all = [];
		for (let r = 0; r < board.length; r++) for (let c = 0; c < board[0].length; c++) if (board[r][c]) all.push({
			r,
			c
		});
		return finalize(board, expand(board, all, "normal", null), [], combo, "Full ward!");
	}
	if (ta.special === "rainbow" || tb.special === "rainbow") {
		const other = ta.special === "rainbow" ? tb : ta;
		const seeds = [ta.special === "rainbow" ? a : b, ...kindCells(board, other.kind)];
		if (other.special === "row" || other.special === "col") return finalize(board, expand(board, seeds, "stripe-all", other.kind), [], combo, "Stripe storm!");
		if (other.special === "bomb") return finalize(board, expand(board, seeds, "bomb-all", other.kind), [], combo, "Care burst!");
		return finalize(board, expand(board, seeds, "normal", other.kind), [], combo, "Color clear!");
	}
	if (ta.special && tb.special) return finalize(board, expand(board, combineSeeds(board, a, b), "normal", null), [], combo, "Power mix!");
	return planFromMatches(board, combo, [b, a]);
}
function planCross(board, pos) {
	const tile = board[pos.r]?.[pos.c];
	if (!tile) return null;
	return finalize(board, expand(board, [...rowCells(board, pos.r), ...colCells(board, pos.c)], "normal", tile.kind), [], 1, "Cross blast!");
}
function swapWouldMatch(board, a, b) {
	if (!adjacent(a, b) || !board[a.r]?.[a.c] || !board[b.r]?.[b.c]) return false;
	swapCells(board, a, b);
	const ta = board[a.r][a.c];
	const tb = board[b.r][b.c];
	const ok = ta.special === "rainbow" || tb.special === "rainbow" || Boolean(ta.special && tb.special) || findGroups(board).length > 0;
	swapCells(board, a, b);
	return ok;
}
/** Swaps in place when the move is legal. */
function commitSwap(board, a, b) {
	if (!swapWouldMatch(board, a, b)) return false;
	swapCells(board, a, b);
	return true;
}
function hasMove(board) {
	const rows = board.length;
	const cols = board[0]?.length ?? 0;
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
		if (c + 1 < cols && swapWouldMatch(board, {
			r,
			c
		}, {
			r,
			c: c + 1
		})) return true;
		if (r + 1 < rows && swapWouldMatch(board, {
			r,
			c
		}, {
			r: r + 1,
			c
		})) return true;
	}
	return false;
}
function findHint(board) {
	const rows = board.length;
	const cols = board[0]?.length ?? 0;
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
		const neighbors = [{
			r,
			c: c + 1
		}, {
			r: r + 1,
			c
		}];
		for (const next of neighbors) if (next.c < cols && next.r < rows && swapWouldMatch(board, {
			r,
			c
		}, next)) return [{
			r,
			c
		}, next];
	}
	return null;
}
function paintSpecials(board, plan) {
	const spawnAt = new Set(plan.spawns.map((spawn) => `${spawn.r},${spawn.c}`));
	const dyingIds = [];
	const bornIds = [];
	for (const pos of plan.removals) {
		const tile = board[pos.r]?.[pos.c];
		if (!tile) continue;
		if (spawnAt.has(keyOf(pos))) bornIds.push(tile.id);
		else dyingIds.push(tile.id);
	}
	for (const spawn of plan.spawns) {
		const tile = board[spawn.r][spawn.c];
		if (tile) tile.special = spawn.special;
		else {
			const made = makeTile(spawn.kind, spawn.special);
			board[spawn.r][spawn.c] = made;
			bornIds.push(made.id);
		}
	}
	return {
		dyingIds,
		bornIds
	};
}
function eraseIds(board, ids) {
	if (!ids.length) return;
	const drop = new Set(ids);
	for (let r = 0; r < board.length; r++) for (let c = 0; c < board[0].length; c++) {
		const tile = board[r][c];
		if (tile && drop.has(tile.id)) board[r][c] = null;
	}
}
function favoredKind(board, r, c, kinds, rng, favor) {
	const rows = board.length;
	const cols = board[0].length;
	const at = (rr, cc) => rr >= 0 && rr < rows && cc >= 0 && cc < cols ? board[rr][cc] : null;
	const allowed = (kind) => Boolean(kind && kinds.includes(kind));
	const below1 = at(r + 1, c);
	const below2 = at(r + 2, c);
	const left1 = at(r, c - 1);
	const left2 = at(r, c - 2);
	const completes = [];
	if (allowed(below1?.kind) && below1.kind === below2?.kind) completes.push(below1.kind);
	if (allowed(left1?.kind) && left1.kind === left2?.kind) completes.push(left1.kind);
	const mild = favor === 4;
	const deep = favor >= 6;
	const strong = favor === 2 || favor === 3 || deep;
	if (completes.length && (strong || mild && rng() < .65)) return completes[Math.floor(rng() * completes.length)];
	if (deep && allowed(left1?.kind)) return left1.kind;
	const above = at(r - 1, c);
	if (strong && allowed(below1?.kind) && !above) return below1.kind;
	if (mild && allowed(below1?.kind) && !above && rng() < .5) return below1.kind;
	return kinds[Math.floor(rng() * kinds.length)] ?? kinds[0];
}
function collapse(board, rng, kinds, favor = 0) {
	const rows = board.length;
	const cols = board[0].length;
	const next = Array.from({ length: rows }, () => Array(cols).fill(null));
	const spawned = [];
	for (let c = 0; c < cols; c++) {
		let write = rows - 1;
		for (let r = rows - 1; r >= 0; r--) {
			const tile = board[r][c];
			if (!tile) continue;
			next[write][c] = tile;
			write -= 1;
		}
		let fromR = -1;
		for (let r = write; r >= 0; r--) {
			const tile = makeTile(favor >= 2 ? favoredKind(next, r, c, kinds, rng, favor) : kinds[Math.floor(rng() * kinds.length)] ?? kinds[0]);
			next[r][c] = tile;
			spawned.push({
				id: tile.id,
				r,
				c,
				fromR
			});
			fromR -= 1;
		}
	}
	return {
		board: next,
		spawned
	};
}
function wouldMatchFill(board, r, c, kind) {
	if (c >= 2) {
		const a = board[r][c - 1];
		const b = board[r][c - 2];
		if (a && b && a.kind === kind && b.kind === kind) return true;
	}
	if (r >= 2) {
		const a = board[r - 1][c];
		const b = board[r - 2][c];
		if (a && b && a.kind === kind && b.kind === kind) return true;
	}
	return false;
}
function createBoard(rng, rows, cols, kinds) {
	let last = null;
	for (let attempt = 0; attempt < 40; attempt++) {
		const board = Array.from({ length: rows }, () => Array(cols).fill(null));
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
			let kind = kinds[0];
			for (let tryKind = 0; tryKind < 12; tryKind++) {
				kind = kinds[Math.floor(rng() * kinds.length)] ?? kinds[0];
				if (!wouldMatchFill(board, r, c, kind)) break;
			}
			board[r][c] = makeTile(kind);
		}
		last = board;
		if (findGroups(board).length === 0 && hasMove(board)) return board;
	}
	return last;
}
function shuffleBoard(board, rng) {
	const rows = board.length;
	const cols = board[0].length;
	const tiles = [];
	for (const row of board) for (const tile of row) if (tile) tiles.push(tile);
	let fallback = null;
	for (let attempt = 0; attempt < 30; attempt++) {
		const bag = tiles.slice();
		for (let i = bag.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			const tmp = bag[i];
			bag[i] = bag[j];
			bag[j] = tmp;
		}
		const next = Array.from({ length: rows }, (_, r) => bag.slice(r * cols, (r + 1) * cols));
		fallback = next;
		if (findGroups(next).length === 0 && hasMove(next)) return next;
	}
	return fallback ?? board;
}
function upgradeSpecial(tile, col) {
	if (!tile.special) tile.special = col % 2 === 0 ? "row" : "col";
	else if (tile.special === "row" || tile.special === "col") tile.special = "bomb";
	else if (tile.special === "bomb") tile.special = "rainbow";
	else tile.special = "row";
}
function centroid(cells) {
	if (!cells.length) return {
		r: 0,
		c: 0
	};
	let r = 0;
	let c = 0;
	for (const cell of cells) {
		r += cell.r;
		c += cell.c;
	}
	return {
		r: r / cells.length,
		c: c / cells.length
	};
}
var HOSPITAL = [
	"heart",
	"cross",
	"pill",
	"bandage",
	"nurse",
	"kit"
];
var CLINIC = [
	"heart",
	"cross",
	"kit",
	"teddy",
	"diaper",
	"bottle"
];
var PEDIATRIC = [
	"heart",
	"cross",
	"kit",
	"pacifier",
	"gift",
	"rattle"
];
function longer(n) {
	return Math.ceil(n * 1.15);
}
var LEVELS = [
	{
		id: 1,
		name: "Sweet Start",
		rows: 6,
		cols: 6,
		kinds: HOSPITAL.slice(0, 4),
		moves: longer(22),
		goals: [{
			type: "collect",
			kind: "heart",
			count: longer(12)
		}],
		star2: longer(1600),
		star3: longer(2800),
		jelly: "none"
	},
	{
		id: 2,
		name: "Patch Job",
		rows: 6,
		cols: 6,
		kinds: HOSPITAL.slice(0, 4),
		moves: longer(22),
		goals: [{
			type: "collect",
			kind: "bandage",
			count: longer(12)
		}],
		star2: longer(1600),
		star3: longer(2800),
		jelly: "none"
	},
	{
		id: 3,
		name: "Capsule Run",
		rows: 6,
		cols: 6,
		kinds: HOSPITAL.slice(0, 5),
		moves: longer(22),
		goals: [{
			type: "collect",
			kind: "pill",
			count: longer(12)
		}],
		star2: longer(1700),
		star3: longer(3e3),
		jelly: "none"
	},
	{
		id: 4,
		name: "Red Cross",
		rows: 6,
		cols: 6,
		kinds: HOSPITAL.slice(0, 5),
		moves: longer(22),
		goals: [{
			type: "collect",
			kind: "cross",
			count: longer(12)
		}],
		star2: longer(1700),
		star3: longer(3e3),
		jelly: "none"
	},
	{
		id: 5,
		name: "Night Nurse",
		rows: 6,
		cols: 6,
		kinds: HOSPITAL.slice(0, 5),
		moves: longer(20),
		goals: [{
			type: "collect",
			kind: "nurse",
			count: longer(10)
		}],
		star2: longer(1800),
		star3: longer(3200),
		jelly: "none"
	},
	{
		id: 6,
		name: "Teddy Trail",
		rows: 6,
		cols: 6,
		kinds: CLINIC,
		moves: longer(22),
		goals: [{
			type: "collect",
			kind: "teddy",
			count: longer(10)
		}],
		star2: longer(1800),
		star3: longer(3200),
		jelly: "none"
	},
	{
		id: 7,
		name: "Diaper Duty",
		rows: 6,
		cols: 6,
		kinds: CLINIC.slice(0, 5),
		moves: longer(28),
		goals: [{ type: "jelly" }],
		star2: longer(1800),
		star3: longer(3200),
		jelly: "bottom"
	},
	{
		id: 8,
		name: "Bottle Check",
		rows: 6,
		cols: 6,
		kinds: CLINIC.slice(0, 5),
		moves: longer(32),
		goals: [{ type: "jelly" }],
		star2: longer(2e3),
		star3: longer(3600),
		jelly: "checker"
	},
	{
		id: 9,
		name: "Score Sprint",
		rows: 6,
		cols: 6,
		kinds: CLINIC,
		moves: longer(20),
		goals: [{
			type: "score",
			target: longer(3500)
		}],
		star2: longer(4500),
		star3: longer(6200),
		jelly: "none"
	},
	{
		id: 10,
		name: "Heart Surge",
		rows: 6,
		cols: 6,
		kinds: CLINIC,
		moves: longer(26),
		goals: [{
			type: "collect",
			kind: "heart",
			count: longer(14)
		}],
		star2: longer(2200),
		star3: longer(3800),
		jelly: "none"
	},
	{
		id: 11,
		name: "Picture Frame",
		rows: 6,
		cols: 6,
		kinds: PEDIATRIC,
		moves: longer(32),
		goals: [{ type: "jelly" }],
		star2: longer(2e3),
		star3: longer(3600),
		jelly: "frame"
	},
	{
		id: 12,
		name: "Pacifier Gifts",
		rows: 6,
		cols: 6,
		kinds: PEDIATRIC,
		moves: longer(26),
		goals: [{
			type: "collect",
			kind: "pacifier",
			count: longer(14)
		}, {
			type: "collect",
			kind: "gift",
			count: longer(14)
		}],
		star2: longer(2400),
		star3: longer(4e3),
		jelly: "none"
	},
	{
		id: 13,
		name: "Sticky Ward",
		rows: 6,
		cols: 6,
		kinds: PEDIATRIC.slice(0, 5),
		moves: longer(36),
		goals: [{ type: "jelly" }],
		star2: longer(2400),
		star3: longer(4200),
		jelly: "all"
	},
	{
		id: 14,
		name: "Night Shift",
		rows: 6,
		cols: 6,
		kinds: PEDIATRIC,
		moves: longer(22),
		goals: [{
			type: "score",
			target: longer(5500)
		}],
		star2: longer(6800),
		star3: longer(8600),
		jelly: "none"
	},
	{
		id: 15,
		name: "First Aid Rescue",
		rows: 6,
		cols: 6,
		kinds: PEDIATRIC,
		moves: longer(36),
		goals: [{ type: "jelly" }, {
			type: "collect",
			kind: "kit",
			count: longer(10)
		}],
		star2: longer(3200),
		star3: longer(5200),
		jelly: "lower"
	}
];
var HOSPITAL_KINDS = HOSPITAL;
/** Pins on the island, in percent of the map image. */
var MAP_SPOTS = [
	{
		id: 1,
		x: 24,
		y: 44
	},
	{
		id: 2,
		x: 31,
		y: 56
	},
	{
		id: 3,
		x: 37,
		y: 48
	},
	{
		id: 4,
		x: 43,
		y: 57
	},
	{
		id: 5,
		x: 49,
		y: 46
	},
	{
		id: 6,
		x: 56,
		y: 38
	},
	{
		id: 7,
		x: 61,
		y: 50
	},
	{
		id: 8,
		x: 66,
		y: 42
	},
	{
		id: 9,
		x: 70,
		y: 52
	},
	{
		id: 10,
		x: 74,
		y: 44
	},
	{
		id: 11,
		x: 83,
		y: 46
	},
	{
		id: 12,
		x: 77,
		y: 58
	},
	{
		id: 13,
		x: 87,
		y: 58
	},
	{
		id: 14,
		x: 70,
		y: 68
	},
	{
		id: 15,
		x: 79,
		y: 74
	}
];
function journeyFor(levelId) {
	if (levelId === 1) return {
		fromX: 16,
		fromY: 80,
		toX: 24,
		toY: 44,
		title: "Heading to the hospital"
	};
	if (levelId === 6) return {
		fromX: 24,
		fromY: 44,
		toX: 56,
		toY: 38,
		title: "Heading to the clinic"
	};
	if (levelId === 11) return {
		fromX: 56,
		fromY: 38,
		toX: 83,
		toY: 46,
		title: "Heading to the pediatric clinic"
	};
	return null;
}
function getLevel(id) {
	return LEVELS[id - 1] ?? LEVELS[0];
}
function makeJelly(level) {
	const grid = Array.from({ length: level.rows }, () => Array(level.cols).fill(false));
	if (level.jelly === "none") return grid;
	for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) if (level.jelly === "all") grid[r][c] = true;
	else if (level.jelly === "bottom") grid[r][c] = r >= level.rows - 3;
	else if (level.jelly === "lower") grid[r][c] = r >= Math.floor(level.rows / 2);
	else if (level.jelly === "checker") grid[r][c] = (r + c) % 2 === 0;
	else if (level.jelly === "frame") grid[r][c] = r === 0 || c === 0 || r === level.rows - 1 || c === level.cols - 1;
	return grid;
}
function countJelly(jelly) {
	let n = 0;
	for (const row of jelly) for (const cell of row) if (cell) n += 1;
	return n;
}
function goalsMet(level, progress) {
	return level.goals.every((goal) => {
		if (goal.type === "score") return progress.score >= goal.target;
		if (goal.type === "collect") return progress.collected[goal.kind] >= goal.count;
		return progress.jellyLeft === 0;
	});
}
function starsFor(level, score, won) {
	if (!won) return 0;
	if (score >= level.star3) return 3;
	if (score >= level.star2) return 2;
	return 1;
}
function goalFraction(level, progress, jellyTotal) {
	if (!level.goals.length) return 0;
	const parts = level.goals.map((goal) => {
		if (goal.type === "score") return Math.min(1, progress.score / goal.target);
		if (goal.type === "collect") return Math.min(1, progress.collected[goal.kind] / goal.count);
		if (!jellyTotal) return 1;
		return Math.min(1, (jellyTotal - progress.jellyLeft) / jellyTotal);
	});
	return parts.reduce((sum, n) => sum + n, 0) / parts.length;
}
function freshCollected() {
	return emptyCollected();
}
function breakJelly(jelly, cells) {
	let n = 0;
	for (const cell of cells) if (jelly[cell.r]?.[cell.c]) {
		jelly[cell.r][cell.c] = false;
		n += 1;
	}
	return n;
}
function defaultCareer() {
	return {
		name: "Alex",
		rounds: 0,
		wins: 0,
		destroyed: 0,
		rank: 1,
		progress: 0,
		scrub: "blue",
		coat: false,
		accessory: "none",
		achievements: []
	};
}
var TITLES = [
	"Intern",
	"Orderly",
	"Nurse",
	"Medic",
	"Resident",
	"Doctor",
	"Attending",
	"Chief",
	"Director"
];
function rankTitle(rank) {
	if (rank <= 1) return TITLES[0];
	return TITLES[Math.min(TITLES.length - 1, rank - 1)];
}
/** First promotion is 2 rounds. Then 3, 4, 3, and that cycle repeats. */
function gapFor(rank) {
	if (rank <= 1) return 2;
	const cycle = [
		3,
		4,
		3
	];
	return cycle[(rank - 2) % cycle.length];
}
var COSMETICS = [
	{
		id: "blue",
		slot: "scrub",
		label: "Blue scrubs",
		need: 1,
		filter: "none"
	},
	{
		id: "pink",
		slot: "scrub",
		label: "Pink scrubs",
		need: 2,
		filter: "hue-rotate(278deg) saturate(1.35)"
	},
	{
		id: "mint",
		slot: "scrub",
		label: "Mint scrubs",
		need: 3,
		filter: "hue-rotate(82deg) saturate(1.15)"
	},
	{
		id: "coat",
		slot: "coat",
		label: "Lab coat",
		need: 4,
		filter: "none"
	},
	{
		id: "glasses",
		slot: "accessory",
		label: "Glasses",
		need: 5,
		filter: "none"
	},
	{
		id: "gold",
		slot: "scrub",
		label: "Gold scrubs",
		need: 6,
		filter: "hue-rotate(168deg) saturate(1.7) brightness(1.12)"
	},
	{
		id: "bow",
		slot: "accessory",
		label: "Bow tie",
		need: 7,
		filter: "none"
	},
	{
		id: "cap",
		slot: "accessory",
		label: "Surgical cap",
		need: 8,
		filter: "none"
	}
];
function cosmeticOwned(rank, item) {
	return rank >= item.need;
}
function scrubFilter(id) {
	return COSMETICS.find((item) => item.slot === "scrub" && item.id === id)?.filter ?? "none";
}
var ACHIEVEMENTS = [
	{
		id: "first-clear",
		label: "First clear",
		hint: "Finish a ward"
	},
	{
		id: "streak",
		label: "5 streak",
		hint: "Land a 5 cascade"
	},
	{
		id: "perfect",
		label: "Perfect care",
		hint: "Earn 3 stars"
	},
	{
		id: "swift",
		label: "Time record",
		hint: "Set a best time"
	},
	{
		id: "century",
		label: "Century",
		hint: "Destroy 100 icons"
	},
	{
		id: "rounds-10",
		label: "Dedicated",
		hint: "Finish 10 rounds"
	},
	{
		id: "five-wards",
		label: "Ward hopper",
		hint: "Clear 5 levels"
	},
	{
		id: "rescue",
		label: "Rescue",
		hint: "Clear level 15"
	},
	{
		id: "rank-4",
		label: "On the ward",
		hint: "Reach Medic"
	}
];
function applyRound(careerIn, report, clearedLevels) {
	const career = {
		...careerIn,
		achievements: [...careerIn.achievements]
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
	const grant = (id, ok) => {
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
	return {
		career,
		rankedUp
	};
}
function DocAvatar({ career, frame = null, className = "" }) {
	const src = frame == null ? "/avatar/idle.png" : `/avatar/cele-${frame}.png`;
	const filter = scrubFilter(career.scrub);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `doc ${className}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src,
				alt: "",
				draggable: false,
				style: filter === "none" ? void 0 : { filter }
			}),
			frame == null && career.coat ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "lab-coat",
				"aria-hidden": true
			}) : null,
			frame == null && career.accessory === "glasses" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "acc glasses",
				"aria-hidden": true
			}) : null,
			frame == null && career.accessory === "bow" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "acc bow",
				"aria-hidden": true
			}) : null,
			frame == null && career.accessory === "cap" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "acc cap",
				"aria-hidden": true
			}) : null
		]
	});
}
/** The end-of-level dance. Loops the keyed celebration clip. */
function Cheer({ career }) {
	const videoRef = (0, import_react.useRef)(null);
	const [reduced, setReduced] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(media.matches);
		if (media.matches) return;
		const video = videoRef.current;
		if (!video) return;
		video.muted = true;
		video.play().catch(() => {});
	}, []);
	if (reduced) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocAvatar, {
		career,
		className: "cheer"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "doc cheer dance",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
			ref: videoRef,
			src: "/avatar/dance.webm",
			autoPlay: true,
			muted: true,
			loop: true,
			playsInline: true,
			preload: "auto"
		})
	});
}
function CountUp({ value }) {
	const [n, setN] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		let raf = 0;
		const start = performance.now();
		const tick = (now) => {
			const t = Math.min(1, (now - start) / 680);
			setN(Math.round(value * (1 - (1 - t) ** 3)));
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [value]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: n });
}
function ProfileScreen({ save, onBack, onReplay, onChange }) {
	const career = save.career;
	const gap = gapFor(career.rank);
	const board = LEVELS.map((level) => ({
		id: level.id,
		name: level.name,
		score: save.best[String(level.id)] ?? 0,
		stars: save.stars[String(level.id)] ?? 0
	})).filter((row) => row.score > 0).sort((a, b) => b.score - a.score);
	const owned = (id) => {
		const item = COSMETICS.find((entry) => entry.id === id);
		return item ? cosmeticOwned(career.rank, item) : false;
	};
	const equip = (slot, id) => {
		onChange((prev) => ({
			...prev,
			career: {
				...prev.career,
				scrub: slot === "scrub" ? id : prev.career.scrub,
				coat: slot === "coat" ? !prev.career.coat : prev.career.coat,
				accessory: slot === "accessory" ? prev.career.accessory === id ? "none" : id : prev.career.accessory
			}
		}));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "column profile",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "map-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "icon-btn",
					type: "button",
					onClick: onBack,
					"aria-label": "Back",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Profile" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "scroll",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "profile-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocAvatar, {
							career,
							className: "profile-doc"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "name-field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "kicker",
								children: "Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: career.name,
								maxLength: 16,
								onChange: (event) => onChange((prev) => ({
									...prev,
									career: {
										...prev.career,
										name: event.target.value.slice(0, 16)
									}
								}))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "rank-line",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
								rankTitle(career.rank),
								" · Lv ",
								career.rank
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								career.progress,
								"/",
								gap,
								" to next"
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bar",
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${Math.round(career.progress / gap * 100)}%` } })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "rank-note",
							children: "Rank rises after 2 rounds, then every 3, 4, and 3. Matching a high score counts double."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Achievements" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "achieve-grid",
					children: ACHIEVEMENTS.map((item) => {
						const got = career.achievements.includes(item.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: got ? "achieve on" : "achieve",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: item.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: got ? "Earned" : item.hint })]
						}, item.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Cosmetics" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "cosmetic-row",
					children: COSMETICS.map((item) => {
						const open = owned(item.id);
						const on = item.slot === "scrub" && career.scrub === item.id || item.slot === "coat" && career.coat || item.slot === "accessory" && career.accessory === item.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: on ? "chip on" : "chip",
							disabled: !open,
							onClick: () => equip(item.slot, item.id),
							children: [item.label, open ? "" : ` · Lv ${item.need}`]
						}, item.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Scoreboard" }),
				board.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "summary-note",
					children: "Finish a ward to post a score."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "board-list",
					children: board.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: index + 1 }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [row.name, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["Level ", row.id] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: row.score })
					] }, row.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Replay" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "replay-list",
					children: LEVELS.filter((level) => level.id <= save.unlocked).map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "btn secondary",
						onClick: () => onReplay(level.id),
						children: [
							"Level ",
							level.id,
							" · ",
							level.name
						]
					}, level.id))
				})
			]
		})]
	});
}
var ctx = null;
var master = null;
var sfxBus = null;
var musicBus = null;
var step = 0;
var soundOn = true;
var musicOn = true;
var started = false;
var MELODY = [
	523.25,
	587.33,
	659.25,
	783.99,
	659.25,
	587.33,
	523.25,
	392
];
function ensure() {
	if (typeof window === "undefined") return null;
	if (!ctx) {
		ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
		master = ctx.createGain();
		sfxBus = ctx.createGain();
		musicBus = ctx.createGain();
		sfxBus.connect(master);
		musicBus.connect(master);
		master.connect(ctx.destination);
		master.gain.value = 1;
		sfxBus.gain.value = .9;
		musicBus.gain.value = .12;
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible" && ctx && ctx.state === "suspended") ctx.resume();
		});
	}
	return ctx;
}
function unlockAudio() {
	const audio = ensure();
	if (!audio) return;
	if (audio.state === "suspended") audio.resume().then(() => primeBites());
	else primeBites();
	if (!started) {
		started = true;
		setInterval(musicTick, 340);
	}
	applyPrefs();
}
function setAudioPrefs(sound, music) {
	soundOn = sound;
	musicOn = music;
	muteBites(!sound);
	applyPrefs();
}
function applyPrefs() {
	if (!ctx || !sfxBus || !musicBus) return;
	const now = ctx.currentTime;
	sfxBus.gain.setTargetAtTime(soundOn ? .9 : 1e-4, now, .03);
	musicBus.gain.setTargetAtTime(musicOn ? .11 : 1e-4, now, .05);
}
function tone(freq, dur, type, gain, when = 0, slideTo, bus = "sfx") {
	if (!ctx || !sfxBus || !musicBus) return;
	if (bus === "sfx" && !soundOn) return;
	if (bus === "music" && !musicOn) return;
	const t = ctx.currentTime + when;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(Math.max(40, freq), t);
	if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
	amp.gain.setValueAtTime(1e-4, t);
	amp.gain.exponentialRampToValueAtTime(Math.max(2e-4, gain), t + .012);
	amp.gain.exponentialRampToValueAtTime(1e-4, t + dur);
	osc.connect(amp);
	amp.connect(bus === "music" ? musicBus : sfxBus);
	osc.start(t);
	osc.stop(t + dur + .02);
	osc.onended = () => {
		osc.disconnect();
		amp.disconnect();
	};
}
function musicTick() {
	if (!musicOn || !ctx || celebrating) return;
	const freq = MELODY[step % MELODY.length];
	step += 1;
	if (step % 8 === 0) tone(freq / 2, .28, "triangle", .05, 0, void 0, "music");
	tone(freq, .22, "sine", .045, 0, void 0, "music");
}
function bite(src, boost) {
	return {
		src,
		boost,
		el: null,
		gain: null,
		primed: false,
		live: false
	};
}
var wowBite = bite("/sfx/wow.mp3", 2.6);
var faahBite = bite("/sfx/faah.mp3", 2.2);
var bruhBite = bite("/sfx/bruh.mp3", 2.4);
function hookBite(item, audio) {
	if (typeof Audio === "undefined" || !master) return null;
	if (!item.el) {
		const el = new Audio(item.src);
		el.preload = "auto";
		el.muted = true;
		el.volume = 0;
		el.setAttribute("playsinline", "true");
		const source = audio.createMediaElementSource(el);
		const gain = audio.createGain();
		gain.gain.value = 0;
		source.connect(gain);
		gain.connect(master);
		item.el = el;
		item.gain = gain;
	}
	return item.el;
}
function primeBite(item) {
	const audio = ensure();
	if (!audio || item.primed) return;
	const el = hookBite(item, audio);
	if (!el || !item.gain) return;
	item.primed = true;
	el.muted = true;
	el.volume = 0;
	item.gain.gain.setValueAtTime(0, audio.currentTime);
	const pending = el.play();
	const seal = () => {
		if (item.live) return;
		el.pause();
		try {
			el.currentTime = 0;
		} catch {}
	};
	if (!pending) {
		seal();
		return;
	}
	pending.then(seal).catch(() => {
		item.primed = false;
	});
}
function primeBites() {
	primeBite(wowBite);
	primeBite(faahBite);
	primeBite(bruhBite);
}
function muteBites(muted) {
	for (const item of [
		wowBite,
		faahBite,
		bruhBite
	]) if (item.el) item.el.muted = muted;
}
function playBite(item) {
	if (!soundOn) return;
	const audio = ensure();
	if (!audio) return;
	const el = hookBite(item, audio);
	if (!el) return;
	item.live = true;
	const start = () => {
		if (!soundOn || !item.gain) return;
		el.muted = false;
		el.volume = 1;
		item.gain.gain.setValueAtTime(item.boost, audio.currentTime);
		try {
			el.currentTime = 0;
		} catch {}
		el.play().catch(() => {
			audio.resume().then(() => {
				try {
					el.currentTime = 0;
				} catch {}
				el.play().catch(() => {});
			});
		});
	};
	if (audio.state !== "running") {
		audio.resume().then(start);
		return;
	}
	start();
}
function sfxWow() {
	playBite(wowBite);
}
/** The faaah sting. Once a chain reaches seven. */
function sfxFaah() {
	playBite(faahBite);
}
function sfxClick() {
	tone(720, .04, "sine", .05);
}
/** Two candies tumbling past each other. */
function sfxRoll() {
	tone(150, .11, "sine", .12, 0, 480);
	tone(260, .09, "triangle", .08, .05, 130);
	tone(88, .1, "sine", .1, .15);
	tone(360, .06, "triangle", .05, .2);
}
function sfxBad() {
	tone(210, .14, "triangle", .06, 0, 90);
}
function sfxMatch(combo) {
	const base = 480 + combo * 36 + Math.random() * 16;
	tone(base, .1, "triangle", .12);
	tone(base * 1.5, .08, "sine", .05, .02);
	tone(base * 1.25, .12, "sine", .06, .05);
}
/** A chain that has gone past the wow and is still falling. */
function sfxDeep(combo) {
	const base = 140 + combo * 18;
	tone(base, .22, "sawtooth", .045, 0, Math.max(50, base / 2));
	tone(base * 2, .14, "triangle", .07, .06);
	tone(base * 3, .18, "sine", .05, .12, base * 4);
}
function sfxSpecial() {
	[
		523,
		659,
		784,
		1046
	].forEach((freq, i) => tone(freq, .14, "triangle", .08, i * .045));
}
/** A cute summon: low whoosh, then a bright little choir. */
function sfxSummon() {
	tone(98, .32, "triangle", .08, 0, 52);
	tone(196, .22, "sine", .06, .04, 440);
	[
		392,
		494,
		587,
		784,
		988
	].forEach((freq, i) => tone(freq, .16, "triangle", .07, .12 + i * .06));
}
var celebrating = false;
var fanfareTimer = null;
var fanfareStep = 0;
var FANFARE = [
	[
		392,
		523.25,
		659.25
	],
	[
		440,
		554.37,
		659.25
	],
	[
		523.25,
		659.25,
		783.99
	],
	[
		587.33,
		739.99,
		880
	],
	[
		659.25,
		783.99,
		1046.5
	],
	[
		783.99,
		1046.5,
		1318.5
	],
	[
		880,
		1174.7,
		1568
	],
	[
		659.25,
		1046.5,
		1318.5
	]
];
/** A looping celebration tune. Background music pauses until this stops. */
function startCelebration() {
	if (celebrating) return;
	const audio = ensure();
	if (!audio || !soundOn) return;
	celebrating = true;
	const run = () => {
		if (!celebrating || fanfareTimer) return;
		const hit = () => {
			if (!celebrating || !soundOn) return;
			const chord = FANFARE[fanfareStep % FANFARE.length];
			fanfareStep += 1;
			tone(chord[0], .48, "triangle", .12);
			tone(chord[1], .42, "sine", .07, .04);
			tone(chord[2], .5, "sine", .09, .07);
			tone(chord[2] * 2, .2, "triangle", .04, .1);
		};
		hit();
		fanfareTimer = setInterval(hit, 520);
	};
	if (audio.state !== "running") {
		audio.resume().then(run);
		return;
	}
	run();
}
function stopCelebration() {
	celebrating = false;
	if (fanfareTimer) clearInterval(fanfareTimer);
	fanfareTimer = null;
}
function sfxWin() {
	[
		523,
		659,
		784,
		1046,
		784,
		1046,
		1318
	].forEach((freq, i) => tone(freq, .22, "sine", .1, i * .09));
	tone(1568, .4, "triangle", .05, .72);
	tone(1046, .28, "sine", .04, .84, 2093);
}
function sfxLose() {
	playBite(bruhBite);
}
var KEY = "sweet-care-save-v1";
function defaultSave() {
	return {
		version: 1,
		unlocked: 1,
		stars: {},
		best: {},
		times: {},
		sound: true,
		music: true,
		career: defaultCareer()
	};
}
function loadSave() {
	if (typeof window === "undefined") return defaultSave();
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return defaultSave();
		const parsed = JSON.parse(raw);
		if (parsed.version !== 1) return defaultSave();
		return {
			version: 1,
			unlocked: clampLevel(parsed.unlocked ?? 1),
			stars: parsed.stars ?? {},
			best: parsed.best ?? {},
			times: parsed.times ?? {},
			sound: parsed.sound !== false,
			music: parsed.music !== false,
			career: {
				...defaultCareer(),
				...parsed.career,
				achievements: parsed.career?.achievements ?? []
			}
		};
	} catch {
		return defaultSave();
	}
}
function writeSave(save) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(KEY, JSON.stringify(save));
}
function clampLevel(n) {
	if (!Number.isFinite(n)) return 1;
	return Math.max(1, Math.min(15, Math.floor(n)));
}
function continueLevel(save) {
	for (let id = 1; id <= save.unlocked; id++) if ((save.stars[String(id)] ?? 0) < 1) return id;
	for (let id = 1; id <= save.unlocked; id++) if ((save.stars[String(id)] ?? 0) < 3) return id;
	return save.unlocked;
}
function totalStars(save) {
	return Object.values(save.stars).reduce((sum, n) => sum + n, 0);
}
function recordWin(save, levelId, stars, score, timeMs) {
	const next = {
		...save,
		stars: { ...save.stars },
		best: { ...save.best },
		times: { ...save.times }
	};
	const key = String(levelId);
	next.stars[key] = Math.max(next.stars[key] ?? 0, stars);
	next.best[key] = Math.max(next.best[key] ?? 0, score);
	if (timeMs != null && timeMs > 0 && (next.times[key] == null || timeMs < next.times[key])) next.times[key] = timeMs;
	if (levelId >= next.unlocked && levelId < 15) next.unlocked = levelId + 1;
	return next;
}
/** Height-field liquid. A connected match pours one dent in the shape of that group; the wave travels out from the group's edge, not from a ring around each icon. */
var RippleSim = class {
	size;
	cur;
	prev;
	energy = 0;
	constructor(size = 104) {
		this.size = size;
		this.cur = new Float32Array(size * size);
		this.prev = new Float32Array(size * size);
	}
	drop(nx, ny, radius, amp) {
		const { size, cur } = this;
		const cx = nx * (size - 1);
		const cy = ny * (size - 1);
		const r = Math.max(1.4, radius * size);
		const r2 = r * r;
		const x0 = Math.max(1, Math.floor(cx - r));
		const x1 = Math.min(size - 2, Math.ceil(cx + r));
		const y0 = Math.max(1, Math.floor(cy - r));
		const y1 = Math.min(size - 2, Math.ceil(cy + r));
		for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
			const dx = x - cx;
			const dy = y - cy;
			const d2 = dx * dx + dy * dy;
			if (d2 > r2) continue;
			const fall = 1 - d2 / r2;
			cur[y * size + x] = (cur[y * size + x] ?? 0) + amp * fall * fall;
		}
		this.energy = 1;
	}
	/**
	* Same impulse as before: a drop on each connected cell plus a pour along each shared side.
	* Groups smaller than three do not move the gel. Wave speed is the height-field step, unchanged.
	*/
	splash(cells, cols, rows, power, frame = {
		x: 0,
		y: 0,
		w: 1,
		h: 1
	}) {
		if (cols < 1 || rows < 1 || frame.w <= 0 || frame.h <= 0) return;
		const nx = (c) => frame.x + (c + .5) / cols * frame.w;
		const ny = (r) => frame.y + (r + .5) / rows * frame.h;
		for (const group of connectedGroups(cells)) {
			if (group.length < 3) continue;
			const linked = new Set(group.map((cell) => `${cell.r},${cell.c}`));
			for (const cell of group) this.drop(nx(cell.c), ny(cell.r), .06, -1.05 * power);
			for (const cell of group) for (const [dr, dc] of [[0, 1], [1, 0]]) {
				if (!linked.has(`${cell.r + dr},${cell.c + dc}`)) continue;
				for (let t = .2; t <= .8; t += .2) this.drop(nx(cell.c + dc * t), ny(cell.r + dr * t), .038, -.62 * power);
			}
		}
	}
	step() {
		const { size } = this;
		const cur = this.cur;
		const prev = this.prev;
		let peak = 0;
		for (let y = 1; y < size - 1; y++) {
			const row = y * size;
			for (let x = 1; x < size - 1; x++) {
				const i = row + x;
				let next = ((cur[i - 1] + cur[i + 1] + cur[i - size] + cur[i + size]) * .5 - prev[i]) * .988;
				if (next > 1.6) next = 1.6;
				else if (next < -1.6) next = -1.6;
				prev[i] = next;
				const mag = next < 0 ? -next : next;
				if (mag > peak) peak = mag;
			}
		}
		this.cur = prev;
		this.prev = cur;
		this.energy = peak;
	}
	sample(nx, ny) {
		const { size, cur } = this;
		const x = Math.max(0, Math.min(.999, nx)) * (size - 1);
		const y = Math.max(0, Math.min(.999, ny)) * (size - 1);
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const tx = x - x0;
		const ty = y - y0;
		const i = y0 * size + x0;
		const a = cur[i] ?? 0;
		const b = cur[i + 1] ?? 0;
		const c = cur[i + size] ?? 0;
		const d = cur[i + size + 1] ?? 0;
		return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
	}
	grad(nx, ny) {
		const e = 1.6 / this.size;
		return {
			x: this.sample(nx + e, ny) - this.sample(nx - e, ny),
			y: this.sample(nx, ny + e) - this.sample(nx, ny - e)
		};
	}
};
/** Orthogonal clusters only. A diagonal touch is not a connection. */
function connectedGroups(cells) {
	const key = (r, c) => `${r},${c}`;
	const present = new Set(cells.map((cell) => key(cell.r, cell.c)));
	const seen = /* @__PURE__ */ new Set();
	const groups = [];
	for (const cell of cells) {
		const start = key(cell.r, cell.c);
		if (seen.has(start)) continue;
		const group = [];
		const stack = [cell];
		seen.add(start);
		while (stack.length) {
			const cur = stack.pop();
			group.push(cur);
			for (const [dr, dc] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const r = cur.r + dr;
				const c = cur.c + dc;
				const next = key(r, c);
				if (!present.has(next) || seen.has(next)) continue;
				seen.add(next);
				stack.push({
					r,
					c
				});
			}
		}
		groups.push(group);
	}
	return groups;
}
var PALETTE = [
	"#7a4de8",
	"#5b7cff",
	"#3ecf8e",
	"#ff7ad9",
	"#ffb03a",
	"#49b6ff",
	"#c06bff",
	"#ff6b8a",
	"#6d5cff",
	"#45d6c2"
];
function colorFor(r, c) {
	return PALETTE[(r * 3 + c * 5 + (r + c) % 3) % PALETTE.length];
}
function mix(hex, toward, amt) {
	const n = Number.parseInt(hex.slice(1), 16);
	const ch = (shift) => {
		const v = n >> shift & 255;
		return Math.round(v + (toward - v) * amt);
	};
	return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function LiquidBoard({ rows, cols, jelly, revision, scene, frame, apiRef }) {
	const canvasRef = (0, import_react.useRef)(null);
	const jellyRef = (0, import_react.useRef)(jelly);
	jellyRef.current = jelly;
	const simRef = (0, import_react.useRef)(null);
	if (!simRef.current) simRef.current = new RippleSim(104);
	const drawRef = (0, import_react.useRef)(() => {});
	const photoRef = (0, import_react.useRef)(null);
	const frameRef = (0, import_react.useRef)(frame);
	frameRef.current = frame;
	(0, import_react.useLayoutEffect)(() => {
		const photo = new Image();
		photo.decoding = "async";
		photo.src = scene;
		const ready = () => {
			photoRef.current = photo;
			drawRef.current();
		};
		if (photo.complete && photo.naturalWidth) ready();
		else photo.addEventListener("load", ready);
		return () => photo.removeEventListener("load", ready);
	}, [scene]);
	(0, import_react.useLayoutEffect)(() => {
		const canvas = canvasRef.current;
		const sim = simRef.current;
		if (!canvas || !sim) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let alive = true;
		let raf = 0;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const w = Math.max(1, Math.floor(rect.width * dpr));
			const h = Math.max(1, Math.floor(rect.height * dpr));
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
			}
			return rect.width;
		};
		const draw = () => {
			if (resize() < 2) return;
			const w = canvas.width;
			const h = canvas.height;
			const gel = jellyRef.current;
			const frameNow = frameRef.current;
			const gx = frameNow.x * w;
			const gy = frameNow.y * h;
			const gw = Math.max(1, frameNow.w * w);
			const gh = Math.max(1, frameNow.h * h);
			const cw = gw / cols;
			const ch = gh / rows;
			const amp = Math.min(cw, ch) * .28;
			ctx.clearRect(0, 0, w, h);
			const photo = photoRef.current;
			if (photo && photo.naturalWidth > 0) {
				const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
				const dw = photo.naturalWidth * scale;
				const dh = photo.naturalHeight * scale;
				ctx.drawImage(photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
				ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
				ctx.fillRect(0, 0, w, h);
			} else {
				const bg = ctx.createLinearGradient(0, 0, w, h);
				bg.addColorStop(0, "#6a5cf0");
				bg.addColorStop(.48, "#7d4fe2");
				bg.addColorStop(1, "#4f86f2");
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, w, h);
			}
			ctx.save();
			ctx.globalAlpha = .36;
			const wash = ctx.createLinearGradient(0, 0, 0, h);
			wash.addColorStop(0, "rgba(255,255,255,0.34)");
			wash.addColorStop(.42, "rgba(186,236,255,0.1)");
			wash.addColorStop(1, "rgba(90,0,60,0.16)");
			ctx.fillStyle = wash;
			ctx.fillRect(0, 0, w, h);
			for (let i = 0; i < 5; i++) {
				const nx = .12 + i * .18;
				const ny = .2 + i % 2 * .4;
				const wave = sim.grad(nx, ny);
				const px = nx * w + wave.x * 22;
				const py = ny * h + wave.y * 22;
				const gloss = ctx.createRadialGradient(px, py, 6, px, py, Math.min(w, h) * .3);
				gloss.addColorStop(0, "rgba(255,255,255,0.62)");
				gloss.addColorStop(1, "rgba(255,255,255,0)");
				ctx.fillStyle = gloss;
				ctx.beginPath();
				ctx.ellipse(px, py, w * .24, h * .07, -.35, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
			ctx.save();
			ctx.globalAlpha = photo && photo.naturalWidth > 0 ? .42 : 1;
			ctx.filter = `blur(${Math.max(4, cw * .05)}px)`;
			for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
				const cx = gx + (c + .5) * cw;
				const cy = gy + (r + .5) * ch;
				const grow = 1.04 + (r * 3 + c) % 3 * .02;
				const rx = cw * .56 * grow;
				const ry = ch * .56 * grow;
				ctx.beginPath();
				const steps = 28;
				for (let i = 0; i <= steps; i++) {
					const a = i / steps * Math.PI * 2;
					const ct = Math.cos(a);
					const st = Math.sin(a);
					const sx = Math.sign(ct) * Math.abs(ct) ** .55;
					const sy = Math.sign(st) * Math.abs(st) ** .55;
					const px = cx + sx * rx;
					const py = cy + sy * ry;
					const height = sim.sample(px / w, py / h);
					const x = px + sx * height * amp;
					const y = py + sy * height * amp;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				const base = colorFor(r, c);
				const g = ctx.createRadialGradient(cx - rx * .22, cy - ry * .36, rx * .04, cx, cy + ry * .2, rx * 1.05);
				g.addColorStop(0, mix(base, 255, .78));
				g.addColorStop(.28, mix(base, 255, .28));
				g.addColorStop(.62, base);
				g.addColorStop(1, mix(base, 18, .42));
				ctx.fillStyle = g;
				ctx.fill();
			}
			ctx.restore();
			for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
				const cx = gx + (c + .5) * cw;
				const cy = gy + (r + .5) * ch;
				const rx = cw * .48;
				const ry = ch * .48;
				const shine = sim.grad(cx / w, cy / h);
				ctx.save();
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx * .92, ry * .92, 0, 0, Math.PI * 2);
				ctx.clip();
				const gloss = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry * .2);
				gloss.addColorStop(0, "rgba(255,255,255,0.78)");
				gloss.addColorStop(.34, "rgba(255,255,255,0.16)");
				gloss.addColorStop(.52, "rgba(255,255,255,0)");
				gloss.addColorStop(1, "rgba(20, 0, 40, 0.18)");
				ctx.fillStyle = gloss;
				ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
				ctx.fillStyle = "rgba(255,255,255,0.9)";
				ctx.beginPath();
				ctx.ellipse(cx - rx * .28 + shine.x * amp * 1.4, cy - ry * .34 + shine.y * amp * 1.4, rx * .22, ry * .08, -.45, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
				if (gel[r]?.[c]) {
					ctx.strokeStyle = "rgba(170, 255, 214, 0.7)";
					ctx.lineWidth = Math.max(2.5, cw * .04);
					ctx.beginPath();
					ctx.ellipse(cx, cy, rx * .78, ry * .78, 0, .15, Math.PI * 1.2);
					ctx.stroke();
				}
			}
			if (sim.energy > .04) {
				ctx.save();
				ctx.globalCompositeOperation = "screen";
				const stride = 7;
				for (let y = stride; y < sim.size - stride; y += stride) for (let x = stride; x < sim.size - stride; x += stride) {
					const height = sim.cur[y * sim.size + x] ?? 0;
					const mag = Math.abs(height);
					if (mag < .1) continue;
					const px = x / (sim.size - 1) * w;
					const py = y / (sim.size - 1) * h;
					const rad = (.28 + mag * .55) * Math.min(cw, ch);
					const ring = ctx.createRadialGradient(px, py, rad * .15, px, py, rad);
					const alpha = Math.min(.55, mag * .48);
					ring.addColorStop(0, `rgba(255,255,255,${alpha})`);
					ring.addColorStop(.5, `rgba(186, 236, 255, ${alpha * .28})`);
					ring.addColorStop(1, "rgba(255,255,255,0)");
					ctx.fillStyle = ring;
					ctx.beginPath();
					ctx.arc(px, py, rad, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.restore();
			}
		};
		drawRef.current = draw;
		const loop = () => {
			if (!alive) return;
			if (!reduced) {
				sim.step();
				sim.step();
			}
			draw();
			if (reduced || sim.energy < .02) {
				raf = 0;
				return;
			}
			raf = requestAnimationFrame(loop);
		};
		const kick = () => {
			if (!raf && alive) raf = requestAnimationFrame(loop);
		};
		apiRef.current = { splash(cells, power = 1) {
			if (reduced || cells.length === 0) return;
			sim.splash(cells, cols, rows, power, frameRef.current);
			kick();
		} };
		draw();
		return () => {
			alive = false;
			apiRef.current = null;
			if (raf) cancelAnimationFrame(raf);
		};
	}, [
		apiRef,
		cols,
		rows,
		scene
	]);
	(0, import_react.useLayoutEffect)(() => {
		drawRef.current();
	}, [revision]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className: "liquid",
		"aria-hidden": true
	});
}
/** How each candy behaves once it leaves the board. */
var MATERIAL = {
	heart: {
		radius: 13,
		life: 1.35,
		restitution: .72,
		drag: .85,
		gravity: 520,
		mass: .55,
		flutter: 0
	},
	cross: {
		radius: 14,
		life: 1.2,
		restitution: .28,
		drag: .35,
		gravity: 1280,
		mass: 1.45,
		flutter: 0
	},
	pill: {
		radius: 12,
		life: 1.35,
		restitution: .55,
		drag: .45,
		gravity: 860,
		mass: .85,
		flutter: 0
	},
	bandage: {
		radius: 13,
		life: 1.5,
		restitution: .22,
		drag: 1.15,
		gravity: 460,
		mass: .4,
		flutter: 280
	},
	nurse: {
		radius: 13,
		life: 1.55,
		restitution: .4,
		drag: .7,
		gravity: 220,
		mass: .35,
		flutter: 90
	},
	kit: {
		radius: 15,
		life: 1.25,
		restitution: .18,
		drag: .25,
		gravity: 1500,
		mass: 1.8,
		flutter: 0
	},
	teddy: {
		radius: 15,
		life: 1.45,
		restitution: .62,
		drag: .5,
		gravity: 740,
		mass: 1.1,
		flutter: 0
	},
	diaper: {
		radius: 14,
		life: 1.4,
		restitution: .3,
		drag: .9,
		gravity: 520,
		mass: .5,
		flutter: 160
	},
	bottle: {
		radius: 12,
		life: 1.3,
		restitution: .48,
		drag: .4,
		gravity: 980,
		mass: .95,
		flutter: 0
	},
	pacifier: {
		radius: 12,
		life: 1.35,
		restitution: .7,
		drag: .55,
		gravity: 640,
		mass: .45,
		flutter: 40
	},
	gift: {
		radius: 14,
		life: 1.3,
		restitution: .22,
		drag: .35,
		gravity: 1100,
		mass: 1.3,
		flutter: 0
	},
	rattle: {
		radius: 13,
		life: 1.5,
		restitution: .78,
		drag: .42,
		gravity: 700,
		mass: .6,
		flutter: 0
	},
	imp: {
		radius: 12,
		life: 1.7,
		restitution: .86,
		drag: .3,
		gravity: 980,
		mass: .7,
		flutter: 0
	}
};
var ParticleWorld = class {
	bodies = [];
	width = 300;
	height = 600;
	resize(width, height) {
		this.width = Math.max(1, width);
		this.height = Math.max(1, height);
	}
	spawn(kind, x, y, vx, vy, omega = 0) {
		if (this.bodies.length > 96) this.bodies.splice(0, this.bodies.length - 96);
		const spec = MATERIAL[kind];
		this.bodies.push({
			...spec,
			kind,
			x,
			y,
			vx,
			vy,
			angle: 0,
			omega,
			age: 0
		});
	}
	step(dt) {
		const stepDt = Math.min(.033, Math.max(0, dt));
		if (stepDt === 0) return;
		const list = this.bodies;
		for (const body of list) {
			body.age += stepDt;
			const ax = body.flutter ? Math.sin(body.age * 16 + body.omega) * body.flutter : 0;
			body.vx += ax * stepDt;
			body.vy += body.gravity * stepDt;
			const damp = Math.exp(-body.drag * stepDt);
			body.vx *= damp;
			body.vy *= damp;
			body.omega *= Math.exp(-body.drag * .5 * stepDt);
			body.x += body.vx * stepDt;
			body.y += body.vy * stepDt;
			body.angle += body.omega * stepDt;
			this.contain(body);
		}
		const n = list.length;
		for (let i = 0; i < n; i++) {
			const a = list[i];
			for (let j = i + 1; j < n; j++) {
				const b = list[j];
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const min = a.radius + b.radius;
				const dist2 = dx * dx + dy * dy;
				if (dist2 >= min * min || dist2 < 1e-4) continue;
				const dist = Math.sqrt(dist2);
				const nx = dx / dist;
				const ny = dy / dist;
				const overlap = min - dist;
				const share = 1 / (a.mass + b.mass);
				a.x -= nx * overlap * b.mass * share;
				a.y -= ny * overlap * b.mass * share;
				b.x += nx * overlap * a.mass * share;
				b.y += ny * overlap * a.mass * share;
				const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
				if (rel > 0) continue;
				const impulse = -(1 + Math.min(a.restitution, b.restitution)) * rel / (1 / a.mass + 1 / b.mass);
				a.vx -= impulse * nx / a.mass;
				a.vy -= impulse * ny / a.mass;
				b.vx += impulse * nx / b.mass;
				b.vy += impulse * ny / b.mass;
				a.omega += impulse / (a.mass * 40);
				b.omega -= impulse / (b.mass * 40);
			}
		}
		this.bodies = list.filter((body) => body.age < body.life);
	}
	contain(body) {
		const r = body.radius;
		if (body.x < r) {
			body.x = r;
			body.vx = Math.abs(body.vx) * body.restitution;
			body.omega += body.vy * .01;
		} else if (body.x > this.width - r) {
			body.x = this.width - r;
			body.vx = -Math.abs(body.vx) * body.restitution;
			body.omega -= body.vy * .01;
		}
		if (body.y < r) {
			body.y = r;
			body.vy = Math.abs(body.vy) * body.restitution;
		} else if (body.y > this.height - r) {
			body.y = this.height - r;
			if (Math.abs(body.vy) < 40 && Math.abs(body.vx) < 30) {
				body.vy = 0;
				body.vx *= .8;
				body.omega *= .8;
			} else if (body.vy > 0) {
				body.vy = -body.vy * body.restitution;
				body.vx *= .84;
				body.omega = body.vx / Math.max(8, body.radius);
			}
		}
	}
};
var GLOW = {
	heart: "#ff4d6d",
	cross: "#ff3b3b",
	pill: "#4d7dff",
	bandage: "#f0c48a",
	nurse: "#fff6fb",
	kit: "#ff5c7c",
	teddy: "#c4844a",
	diaper: "#8fd4ff",
	bottle: "#ffe08a",
	pacifier: "#ff7ab8",
	gift: "#ff5fa2",
	rattle: "#7aa6ff"
};
var SPRITES = [...KINDS];
function loadSprites() {
	const images = /* @__PURE__ */ new Map();
	for (const kind of SPRITES) {
		const image = new Image();
		image.src = `/sprites/${kind}.png`;
		images.set(kind, image);
	}
	return images;
}
function ParticleLayer({ boardRef, scoreRef, rows, cols, apiRef }) {
	const hostRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useLayoutEffect)(() => {
		const host = hostRef.current;
		const canvas = canvasRef.current;
		if (!host || !canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const world = new ParticleWorld();
		const seekers = [];
		const sprites = loadSprites();
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let alive = true;
		let raf = 0;
		let last = 0;
		const fit = () => {
			const rect = host.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const w = Math.max(1, Math.floor(rect.width * dpr));
			const h = Math.max(1, Math.floor(rect.height * dpr));
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
			}
			world.resize(rect.width, rect.height);
			return rect;
		};
		const pointFor = (r, c) => {
			const board = boardRef.current;
			const hostRect = host.getBoundingClientRect();
			if (!board) return {
				x: hostRect.width / 2,
				y: hostRect.height / 2
			};
			const rect = board.getBoundingClientRect();
			return {
				x: rect.left - hostRect.left + (c + .5) / cols * rect.width,
				y: rect.top - hostRect.top + (r + .5) / rows * rect.height
			};
		};
		const scorePoint = () => {
			const hostRect = host.getBoundingClientRect();
			const score = scoreRef.current;
			if (!score) return {
				x: hostRect.width * .72,
				y: 28
			};
			const rect = score.getBoundingClientRect();
			return {
				x: rect.left - hostRect.left + rect.width / 2,
				y: rect.top - hostRect.top + rect.height / 2
			};
		};
		const drawStar = (x, y, spin) => {
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(spin);
			ctx.fillStyle = "#ffe56a";
			ctx.shadowColor = "#fff1a8";
			ctx.shadowBlur = 12;
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const rad = i % 2 === 0 ? 11 : 4.4;
				const a = -Math.PI / 2 + i * Math.PI / 5;
				const px = Math.cos(a) * rad;
				const py = Math.sin(a) * rad;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		};
		const drawGlow = (x, y, vx, vy, color, age) => {
			const speed = Math.hypot(vx, vy);
			const nx = speed > 1 ? vx / speed : 0;
			const ny = speed > 1 ? vy / speed : -1;
			const trail = ctx.createLinearGradient(x, y, x - nx * 34, y - ny * 34);
			trail.addColorStop(0, color);
			trail.addColorStop(1, "rgba(255,255,255,0)");
			ctx.strokeStyle = trail;
			ctx.lineWidth = 7;
			ctx.lineCap = "round";
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x - nx * 34, y - ny * 34);
			ctx.stroke();
			const pulse = 18 + Math.sin(age * 22) * 2;
			const halo = ctx.createRadialGradient(x, y, 0, x, y, pulse);
			halo.addColorStop(0, "#ffffff");
			halo.addColorStop(.22, "#fffef8");
			halo.addColorStop(.48, color);
			halo.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = halo;
			ctx.beginPath();
			ctx.arc(x, y, pulse, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.arc(x - 3, y - 3, 3.2, 0, Math.PI * 2);
			ctx.fill();
		};
		let onScore = (_points) => {};
		const kick = () => {
			if (!raf && alive) {
				last = performance.now();
				raf = requestAnimationFrame(loop);
			}
		};
		const drawImp = (x, y, angle, alpha) => {
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(angle);
			ctx.scale(1.25, 1.25);
			ctx.globalAlpha = alpha;
			ctx.fillStyle = "#ff4d8d";
			ctx.beginPath();
			ctx.moveTo(-7, -2);
			ctx.lineTo(-3, -16);
			ctx.lineTo(0, -2);
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(7, -2);
			ctx.lineTo(3, -16);
			ctx.lineTo(0, -2);
			ctx.fill();
			const glow = ctx.createRadialGradient(-3, -2, 1, 0, 3, 13);
			glow.addColorStop(0, "#f3d9ff");
			glow.addColorStop(1, "#6d28d9");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(0, 4, 11, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#fff7fb";
			ctx.beginPath();
			ctx.arc(-3.5, 2, 1.7, 0, Math.PI * 2);
			ctx.arc(3.5, 2, 1.7, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		};
		const draw = () => {
			const rect = fit();
			const dpr = canvas.width / Math.max(1, rect.width);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, rect.width, rect.height);
			for (const body of world.bodies) {
				const fade = body.age > body.life * .72 ? 1 - (body.age - body.life * .72) / (body.life * .28) : 1;
				const alpha = Math.max(0, fade);
				if (body.kind === "imp") {
					drawImp(body.x, body.y, body.angle, alpha);
					continue;
				}
				const image = sprites.get(body.kind);
				const size = body.radius * 2.8;
				ctx.save();
				ctx.translate(body.x, body.y);
				ctx.rotate(body.angle);
				ctx.globalAlpha = alpha;
				const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, size * .72);
				glow.addColorStop(0, GLOW[body.kind]);
				glow.addColorStop(1, "rgba(255,255,255,0)");
				ctx.fillStyle = glow;
				ctx.beginPath();
				ctx.arc(0, 0, size * .72, 0, Math.PI * 2);
				ctx.fill();
				if (image && image.complete && image.naturalWidth > 0) ctx.drawImage(image, -size / 2, -size / 2, size, size);
				ctx.restore();
			}
			for (const spark of seekers) if (spark.star) drawStar(spark.x, spark.y, spark.age * 8);
			else if (spark.flash) {
				const t = Math.min(1, spark.age / .32);
				ctx.save();
				ctx.globalAlpha = 1 - t;
				ctx.strokeStyle = spark.color;
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(spark.x, spark.y, 8 + t * 26, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			} else drawGlow(spark.x, spark.y, spark.vx, spark.vy, spark.color, spark.age);
		};
		const loop = (now) => {
			if (!alive) return;
			const dt = Math.min(.05, (now - last) / 1e3 || .016);
			last = now;
			world.step(dt);
			const goal = scorePoint();
			for (let i = seekers.length - 1; i >= 0; i--) {
				const spark = seekers[i];
				spark.age += dt;
				if (spark.homing) {
					const dx = goal.x - spark.x;
					const dy = goal.y - spark.y;
					const dist = Math.hypot(dx, dy) || 1;
					if (dist < 26 || spark.age > .85) {
						if (spark.points > 0) onScore(spark.points);
						seekers.push({
							x: goal.x,
							y: goal.y,
							vx: 0,
							vy: 0,
							color: spark.color,
							points: 0,
							homing: false,
							star: false,
							flash: true,
							age: 0
						});
						seekers.splice(i, 1);
						continue;
					}
					spark.vx += dx / dist * 5200 * dt;
					spark.vy += dy / dist * 5200 * dt;
					const speed = Math.hypot(spark.vx, spark.vy) || 1;
					const max = 1680;
					if (speed > max) {
						spark.vx = spark.vx / speed * max;
						spark.vy = spark.vy / speed * max;
					}
				} else if (spark.flash) {
					if (spark.age > .32) {
						seekers.splice(i, 1);
						continue;
					}
				} else {
					spark.vy += 420 * dt;
					spark.vx *= .985;
					if (spark.age > .85) {
						seekers.splice(i, 1);
						continue;
					}
				}
				spark.x += spark.vx * dt;
				spark.y += spark.vy * dt;
			}
			draw();
			if (world.bodies.length === 0 && seekers.length === 0) {
				raf = 0;
				return;
			}
			raf = requestAnimationFrame(loop);
		};
		apiRef.current = {
			burst(cells) {
				if (reduced || cells.length === 0) return;
				fit();
				for (const cell of cells.slice(0, 12)) {
					const origin = pointFor(cell.r, cell.c);
					const kind = cell.kind;
					for (let i = 0; i < 6; i++) {
						const angle = Math.PI * 2 * i / 6 + i * .18;
						const speed = 240 + i % 3 * 110;
						world.spawn(kind, origin.x, origin.y, Math.cos(angle) * speed, Math.sin(angle) * speed - 160, (i % 2 === 0 ? 11 : -11) + (kind === "pill" ? 8 : 0));
					}
				}
				kick();
			},
			summon(cells, count = 6) {
				if (reduced || cells.length === 0) return;
				fit();
				for (let i = 0; i < count; i++) {
					const cell = cells[i % cells.length];
					const origin = pointFor(cell.r, cell.c);
					world.spawn("imp", origin.x + (i - count / 2) * 10, origin.y, (i - (count - 1) / 2) * 70, -460 - i % 3 * 80, i % 2 === 0 ? 4 : -4);
				}
				kick();
			},
			rain() {
				if (reduced) return;
				const rect = fit();
				const kinds = [...KINDS];
				for (let i = 0; i < 40; i++) {
					const kind = kinds[i % kinds.length];
					world.spawn(kind, rect.width * (i + .5) / 40, -24 - i % 6 * 18, i % 2 === 0 ? 70 : -70, 40 + i % 4 * 50, i % 2 === 0 ? 8 : -8);
				}
				kick();
			},
			scoreFly(feeds, arrive) {
				if (feeds.length === 0) return;
				onScore = arrive;
				if (reduced) {
					for (const feed of feeds) if (feed.points > 0) arrive(feed.points);
					return;
				}
				fit();
				const goal = scorePoint();
				for (const feed of feeds) {
					if (feed.points <= 0) continue;
					const origin = pointFor(feed.r, feed.c);
					const count = Math.min(6, feed.points);
					const share = Math.floor(feed.points / count);
					let rest = feed.points - share * count;
					const dx = goal.x - origin.x;
					const dy = goal.y - origin.y;
					const dist = Math.hypot(dx, dy) || 1;
					for (let i = 0; i < count; i++) {
						const points = share + (rest > 0 ? 1 : 0);
						if (rest > 0) rest -= 1;
						const kick = 640 + i * 110;
						seekers.push({
							x: origin.x + (i - (count - 1) / 2) * 8,
							y: origin.y + i % 2 * 7,
							vx: dx / dist * kick + (i - (count - 1) / 2) * 36,
							vy: dy / dist * kick - 30,
							color: GLOW[feed.kind],
							points,
							homing: true,
							star: false,
							flash: false,
							age: 0
						});
					}
				}
				kick();
			},
			stars() {
				if (reduced) return;
				fit();
				const board = boardRef.current;
				const hostRect = host.getBoundingClientRect();
				const rect = board?.getBoundingClientRect();
				const cx = rect ? rect.left - hostRect.left + rect.width / 2 : hostRect.width / 2;
				const cy = rect ? rect.top - hostRect.top + rect.height / 2 : hostRect.height / 2;
				for (let i = 0; i < 22; i++) {
					const angle = Math.PI * 2 * i / 22;
					const speed = 260 + i % 5 * 70;
					seekers.push({
						x: cx,
						y: cy,
						vx: Math.cos(angle) * speed,
						vy: Math.sin(angle) * speed - 80,
						color: "#ffe56a",
						points: 0,
						homing: false,
						star: true,
						flash: false,
						age: 0
					});
				}
				kick();
			}
		};
		return () => {
			alive = false;
			apiRef.current = null;
			if (raf) cancelAnimationFrame(raf);
		};
	}, [
		apiRef,
		boardRef,
		cols,
		rows,
		scoreRef
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "particle-host",
		ref: hostRef,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
			ref: canvasRef,
			className: "particle-field",
			"aria-hidden": true
		})
	});
}
/** Cascades that launch score orbs. */
var ORB_STREAKS = /* @__PURE__ */ new Set([
	3,
	5,
	7,
	8,
	10,
	12,
	15
]);
function splitScore(cells, board, gained) {
	const picked = cells.slice(0, 8);
	if (picked.length === 0 || gained <= 0) return [];
	const share = Math.floor(gained / picked.length);
	let rest = gained - share * picked.length;
	return picked.map((cell) => {
		const points = share + rest;
		rest = 0;
		return {
			r: cell.r,
			c: cell.c,
			kind: board[cell.r]?.[cell.c]?.kind ?? "heart",
			points
		};
	});
}
var COLS = 6;
function formatClock(ms) {
	const total = Math.max(0, Math.round(ms / 1e3));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function reducedMotion() {
	return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function wait(ms) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function frames(count) {
	return new Promise((resolve) => {
		let left = count;
		const step = () => {
			left -= 1;
			if (left <= 0) resolve();
			else requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	});
}
function readView(board, dying, born, lift) {
	const view = [];
	for (let r = 0; r < board.length; r++) for (let c = 0; c < board[0].length; c++) {
		const tile = board[r][c];
		if (!tile) continue;
		view.push({
			id: tile.id,
			kind: tile.kind,
			special: tile.special,
			r: lift?.get(tile.id) ?? r,
			c,
			dying: dying.has(tile.id),
			born: born.has(tile.id)
		});
	}
	return view;
}
function liftAll(board, delta) {
	const lift = /* @__PURE__ */ new Map();
	for (let r = 0; r < board.length; r++) for (let c = 0; c < board[0].length; c++) {
		const tile = board[r][c];
		if (tile) lift.set(tile.id, r + delta);
	}
	return lift;
}
function exchange(model, a, b) {
	const first = model.view.find((tile) => tile.r === a.r && tile.c === a.c && !tile.dying);
	const second = model.view.find((tile) => tile.r === b.r && tile.c === b.c && !tile.dying);
	if (!first || !second) return;
	const r = first.r;
	const c = first.c;
	first.r = second.r;
	first.c = second.c;
	second.r = r;
	second.c = c;
}
function plantRainbow(model) {
	for (const row of model.board) for (const tile of row) if (tile && tile.special !== "rainbow") {
		tile.special = "rainbow";
		return;
	}
}
function spriteFor(tile) {
	return tile.special === "rainbow" ? "/sprites/rainbow.png" : `/sprites/${tile.kind}.png`;
}
function SweetCare() {
	const modelRef = (0, import_react.useRef)(null);
	const runRef = (0, import_react.useRef)(0);
	const hintRef = (0, import_react.useRef)(null);
	const shuffles = (0, import_react.useRef)(0);
	const seq = (0, import_react.useRef)(1);
	const drag = (0, import_react.useRef)(null);
	const boardRef = (0, import_react.useRef)(null);
	const slotRef = (0, import_react.useRef)(null);
	const liquidRef = (0, import_react.useRef)(null);
	const particleRef = (0, import_react.useRef)(null);
	const curtainTimers = (0, import_react.useRef)([]);
	const diskRef = (0, import_react.useRef)(defaultSave());
	const [screen, setScreen] = (0, import_react.useState)("home");
	const [save, setSave] = (0, import_react.useState)(defaultSave);
	const [tick, setTick] = (0, import_react.useState)(0);
	const [side, setSide] = (0, import_react.useState)(300);
	const [cell, setCell] = (0, import_react.useState)(36);
	const [frame, setFrame] = (0, import_react.useState)({
		x: 0,
		y: 0,
		w: 1,
		h: 1
	});
	const [journeyId, setJourneyId] = (0, import_react.useState)(1);
	const saveRef = (0, import_react.useRef)(save);
	saveRef.current = save;
	const bump = () => setTick((n) => n + 1);
	const renderNow = () => (0, import_react_dom.flushSync)(() => setTick((n) => n + 1));
	(0, import_react.useEffect)(() => {
		const loaded = loadSave();
		diskRef.current = loaded;
		setSave(loaded);
		setAudioPrefs(loaded.sound, loaded.music);
	}, []);
	(0, import_react.useEffect)(() => {
		return () => {
			curtainTimers.current.forEach((id) => window.clearTimeout(id));
			stopCelebration();
		};
	}, []);
	(0, import_react.useLayoutEffect)(() => {
		if (screen !== "play") return;
		const slot = slotRef.current;
		if (!slot) return;
		const apply = () => {
			const rect = slot.getBoundingClientRect();
			const next = Math.max(160, Math.floor(Math.min(rect.width, rect.height)));
			setSide(next);
			const width = Math.max(1, rect.width);
			const height = Math.max(1, rect.height);
			setFrame({
				x: (width - next) / 2 / width,
				y: (height - next) / 2 / height,
				w: next / width,
				h: next / height
			});
		};
		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(slot);
		return () => observer.disconnect();
	}, [screen]);
	(0, import_react.useLayoutEffect)(() => {
		if (screen !== "play") return;
		const board = boardRef.current;
		if (!board) return;
		setCell(board.clientWidth / COLS);
	}, [
		screen,
		side,
		tick
	]);
	function clearHint() {
		if (hintRef.current) window.clearTimeout(hintRef.current);
		hintRef.current = null;
	}
	function scheduleHint() {
		clearHint();
		hintRef.current = window.setTimeout(() => {
			const model = modelRef.current;
			if (!model || model.phase !== "idle" || model.outcome) return;
			model.hint = findHint(model.board);
			bump();
		}, 7e3);
	}
	function patchSave(recipe, kind = "session") {
		setSave((prev) => {
			const next = recipe(prev);
			if (kind === "checkpoint") {
				diskRef.current = next;
				writeSave(next);
			} else if (kind === "settings") {
				const disk = diskRef.current;
				const stored = {
					...disk,
					sound: next.sound,
					music: next.music,
					career: {
						...disk.career,
						name: next.career.name,
						scrub: next.career.scrub,
						coat: next.career.coat,
						accessory: next.career.accessory
					}
				};
				diskRef.current = stored;
				writeSave(stored);
			}
			return next;
		});
	}
	function clearCurtain() {
		curtainTimers.current.forEach((id) => window.clearTimeout(id));
		curtainTimers.current = [];
	}
	function advanceCurtain() {
		const current = modelRef.current;
		if (!current?.outcome || current.curtain === "next") return;
		current.curtain = "next";
		stopCelebration();
		bump();
	}
	function toggleSound() {
		unlockAudio();
		sfxClick();
		patchSave((prev) => {
			const next = {
				...prev,
				sound: !prev.sound
			};
			setAudioPrefs(next.sound, next.music);
			return next;
		}, "settings");
	}
	function openProfile() {
		setScreen("profile");
	}
	function closeProfile() {
		setScreen(modelRef.current ? "play" : "home");
	}
	async function deal(run) {
		const beats = reducedMotion() ? [] : [
			"Ready",
			"3",
			"2",
			"1"
		];
		if (!reducedMotion()) {
			await frames(2);
			const opening = modelRef.current;
			if (!opening || runRef.current !== run) return;
			opening.animate = true;
			opening.view = readView(opening.board, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
			bump();
		}
		for (const beat of beats) {
			const model = modelRef.current;
			if (!model || runRef.current !== run) return;
			model.countdown = beat;
			sfxClick();
			bump();
			await wait(beat === "Ready" ? 720 : 640);
		}
		const model = modelRef.current;
		if (!model || runRef.current !== run) return;
		model.countdown = null;
		model.view = readView(model.board, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
		model.animate = true;
		model.phase = "idle";
		scheduleHint();
		bump();
	}
	function startLevel(id) {
		unlockAudio();
		sfxClick();
		clearHint();
		clearCurtain();
		stopCelebration();
		const run = ++runRef.current;
		shuffles.current = 0;
		const level = getLevel(id);
		const rng = mulberry32((Date.now() ^ id * 9973) >>> 0);
		const board = createBoard(rng, level.rows, level.cols, level.kinds);
		const jelly = makeJelly(level);
		const model = {
			level,
			board,
			jelly,
			jellyTotal: countJelly(jelly),
			rng,
			score: 0,
			moves: level.moves,
			collected: freshCollected(),
			boosters: {
				blast: 1,
				stripe: 1,
				aid: 1
			},
			phase: "busy",
			selected: null,
			hint: null,
			outcome: null,
			stars: 0,
			banner: null,
			floats: [],
			rolls: [],
			flash: null,
			countdown: null,
			dive: 0,
			assist: level.id >= 3,
			form: 0,
			startedAt: Date.now(),
			maxCombo: 0,
			elapsed: 0,
			badges: [],
			rankedUp: false,
			curtain: "cheer",
			savedNow: false,
			shake: false,
			animate: false,
			view: []
		};
		model.view = readView(board, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), reducedMotion() ? void 0 : liftAll(board, -level.rows));
		modelRef.current = model;
		(0, import_react_dom.flushSync)(() => {
			setScreen("play");
			setTick((n) => n + 1);
		});
		deal(run);
	}
	function openLevel(id) {
		if (journeyFor(id)) {
			setJourneyId(id);
			setScreen("journey");
			return;
		}
		startLevel(id);
	}
	function leavePlay() {
		runRef.current += 1;
		clearHint();
		clearCurtain();
		stopCelebration();
		modelRef.current = null;
		setScreen("map");
	}
	function goHome() {
		runRef.current += 1;
		clearHint();
		clearCurtain();
		stopCelebration();
		modelRef.current = null;
		setScreen("home");
	}
	function summonImps(model, cells, count, quiet = false) {
		model.flash = "summon";
		if (!quiet) sfxSummon();
		liquidRef.current?.splash(cells, 1.45);
		particleRef.current?.summon(cells, count);
		window.setTimeout(() => {
			const current = modelRef.current;
			if (!current) return;
			if (current.flash === "summon") current.flash = null;
			bump();
		}, 1e3);
	}
	async function playPlan(run, plan) {
		const model = modelRef.current;
		if (!model || runRef.current !== run) return;
		const jellyBroken = breakJelly(model.jelly, plan.removals);
		const gained = plan.score + jellyBroken * 40;
		for (const kind of KINDS) model.collected[kind] += plan.collected[kind];
		const feeds = plan.feeds.map((feed) => ({ ...feed }));
		if (feeds.length > 0) feeds[0].points += jellyBroken * 40;
		if (!(ORB_STREAKS.has(plan.combo) && gained > 0) || reducedMotion() || !particleRef.current) model.score += gained;
		else {
			const sources = feeds.some((feed) => feed.points > 0) ? feeds : splitScore(plan.removals, model.board, gained);
			if (sources.length === 0) model.score += gained;
			else particleRef.current.scoreFly(sources, (points) => {
				const current = modelRef.current;
				if (!current) return;
				current.score += points;
				bump();
			});
		}
		const painted = paintSpecials(model.board, plan);
		liquidRef.current?.splash(plan.removals, Math.min(2.4, .85 + plan.combo * .22));
		model.view = readView(model.board, new Set(painted.dyingIds), new Set(painted.bornIds));
		model.animate = true;
		model.rolls = [];
		model.banner = plan.banner;
		model.dive = plan.combo;
		model.shake = plan.removals.length >= 8 || plan.combo >= 6;
		const center = centroid(plan.removals);
		const floatId = ++seq.current;
		model.floats = [...model.floats.slice(-4), {
			id: floatId,
			text: `+${gained}`,
			r: center.r,
			c: center.c
		}];
		const bits = plan.removals.slice(0, 12).flatMap((cell) => {
			const kind = model.board[cell.r]?.[cell.c]?.kind;
			return kind ? [{
				r: cell.r,
				c: cell.c,
				kind
			}] : [];
		});
		if (bits.length > 0) particleRef.current?.burst(bits);
		const summoned = plan.spawns.filter((spawn) => spawn.special === "bomb" || spawn.special === "rainbow");
		if (summoned.length > 0) summonImps(model, summoned, 8, plan.combo === 7);
		else if (plan.combo === 7) {} else if (plan.combo >= 6) sfxDeep(plan.combo);
		else if (plan.spawns.length > 0 || plan.banner && plan.combo < 2) sfxSpecial();
		else sfxMatch(plan.combo);
		bump();
		window.setTimeout(() => {
			const current = modelRef.current;
			if (!current) return;
			current.floats = current.floats.filter((item) => item.id !== floatId);
			if (current.banner === plan.banner) current.banner = null;
			bump();
		}, plan.banner === "Wow!" || plan.banner === "Faaah!" ? 1700 : 720);
		await wait(reducedMotion() ? 40 : 250);
		if (runRef.current !== run || !modelRef.current) return;
		const pre = /* @__PURE__ */ new Map();
		for (let r = 0; r < model.board.length; r++) for (let c = 0; c < model.board[0].length; c++) {
			const tile = model.board[r][c];
			if (tile) pre.set(tile.id, r);
		}
		eraseIds(model.board, painted.dyingIds);
		const spent = model.assist;
		const fell = collapse(model.board, model.rng, model.level.kinds, diveFavor(model.level.id, spent));
		if (spent) model.assist = false;
		model.board = fell.board;
		const lift = /* @__PURE__ */ new Map();
		const born = /* @__PURE__ */ new Set();
		for (const spawn of fell.spawned) {
			lift.set(spawn.id, spawn.fromR);
			born.add(spawn.id);
		}
		for (let r = 0; r < model.board.length; r++) for (let c = 0; c < model.board[0].length; c++) {
			const tile = model.board[r][c];
			if (!tile || born.has(tile.id)) continue;
			const from = pre.get(tile.id);
			if (from !== void 0 && from !== r) lift.set(tile.id, from);
		}
		model.animate = false;
		model.shake = false;
		model.view = readView(model.board, /* @__PURE__ */ new Set(), born, reducedMotion() ? void 0 : lift);
		renderNow();
		await frames(2);
		if (runRef.current !== run || !modelRef.current) return;
		model.animate = true;
		model.view = readView(model.board, /* @__PURE__ */ new Set(), born);
		bump();
		await wait(reducedMotion() ? 40 : 320);
	}
	function closeRound(model, won, elapsed) {
		const prev = saveRef.current;
		const key = String(model.level.id);
		const destroyed = KINDS.reduce((sum, kind) => sum + model.collected[kind], 0);
		const already = (prev.stars[key] ?? 0) > 0;
		const cleared = Object.values(prev.stars).filter((n) => n > 0).length + (won && !already ? 1 : 0);
		const applied = applyRound(prev.career, {
			won,
			score: model.score,
			prevBest: prev.best[key] ?? 0,
			stars: model.stars,
			maxCombo: model.maxCombo,
			levelId: model.level.id,
			destroyed,
			timeRecord: won && (prev.times[key] == null || elapsed < prev.times[key]),
			elapsed
		}, cleared);
		model.rankedUp = applied.rankedUp;
		model.savedNow = won && model.level.id % 5 === 0;
		patchSave((current) => {
			return {
				...won ? recordWin(current, model.level.id, model.stars, model.score, elapsed) : current,
				career: applied.career
			};
		}, model.savedNow ? "checkpoint" : "session");
	}
	async function finish(run) {
		const model = modelRef.current;
		if (!model || runRef.current !== run || model.outcome) return;
		const progress = {
			score: model.score,
			collected: model.collected,
			jellyLeft: countJelly(model.jelly)
		};
		if (goalsMet(model.level, progress)) {
			const bonus = model.moves * 100;
			if (bonus > 0) {
				model.score += bonus;
				model.banner = `+${bonus} move bonus`;
			}
			const elapsed = Math.max(0, Date.now() - model.startedAt);
			const key = String(model.level.id);
			const prev = saveRef.current;
			const badges = [];
			if (model.maxCombo >= 5) badges.push({
				id: "streak",
				label: "5 streak"
			});
			if (model.score > (prev.best[key] ?? 0)) badges.push({
				id: "score",
				label: "High score"
			});
			if (prev.times[key] == null || elapsed < prev.times[key]) badges.push({
				id: "time",
				label: "Time record"
			});
			model.elapsed = elapsed;
			model.badges = badges;
			model.stars = starsFor(model.level, model.score, true);
			model.outcome = "win";
			model.phase = "idle";
			model.flash = "win";
			model.curtain = "card";
			particleRef.current?.rain();
			particleRef.current?.stars();
			unlockAudio();
			sfxWin();
			startCelebration();
			closeRound(model, true, elapsed);
			bump();
			return;
		}
		if (model.moves <= 0) {
			model.elapsed = Math.max(0, Date.now() - model.startedAt);
			model.badges = model.maxCombo >= 5 ? [{
				id: "streak",
				label: "5 streak"
			}] : [];
			model.outcome = "lose";
			model.curtain = "card";
			model.phase = "idle";
			sfxLose();
			closeRound(model, false, model.elapsed);
			bump();
			return;
		}
		if (!hasMove(model.board)) {
			if (shuffles.current >= 2) {
				plantRainbow(model);
				shuffles.current = 0;
				model.view = readView(model.board, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
			} else {
				shuffles.current += 1;
				model.banner = "Reshuffle!";
				model.board = shuffleBoard(model.board, model.rng);
				model.view = readView(model.board, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
				model.animate = true;
				bump();
				await wait(260);
				if (runRef.current !== run || !modelRef.current) return;
				const follow = planFromMatches(modelRef.current.board, 1);
				if (follow) {
					await runClears(run, follow, 1);
					return;
				}
			}
		} else shuffles.current = 0;
		model.phase = "idle";
		model.selected = null;
		scheduleHint();
		bump();
	}
	async function runClears(run, first, comboStart) {
		let combo = comboStart;
		let plan = first;
		let celebrated = false;
		let yelled = false;
		let step = 0;
		while (plan && runRef.current === run) {
			step += 1;
			const depth = Math.max(step, plan.combo);
			if (depth >= 7 && !yelled) {
				yelled = true;
				celebrated = true;
				plan.banner = "Faaah!";
				unlockAudio();
				sfxFaah();
			} else if (depth >= 5 && !celebrated) {
				celebrated = true;
				plan.banner = "Wow!";
				unlockAudio();
				sfxWow();
				particleRef.current?.stars();
			}
			const current = modelRef.current;
			if (current) current.maxCombo = Math.max(current.maxCombo, Math.max(step, plan.combo));
			await playPlan(run, plan);
			if (runRef.current !== run || !modelRef.current) return;
			combo += 1;
			plan = planFromMatches(modelRef.current.board, combo);
		}
		if (modelRef.current && runRef.current === run) {
			modelRef.current.dive = 0;
			bump();
		}
		await finish(run);
	}
	async function playSwap(a, b) {
		const model = modelRef.current;
		if (!model || model.phase !== "idle" || model.outcome || model.moves <= 0) return;
		if (!adjacent(a, b)) return;
		const run = runRef.current;
		unlockAudio();
		clearHint();
		model.hint = null;
		model.selected = null;
		model.phase = "busy";
		model.animate = true;
		exchange(model, a, b);
		const there = model.view.find((tile) => tile.r === b.r && tile.c === b.c && !tile.dying);
		const back = model.view.find((tile) => tile.r === a.r && tile.c === a.c && !tile.dying);
		model.rolls = [there ? {
			id: there.id,
			dir: 1
		} : null, back ? {
			id: back.id,
			dir: -1
		} : null].filter((roll) => roll !== null);
		bump();
		sfxRoll();
		await wait(reducedMotion() ? 40 : 320);
		if (runRef.current !== run || !modelRef.current) return;
		if (!commitSwap(model.board, a, b)) {
			exchange(model, a, b);
			const backThere = model.view.find((tile) => tile.r === b.r && tile.c === b.c && !tile.dying);
			const backBack = model.view.find((tile) => tile.r === a.r && tile.c === a.c && !tile.dying);
			model.rolls = [backThere ? {
				id: backThere.id,
				dir: -1
			} : null, backBack ? {
				id: backBack.id,
				dir: 1
			} : null].filter((roll) => roll !== null);
			sfxRoll();
			sfxBad();
			model.form = 0;
			bump();
			await wait(reducedMotion() ? 40 : 280);
			if (runRef.current !== run || !modelRef.current) return;
			modelRef.current.phase = "idle";
			modelRef.current.rolls = [];
			scheduleHint();
			bump();
			return;
		}
		model.moves -= 1;
		model.rolls = [];
		if (model.level.id >= 3 && !model.assist) {
			model.form += 1;
			if (model.form >= 2) {
				model.assist = true;
				model.form = 0;
			}
		}
		bump();
		await runClears(run, planAfterSwap(model.board, a, b, 1), 1);
	}
	function handleTap(pos) {
		const model = modelRef.current;
		if (!model || model.outcome) return;
		unlockAudio();
		if (model.phase === "aim-blast") {
			if (model.boosters.blast <= 0) return;
			const plan = planCross(model.board, pos);
			if (!plan) return;
			model.boosters.blast -= 1;
			model.phase = "busy";
			model.selected = null;
			clearHint();
			runClears(runRef.current, plan, 1);
			return;
		}
		if (model.phase === "aim-stripe") {
			const tile = model.board[pos.r]?.[pos.c];
			if (!tile || model.boosters.stripe <= 0) return;
			model.boosters.stripe -= 1;
			upgradeSpecial(tile, pos.c);
			model.phase = "idle";
			model.view = readView(model.board, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set([tile.id]));
			sfxSpecial();
			bump();
			return;
		}
		if (model.phase !== "idle") return;
		const selected = model.selected;
		if (!selected) {
			model.selected = pos;
			bump();
			return;
		}
		if (selected.r === pos.r && selected.c === pos.c) {
			model.selected = null;
			bump();
			return;
		}
		if (adjacent(selected, pos)) {
			playSwap(selected, pos);
			return;
		}
		model.selected = pos;
		bump();
	}
	function cancelAim() {
		const current = modelRef.current;
		if (!current) return;
		current.phase = "idle";
		bump();
	}
	function useAid() {
		const model = modelRef.current;
		if (!model || model.phase === "busy" || model.outcome || model.boosters.aid <= 0) return;
		unlockAudio();
		model.boosters.aid -= 1;
		model.moves += 5;
		model.banner = "Summoned!";
		model.phase = "idle";
		const mid = {
			r: Math.floor((model.level.rows - 1) / 2),
			c: Math.floor((model.level.cols - 1) / 2)
		};
		summonImps(model, [
			mid,
			{
				r: mid.r,
				c: Math.max(0, mid.c - 1)
			},
			{
				r: mid.r,
				c: Math.min(model.level.cols - 1, mid.c + 1)
			}
		], 9);
		bump();
		window.setTimeout(() => {
			const current = modelRef.current;
			if (current?.banner === "Summoned!") current.banner = null;
			bump();
		}, 900);
	}
	function arm(which) {
		const model = modelRef.current;
		if (!model || model.phase === "busy" || model.outcome) return;
		if (model.boosters[which] <= 0) return;
		unlockAudio();
		sfxClick();
		const next = which === "blast" ? "aim-blast" : "aim-stripe";
		model.phase = model.phase === next ? "idle" : next;
		model.selected = null;
		bump();
	}
	function cellFromEvent(event) {
		const board = boardRef.current;
		const model = modelRef.current;
		if (!board || !model) return null;
		const rect = board.getBoundingClientRect();
		const c = Math.floor((event.clientX - rect.left) / rect.width * COLS);
		const r = Math.floor((event.clientY - rect.top) / rect.height * COLS);
		if (r < 0 || c < 0 || r >= COLS || c >= COLS) return null;
		return {
			r,
			c
		};
	}
	const model = modelRef.current;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: screen === "play" && model ? "app play-mode" : "app",
		style: screen === "play" && model ? { ["--scene"]: `url(/scenes/${String(model.level.id).padStart(2, "0")}.jpg)` } : void 0,
		children: [
			screen === "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Home$1, {
				save,
				onPlay: () => openLevel(continueLevel(save)),
				onMap: () => {
					sfxClick();
					setScreen("map");
				},
				onHelp: () => {
					sfxClick();
					setScreen("help");
				},
				onSound: toggleSound,
				onProfile: openProfile
			}) : null,
			screen === "map" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapScreen, {
				save,
				onBack: () => setScreen("home"),
				onPick: (id) => openLevel(id)
			}) : null,
			screen === "help" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Help, { onBack: () => setScreen("home") }) : null,
			screen === "profile" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileScreen, {
				save,
				onBack: closeProfile,
				onReplay: (id) => openLevel(id),
				onChange: (recipe) => patchSave(recipe, "settings")
			}) : null,
			screen === "journey" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Journey, {
				levelId: journeyId,
				onArrive: () => startLevel(journeyId)
			}) : null,
			screen === "play" && model ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
				model,
				save,
				side,
				cell,
				slotRef,
				frame,
				boardRef,
				liquidRef,
				particleRef,
				onBack: leavePlay,
				onSound: toggleSound,
				onProfile: openProfile,
				onAid: useAid,
				onCancel: cancelAim,
				onArm: arm,
				onAdvance: advanceCurtain,
				onRetry: () => startLevel(model.level.id),
				onNext: () => openLevel(model.level.id + 1),
				onHome: goHome,
				onPointerDown: (event) => {
					if (event.button !== 0) return;
					const current = modelRef.current;
					if (!current || current.phase !== "idle" || current.outcome) return;
					unlockAudio();
					const pos = cellFromEvent(event);
					if (!pos) return;
					drag.current = {
						p: pos,
						x: event.clientX,
						y: event.clientY
					};
					event.currentTarget.setPointerCapture(event.pointerId);
				},
				onPointerMove: (event) => {
					const start = drag.current;
					const current = modelRef.current;
					if (!start || !current || current.phase !== "idle" || current.outcome) return;
					const dx = event.clientX - start.x;
					const dy = event.clientY - start.y;
					if (Math.hypot(dx, dy) < 16) return;
					drag.current = null;
					const next = Math.abs(dx) > Math.abs(dy) ? {
						r: start.p.r,
						c: start.p.c + Math.sign(dx)
					} : {
						r: start.p.r + Math.sign(dy),
						c: start.p.c
					};
					if (next.r < 0 || next.c < 0 || next.r >= COLS || next.c >= COLS) return;
					playSwap(start.p, next);
				},
				onPointerUp: () => {
					const start = drag.current;
					drag.current = null;
					if (!start) return;
					handleTap(start.p);
				}
			}) : null
		]
	});
}
function Home$1({ save, onPlay, onMap, onHelp, onSound, onProfile }) {
	const next = continueLevel(save);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "column home",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "crush-nav",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "icon-btn",
					type: "button",
					onClick: onSound,
					"aria-label": save.sound ? "Mute sound" : "Sound on",
					children: save.sound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					className: "header-title",
					src: "/ui/crush-title.png",
					alt: "Sweet Care Crush"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "avatar-btn",
					type: "button",
					onClick: onProfile,
					"aria-label": `${save.career.name} profile`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocAvatar, { career: save.career })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "scroll",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "tagline",
					children: "Match the sweets. Mend the ward."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "star-total home-stars",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, {
							className: "star on",
							"aria-hidden": true
						}),
						totalStars(save),
						"/45"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "hero-row",
					"aria-hidden": true,
					children: HOSPITAL_KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: `/sprites/${kind}.png`,
						alt: ""
					}, kind))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "stack",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "btn",
							type: "button",
							onClick: onPlay,
							children: ["Play level ", next]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "btn secondary",
							type: "button",
							onClick: onMap,
							children: "World map"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "btn secondary",
							type: "button",
							onClick: onHelp,
							children: "How to care"
						})
					]
				})
			]
		})]
	});
}
function MapScreen({ save, onBack, onPick }) {
	const nextId = continueLevel(save);
	const next = getLevel(nextId);
	const spot = MAP_SPOTS.find((item) => item.id === nextId) ?? MAP_SPOTS[0];
	const [zoomed, setZoomed] = (0, import_react.useState)(true);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "column map",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "map-head",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "icon-btn",
						type: "button",
						onClick: onBack,
						"aria-label": "Back",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "World map" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "star-total",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, {
							className: "star on",
							"aria-hidden": true
						}), totalStars(save)]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "zoom-toggle",
				type: "button",
				onClick: () => setZoomed((on) => !on),
				children: zoomed ? "Whole island" : "Zoom to next"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "island-wrap",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(IslandCamera, {
					focusX: spot.x,
					focusY: spot.y,
					zoom: zoomed,
					children: [MAP_SPOTS.map((pin) => {
						const locked = pin.id > save.unlocked;
						const stars = save.stars[String(pin.id)] ?? 0;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `pin${locked ? " locked" : ""}${pin.id === nextId ? " current" : ""}`,
							style: {
								left: `${pin.x}%`,
								top: `${pin.y}%`
							},
							disabled: locked,
							onClick: () => onPick(pin.id),
							"aria-label": `Level ${pin.id}`,
							children: [pin.id, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stars, {
								n: locked ? 0 : stars,
								tiny: true
							})]
						}, pin.id);
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						className: "traveler",
						src: "/avatar/idle.png",
						alt: "",
						style: {
							left: `${spot.x}%`,
							top: `${spot.y}%`
						}
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "map-caption",
					children: zoomed ? `Next · ${next.name}` : "Pick a ward"
				})]
			})
		]
	});
}
function IslandCamera({ focusX, focusY, zoom, children }) {
	const frameRef = (0, import_react.useRef)(null);
	const measureRef = (0, import_react.useRef)(() => {});
	const [xf, setXf] = (0, import_react.useState)("translate(0px, 0px) scale(1)");
	(0, import_react.useEffect)(() => {
		const wrap = frameRef.current?.parentElement;
		const frame = frameRef.current;
		if (!wrap || !frame) return;
		const apply = () => {
			if (!zoom) {
				setXf("translate(0px, 0px) scale(1)");
				return;
			}
			const width = wrap.clientWidth;
			const height = wrap.clientHeight;
			const frameW = frame.offsetWidth;
			const frameH = frame.offsetHeight;
			if (frameW < 8 || frameH < 8 || width < 8) return;
			const scale = 2.45;
			const localX = focusX / 100 * frameW;
			const localY = focusY / 100 * frameH;
			const tx = width / 2 - frame.offsetLeft - localX * scale;
			const ty = height / 2 - frame.offsetTop - localY * scale;
			setXf(`translate(${tx}px, ${ty}px) scale(${scale})`);
		};
		measureRef.current = apply;
		const timer = window.setTimeout(apply, 70);
		const observer = new ResizeObserver(apply);
		observer.observe(wrap);
		return () => {
			window.clearTimeout(timer);
			observer.disconnect();
		};
	}, [
		zoom,
		focusX,
		focusY
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "island-frame camera",
		ref: frameRef,
		style: { transform: xf },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			className: "island",
			src: "/map/island.jpg",
			alt: "",
			onLoad: () => measureRef.current()
		}), children]
	});
}
function Journey({ levelId, onArrive }) {
	const trip = journeyFor(levelId);
	const [gone, setGone] = (0, import_react.useState)(false);
	const arriveRef = (0, import_react.useRef)(onArrive);
	arriveRef.current = onArrive;
	(0, import_react.useEffect)(() => {
		const walk = window.setTimeout(() => setGone(true), 80);
		const done = window.setTimeout(() => arriveRef.current(), 2600);
		return () => {
			window.clearTimeout(walk);
			window.clearTimeout(done);
		};
	}, [levelId]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "column map",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "map-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: trip.title }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			className: "island-wrap journey",
			type: "button",
			onClick: onArrive,
			"aria-label": "Skip the walk",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IslandCamera, {
				focusX: trip.toX,
				focusY: trip.toY,
				zoom: gone,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					className: "traveler walk",
					src: "/avatar/idle.png",
					alt: "",
					style: {
						left: `${gone ? trip.toX : trip.fromX}%`,
						top: `${gone ? trip.toY : trip.fromY}%`
					}
				})
			})
		})]
	});
}
function Help({ onBack }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "column help",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "map-head",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "icon-btn",
					type: "button",
					onClick: onBack,
					"aria-label": "Back",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "How to care" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "scroll",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rules",
				children: [
					{
						src: "/sprites/heart.png",
						text: "Swap neighbors so three or more of a kind line up."
					},
					{
						src: "/sprites/pill.png",
						text: "Match four for a stripe that clears a whole line."
					},
					{
						src: "/sprites/cross.png",
						text: "An L or T makes a burst. Five in a line makes a rainbow."
					},
					{
						src: "/sprites/nurse.png",
						text: "Pair a rainbow with any candy to clear that color. Beat the goal before moves run out."
					}
				].map((rule) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rule",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: rule.src,
						alt: ""
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: rule.text })]
				}, rule.src))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "btn",
				type: "button",
				onClick: onBack,
				children: "Got it"
			})]
		})]
	});
}
function Stars({ n, tiny = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "stars",
		"aria-label": `${n} stars`,
		children: [
			0,
			1,
			2
		].map((index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, {
			className: index < n ? "star on" : "star",
			style: tiny ? void 0 : { animationDelay: `${index * 80}ms` }
		}, index))
	});
}
function meterName(value, resting) {
	if (resting) return value > 0 ? "Best" : "Combo";
	if (value >= 8) return "Abyss";
	if (value === 7) return "Faaah";
	if (value === 6) return "Dive";
	if (value === 4) return "Super";
	return comboLabel(value)?.replace("!", "") ?? "Combo";
}
function ComboCounter({ live, best }) {
	const [held, setHeld] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		if (live >= 2) {
			setHeld(live);
			return;
		}
		const id = window.setTimeout(() => setHeld(0), 1100);
		return () => window.clearTimeout(id);
	}, [live]);
	const chaining = live >= 2;
	const settling = !chaining && held >= 2;
	const resting = !chaining && !settling;
	const shownBest = best >= 2 ? best : 0;
	const value = chaining ? live : settling ? held : shownBest;
	const tier = value >= 7 ? "faah" : value >= 5 ? "wow" : "";
	const mode = chaining ? "hot" : settling ? "settle" : shownBest > 0 ? "best" : "idle";
	const filled = Math.min(Math.max(value, 0), 7);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `combo-meter ${mode} ${tier}`,
		"aria-live": "polite",
		"aria-label": `${meterName(value, resting)} ${value}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "combo-kicker",
				children: meterName(value, resting)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "combo-pips",
				"aria-hidden": true,
				children: Array.from({ length: 7 }, (_, i) => {
					const newest = chaining && i === filled - 1;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: i < filled ? newest ? "on fresh" : "on" : "" }, newest ? `n${value}` : i);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "combo-num",
				children: value > 0 ? `x${value}` : "x0"
			}, chaining ? `c${value}` : "rest")
		]
	});
}
function Play({ model, save, side, cell, slotRef, frame, boardRef, liquidRef, particleRef, onBack, onSound, onProfile, onAid, onCancel, onArm, onAdvance, onRetry, onNext, onHome, onPointerDown, onPointerMove, onPointerUp }) {
	const progress = {
		score: model.score,
		collected: model.collected,
		jellyLeft: countJelly(model.jelly)
	};
	const frac = goalFraction(model.level, progress, model.jellyTotal);
	const best = save.best[String(model.level.id)] ?? 0;
	const hintKeys = new Set((model.hint ?? []).map((pos) => keyOf(pos)));
	const icon = cell * 1.08;
	const scoreRef = (0, import_react.useRef)(null);
	const destroyed = KINDS.filter((kind) => model.collected[kind] > 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "column play",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "crush-nav",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "nav-side",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "icon-btn",
							type: "button",
							onClick: onBack,
							"aria-label": "Back to map",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "icon-btn",
							type: "button",
							onClick: onSound,
							"aria-label": save.sound ? "Mute sound" : "Sound on",
							children: save.sound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						className: "header-title",
						src: "/ui/crush-title.png",
						alt: "Sweet Care Crush"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "avatar-btn",
						type: "button",
						onClick: onProfile,
						"aria-label": `${save.career.name} profile`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocAvatar, { career: save.career })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "crush-hud",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "level-slab",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "lvl-num",
						children: model.level.id
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "lvl-copy",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "lvl-kicker",
								children: ["Level ", model.level.id]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "lvl-name",
								children: model.level.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "bar",
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${Math.round(frac * 100)}%` } })
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "score-slab",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hs-col",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "kicker",
								children: "High Score"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
								className: "live-score",
								ref: scoreRef,
								children: model.score
							}, model.score),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "capsule",
								"aria-hidden": true,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "seg red" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "seg gold" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "seg violet" })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "sr-only",
								children: [
									"Score ",
									model.score,
									". Best ",
									best,
									"."
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mv-col",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "kicker",
							children: "Moves:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: model.moves })]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboCounter, {
				live: model.dive,
				best: model.maxCombo
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "play-stage",
				ref: slotRef,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiquidBoard, {
					rows: model.level.rows,
					cols: model.level.cols,
					jelly: model.jelly,
					revision: model.score + model.moves + countJelly(model.jelly),
					scene: `/scenes/${String(model.level.id).padStart(2, "0")}.jpg`,
					frame,
					apiRef: liquidRef
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `board-shell${model.shake ? " shake" : ""}`,
					style: {
						width: side,
						height: side
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "board",
						ref: boardRef,
						onPointerDown,
						onPointerMove,
						onPointerUp,
						onPointerCancel: onPointerUp,
						role: "application",
						"aria-label": `${model.level.name} board`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `pieces${model.animate ? " anim" : ""}`,
								children: model.view.map((tile) => {
									const selected = model.selected?.r === tile.r && model.selected?.c === tile.c;
									const roll = model.rolls.find((item) => item.id === tile.id);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: [
											"tile",
											tile.dying ? "dying" : "",
											tile.born ? "born" : "",
											selected ? "sel" : "",
											hintKeys.has(`${tile.r},${tile.c}`) ? "hint" : "",
											tile.special ? `power-${tile.special}` : "",
											roll ? roll.dir > 0 ? "roll-cw" : "roll-ccw" : ""
										].filter(Boolean).join(" "),
										style: {
											width: icon,
											height: icon,
											transform: `translate(${tile.c * cell + (cell - icon) / 2}px, ${tile.r * cell + (cell - icon) / 2}px)`
										},
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
												className: "candy",
												src: spriteFor(tile),
												alt: "",
												draggable: false
											}),
											tile.special === "row" || tile.special === "col" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "shine" }) : null,
											tile.special === "bomb" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ring" }) : null
										]
									}, tile.id);
								})
							}),
							model.floats.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "floater",
								style: {
									left: `${(item.c + .5) / COLS * 100}%`,
									top: `${(item.r + .5) / COLS * 100}%`
								},
								children: item.text
							}, item.id)),
							model.flash ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `fx-flash ${model.flash}` }) : null,
							model.banner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "banner",
								children: model.banner
							}) : null,
							model.countdown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "count-down",
								"aria-live": "assertive",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: /\d/.test(model.countdown) ? "" : "word",
									children: model.countdown
								}, model.countdown)
							}) : null
						]
					})
				})]
			}),
			model.phase === "aim-blast" || model.phase === "aim-stripe" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "aim-note",
				children: ["Tap a candy", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onCancel,
					children: "Cancel"
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "kit-tray",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Power up" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "kit-row",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `kit-card${model.phase === "aim-blast" ? " on" : ""}`,
							disabled: model.boosters.blast <= 0 || model.phase === "busy" || Boolean(model.outcome),
							onClick: () => onArm("blast"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: "/sprites/cross.png",
								alt: ""
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "kit-pill",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: "/sprites/heart.png",
										alt: ""
									}),
									"Blast",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: model.boosters.blast })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `kit-card${model.phase === "aim-stripe" ? " on" : ""}`,
							disabled: model.boosters.stripe <= 0 || model.phase === "busy" || Boolean(model.outcome),
							onClick: () => onArm("stripe"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: "/sprites/pill.png",
								alt: ""
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "kit-pill",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: "/sprites/heart.png",
										alt: ""
									}),
									"Stripe",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: model.boosters.stripe })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "kit-card",
							disabled: model.boosters.aid <= 0 || model.phase === "busy" || Boolean(model.outcome),
							onClick: onAid,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: "/sprites/nurse.png",
								alt: ""
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "kit-pill",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: "/sprites/bandage.png",
										alt: ""
									}),
									"Aid",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: model.boosters.aid })
								]
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ParticleLayer, {
				boardRef,
				scoreRef,
				rows: COLS,
				cols: COLS,
				apiRef: particleRef
			}),
			model.outcome ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outro, {
				model,
				save,
				destroyed,
				onAdvance,
				onRetry,
				onNext,
				onBack,
				onProfile,
				onHome
			}) : null
		]
	});
}
var CONFETTI_COLORS = [
	"#ffe56a",
	"#ff4ea8",
	"#fff7fb",
	"#b8f2c2",
	"#7a5cff",
	"#ff335c"
];
function Confetti() {
	const [show, setShow] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		const id = window.setTimeout(() => setShow(false), 3e3);
		return () => window.clearTimeout(id);
	}, []);
	const bits = (0, import_react.useMemo)(() => Array.from({ length: 42 }, (_, id) => ({
		id,
		left: Math.random() * 100,
		delay: -(id % 12 / 12) * (2.8 + id % 3 * .4),
		dur: 2.8 + id % 3 * .4,
		color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
		w: 11 + id % 4 * 4,
		h: 16 + id % 3 * 5,
		round: id % 3 === 0
	})), []);
	if (!show) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "cheer-confetti",
		"aria-hidden": true,
		children: bits.map((bit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: {
			left: `${bit.left}%`,
			width: bit.w,
			height: bit.h,
			background: bit.color,
			borderRadius: bit.round ? "999px" : "2px",
			animationDuration: `${bit.dur}s`,
			animationDelay: `${bit.delay}s`
		} }, bit.id))
	});
}
function BadgeFlash({ badges }) {
	const [step, setStep] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		if (badges.length === 0) return;
		const id = window.setInterval(() => setStep((n) => n + 1), 780);
		return () => window.clearInterval(id);
	}, [badges.length]);
	if (badges.length === 0) return null;
	if (step >= badges.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "badges flash-row",
		children: badges.map((badge) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `badge ${badge.id}`,
			children: badge.label
		}, badge.id))
	});
	const badge = badges[step];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "badge-pop",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cheer-flash" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
			className: `badge-flash ${badge.id}`,
			children: badge.label
		})]
	}, `${badge.id}-${step}`);
}
function Outro({ model, save, destroyed, onAdvance, onRetry, onNext, onBack, onProfile, onHome }) {
	const won = model.outcome === "win";
	if (model.curtain !== "next") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "outro card-hold",
		children: [won ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Confetti, {}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "modal summary",
			role: "dialog",
			"aria-label": won ? "Level summary" : "Out of moves",
			children: [
				won ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cheer, { career: save.career }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocAvatar, {
					career: save.career,
					className: "cheer"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stars, { n: won ? model.stars : 0 }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: won ? model.level.name : "Out of moves" }),
				model.rankedUp ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "rank-up",
					children: ["Rank up · ", rankTitle(save.career.rank)]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "summary-score",
					children: [
						"Score ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUp, { value: model.score }) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatClock(model.elapsed) })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "combo-line",
					children: ["Best combo ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: ["x", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUp, { value: model.maxCombo })] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "wreck",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "kicker",
						children: "Destroyed"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wreck-row",
						children: [destroyed.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "wreck-item",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: `/sprites/${kind}.png`,
								alt: ""
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountUp, { value: model.collected[kind] })]
						}, kind)), destroyed.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "None yet" }) : null]
					})]
				}),
				model.badges.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BadgeFlash, { badges: model.badges }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "summary-note",
					children: "No badges this round."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "btn",
					type: "button",
					onClick: onAdvance,
					children: "Next"
				})
			]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "outro after",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocAvatar, {
				career: save.career,
				className: "after-doc"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: won ? model.level.name : "Out of moves" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stars, { n: won ? model.stars : 0 }),
			model.savedNow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "save-banner",
				children: "Progress saved. Game progress is stored every 5 levels."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "stack",
				children: [
					won && model.level.id < 15 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "btn",
						type: "button",
						onClick: onNext,
						children: "Play next level"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "btn secondary",
						type: "button",
						onClick: onRetry,
						children: "Replay last game"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "btn secondary",
						type: "button",
						onClick: onBack,
						children: "World map"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "btn secondary",
						type: "button",
						onClick: onProfile,
						children: "Profile"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "btn secondary",
						type: "button",
						onClick: onHome,
						children: "Main menu"
					})
				]
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SweetCare, {});
}
//#endregion
export { Home as component };
