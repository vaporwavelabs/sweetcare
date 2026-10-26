import { KINDS, type Kind, type Power } from "./engine.ts";
import { MAX_FUSE, MAX_SIDE, MIN_FUSE, MIN_SIDE, formatGrid, openCount, parseGrid } from "./layout.ts";
import type { FeverRule } from "./mechanics.ts";
import { countJelly, makeJelly, type Goal, type LevelDef } from "./levels.ts";

/** A level made in the level creator. Stored on this device and shared as a text code. */
export interface CustomLevel {
  uid: string;
  name: string;
  rows: number;
  cols: number;
  kinds: Kind[];
  moves: number;
  goals: Goal[];
  star2: number;
  star3: number;
  grid: string[];
  scene: number;
  startSpecial: Power | null;
  /** New fevers break out every few moves. Null turns outbreaks off. */
  fever: FeverRule | null;
  updatedAt: number;
}

/** Custom runs use an id outside the campaign so no map pin, gift or save slot matches it. */
export const CUSTOM_ID = 90;
export const MAX_GOALS = 3;
export const MIN_KINDS = 3;
export const MAX_KINDS = 8;

const STORE = "sweet-care-levels-v1";
const SHARE_PREFIX = "SC1.";
const KIND_SET = new Set<string>(KINDS);
const POWERS: Power[] = ["row", "col", "bomb", "rainbow"];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function newUid(): string {
  return `lvl-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function blankLevel(): CustomLevel {
  return {
    uid: newUid(),
    name: "My ward",
    rows: 6,
    cols: 6,
    kinds: ["heart", "cross", "pill", "bandage", "kit"],
    moves: 20,
    goals: [{ type: "collect", kind: "heart", count: 24 }],
    star2: 8000,
    star3: 11000,
    grid: formatGrid(parseGrid(undefined, 6, 6)),
    scene: 1,
    startSpecial: null,
    fever: null,
    updatedAt: Date.now(),
  };
}

function cleanFever(raw: unknown): FeverRule | null {
  if (!raw || typeof raw !== "object") return null;
  const rule = raw as Record<string, unknown>;
  const every = clampInt(rule.every, 0, 20, 0);
  if (!every) return null;
  return { every, fuse: clampInt(rule.fuse, MIN_FUSE, MAX_FUSE, 8) };
}

function cleanGoal(raw: unknown, kinds: Kind[]): Goal | null {
  if (!raw || typeof raw !== "object") return null;
  const goal = raw as Record<string, unknown>;
  if (goal.type === "jelly") return { type: "jelly" };
  if (goal.type === "wraps") return { type: "wraps" };
  if (goal.type === "contagion") return { type: "contagion" };
  if (goal.type === "fevers") return { type: "fevers", count: clampInt(goal.count, 1, 60, 4) };
  if (goal.type === "score") return { type: "score", target: clampInt(goal.target, 500, 200000, 5000) };
  if (goal.type === "collect" && typeof goal.kind === "string" && KIND_SET.has(goal.kind)) {
    const kind = goal.kind as Kind;
    return { type: "collect", kind: kinds.includes(kind) ? kind : kinds[0]!, count: clampInt(goal.count, 1, 200, 20) };
  }
  return null;
}

/** Turns anything (old saves, pasted share codes) into a level the game can run. */
export function cleanLevel(raw: unknown): CustomLevel {
  const base = blankLevel();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const rows = clampInt(data.rows, MIN_SIDE, MAX_SIDE, base.rows);
  const cols = clampInt(data.cols, MIN_SIDE, MAX_SIDE, base.cols);
  const kinds = Array.isArray(data.kinds)
    ? [...new Set(data.kinds.filter((kind): kind is Kind => typeof kind === "string" && KIND_SET.has(kind)))].slice(0, MAX_KINDS)
    : [];
  const safeKinds = kinds.length >= MIN_KINDS ? kinds : base.kinds;
  const goals = Array.isArray(data.goals)
    ? data.goals.map((goal) => cleanGoal(goal, safeKinds)).filter((goal): goal is Goal => goal !== null).slice(0, MAX_GOALS)
    : [];
  const grid = Array.isArray(data.grid) ? data.grid.filter((row): row is string => typeof row === "string") : undefined;
  const star2 = clampInt(data.star2, 100, 500000, base.star2);
  return {
    uid: typeof data.uid === "string" && data.uid.length <= 64 ? data.uid : base.uid,
    name: typeof data.name === "string" ? data.name.slice(0, 28) : base.name,
    rows,
    cols,
    kinds: safeKinds,
    moves: clampInt(data.moves, 1, 99, base.moves),
    goals: goals.length ? goals : base.goals,
    star2,
    star3: Math.max(star2 + 1, clampInt(data.star3, 101, 600000, base.star3)),
    grid: formatGrid(parseGrid(grid, rows, cols)),
    scene: clampInt(data.scene, 1, 15, 1),
    startSpecial: POWERS.includes(data.startSpecial as Power) ? (data.startSpecial as Power) : null,
    fever: cleanFever(data.fever),
    updatedAt: clampInt(data.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
  };
}

export function toLevelDef(level: CustomLevel): LevelDef {
  return {
    id: CUSTOM_ID,
    name: level.name.trim() || "Custom ward",
    rows: level.rows,
    cols: level.cols,
    kinds: level.kinds,
    moves: level.moves,
    goals: level.goals,
    star2: level.star2,
    star3: level.star3,
    jelly: "none",
    grid: level.grid,
    scene: level.scene,
    shiftLabel: "Custom ward",
    startSpecial: level.startSpecial,
    fever: level.fever,
    custom: true,
  };
}

export type Issue = { level: "error" | "warn"; text: string };

/** Problems a designer should fix before a level is fair to play. */
export function checkLevel(level: CustomLevel): Issue[] {
  const issues: Issue[] = [];
  const cells = parseGrid(level.grid, level.rows, level.cols);
  const open = openCount(cells);
  const def = toLevelDef(level);
  const jelly = countJelly(makeJelly(def));
  let wraps = 0;
  let infected = 0;
  let fevers = 0;
  for (const row of cells) {
    for (const cell of row) {
      wraps += cell.wrap;
      if (cell.contagion) infected += 1;
      if (cell.fuse) fevers += 1;
    }
  }

  if (open < 12) issues.push({ level: "error", text: "The board needs at least 12 open cells." });
  if (level.kinds.length < MIN_KINDS) issues.push({ level: "error", text: `Pick at least ${MIN_KINDS} supplies.` });
  if (!level.goals.length) issues.push({ level: "error", text: "Add at least one goal." });
  for (const goal of level.goals) {
    if (goal.type === "collect" && !level.kinds.includes(goal.kind)) issues.push({ level: "error", text: `The ${goal.kind} goal can never fill: ${goal.kind} is not on the board.` });
    if (goal.type === "jelly" && jelly === 0) issues.push({ level: "error", text: "There is a jelly goal but no jelly on the board." });
    if (goal.type === "wraps" && wraps === 0) issues.push({ level: "error", text: "There is a wrap goal but no wrapped tiles on the board." });
    if (goal.type === "contagion" && infected === 0) issues.push({ level: "error", text: "There is a contagion goal but no contagion on the board." });
    if (goal.type === "fevers" && !level.fever && fevers < goal.count) issues.push({ level: "error", text: `The fever goal needs ${goal.count} fevers. Place more fever tiles or turn on outbreaks.` });
  }
  if (infected > 0 && infected * 3 > open) issues.push({ level: "warn", text: "Contagion covers over a third of the board. It may spread faster than anyone can clean it." });
  if (level.fever && level.fever.fuse <= level.fever.every) issues.push({ level: "warn", text: "Fevers break out faster than they burn down. Expect several at once." });
  if (level.star3 <= level.star2) issues.push({ level: "error", text: "Three stars must need more score than two." });
  if (jelly > 0 && !level.goals.some((goal) => goal.type === "jelly")) issues.push({ level: "warn", text: "Jelly is on the board but no goal asks for it. It only adds score." });
  if (wraps > 0 && !level.goals.some((goal) => goal.type === "wraps")) issues.push({ level: "warn", text: "Wrapped tiles are on the board but no goal asks for them." });
  if (level.kinds.length <= 3) issues.push({ level: "warn", text: "Three supplies cascade almost every move. Expect a very easy level." });
  if (level.kinds.length >= 7 && open <= 36) issues.push({ level: "warn", text: "Seven or more supplies on a small board run out of moves often." });
  for (let c = 0; c < level.cols; c++) {
    if (cells.every((row) => row[c]!.hole)) {
      issues.push({ level: "warn", text: `Column ${c + 1} is all holes. Trim the board instead.` });
      break;
    }
  }
  return issues;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** A short text code another player can paste into their own creator. */
export function shareCode(level: CustomLevel): string {
  const { uid: _uid, updatedAt: _at, ...rest } = level;
  return SHARE_PREFIX + toBase64Url(JSON.stringify(rest));
}

export function readShareCode(code: string): CustomLevel | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(trimmed.slice(SHARE_PREFIX.length))) as Record<string, unknown>;
    return cleanLevel({ ...parsed, uid: newUid(), updatedAt: Date.now() });
  } catch {
    return null;
  }
}

export function loadCustomLevels(): CustomLevel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(cleanLevel) : [];
  } catch {
    return [];
  }
}

export function saveCustomLevels(levels: CustomLevel[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE, JSON.stringify(levels.slice(0, 50)));
  } catch {
    /* storage full or blocked: the level still plays this session */
  }
}

export function duplicateLevel(level: CustomLevel): CustomLevel {
  return { ...structuredClone(level), uid: newUid(), name: `${level.name} copy`.slice(0, 28), updatedAt: Date.now() };
}
