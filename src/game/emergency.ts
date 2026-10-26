/**
 * Ward emergencies: the three bosses the generator used to name and never play. Each Karen fight
 * now runs during one of them, and each one bends the board a different way.
 *
 * - Code Blue (ward 5): a defib meter counts down. While it runs, hearts hit twice as hard. Four
 *   or more hearts in one clear shocks the patient back, refills the meter and stuns Karen. If the
 *   meter runs out the patient flatlines and you lose life.
 * - The Overflow (ward 10): jelly floods in after every move. Mopping jelly hurts Karen, but if the
 *   flood covers half the board it spills over you.
 * - Audit (ward 15): every so often the auditor stamps your power pieces back into plain tiles.
 *   The stamp is marked first, so you can fire them before it lands.
 *
 * Pure state so the arena can tick it every frame and tests can drive it.
 */
import type { Board, Mask, Pos } from "./engine.ts";

export type EmergencyKind = "code-blue" | "overflow" | "audit";

export const EMERGENCY_NAME: Record<EmergencyKind, string> = {
  "code-blue": "Code Blue",
  overflow: "The Overflow",
  audit: "Audit",
};

/** Hearts needed in one clear to shock the patient back. */
export const SHOCK_HEARTS = 4;

export const EMERGENCY_TIP: Record<EmergencyKind, string> = {
  "code-blue": `Hearts hit double while the defib is charged. Clear ${SHOCK_HEARTS} hearts at once to shock.`,
  overflow: "Jelly floods in each move. Mop it up to hurt Karen before it spills over.",
  audit: "The auditor stamps power pieces flat. Fire them before the stamp lands.",
};

export interface EmergencyState {
  kind: EmergencyKind;
  /** Code Blue: seconds left on the defib. Audit: seconds until the next stamp. */
  clock: number;
  /** Full length of the clock. */
  span: number;
  /** Audit: the stamp is marked and about to land. */
  warned: boolean;
}

export type EmergencyEvent =
  | { type: "flatline"; bite: number }
  | { type: "audit-warn" }
  | { type: "audit-stamp" };

export const FLATLINE_BITE = 12;
export const SPILL_BITE = 10;
/** Seconds of warning before the auditor's stamp lands. */
export const AUDIT_WARNING = 2.6;
/** Most power pieces one stamp can flatten. */
export const AUDIT_REACH = 2;

const SPAN: Record<EmergencyKind, number> = { "code-blue": 18, overflow: 0, audit: 13 };

export function createEmergency(kind: EmergencyKind): EmergencyState {
  return { kind, clock: SPAN[kind], span: SPAN[kind], warned: false };
}

/** Advance the clock. `phase` is Karen's fight phase, which speeds the auditor up. */
export function stepEmergency(state: EmergencyState, dt: number, phase = 0): EmergencyEvent[] {
  if (state.kind === "overflow" || dt <= 0) return [];
  const events: EmergencyEvent[] = [];
  state.clock -= dt;
  if (state.kind === "code-blue") {
    if (state.clock <= 0) {
      events.push({ type: "flatline", bite: FLATLINE_BITE });
      state.clock = state.span;
    }
    return events;
  }
  if (!state.warned && state.clock <= AUDIT_WARNING) {
    state.warned = true;
    events.push({ type: "audit-warn" });
  }
  if (state.clock <= 0) {
    state.warned = false;
    state.clock = Math.max(7, state.span - phase * 2.5);
    events.push({ type: "audit-stamp" });
  }
  return events;
}

/** Boss damage multiplier for one cleared tile. */
export function damageScale(state: EmergencyState | null, kind: string): number {
  if (!state || state.kind !== "code-blue") return 1;
  return kind === "heart" && state.clock > 0 ? 2 : 1;
}

/** Code Blue: a clear with enough hearts refills the defib. Returns true when it shocks. */
export function shock(state: EmergencyState | null, hearts: number): boolean {
  if (!state || state.kind !== "code-blue" || hearts < SHOCK_HEARTS) return false;
  state.clock = state.span;
  return true;
}

/** Jelly cells the flood adds after a move, grown out of the jelly already on the board. */
export function floodCells(jelly: boolean[][], mask: Mask | undefined, count: number, rng: () => number): Pos[] {
  const rows = jelly.length;
  const cols = jelly[0]?.length ?? 0;
  const open = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && mask?.[r]?.[c] !== false;
  const edge: Pos[] = [];
  const dry: Pos[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!open(r, c) || jelly[r]![c]) continue;
      dry.push({ r, c });
      const wetNear = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => open(r + dr!, c + dc!) && jelly[r + dr!]![c + dc!]);
      if (wetNear) edge.push({ r, c });
    }
  }
  // The flood comes up from the bottom row when there is nothing to grow from.
  const bottom = dry.filter((cell) => cell.r === rows - 1);
  const pool = edge.length ? edge : bottom.length ? bottom : dry;
  const picked: Pos[] = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]!);
  }
  return picked;
}

/** Share of open cells under jelly, 0 to 1. */
export function floodLevel(jelly: boolean[][], mask?: Mask): number {
  let open = 0;
  let wet = 0;
  for (let r = 0; r < jelly.length; r++) {
    for (let c = 0; c < jelly[r]!.length; c++) {
      if (mask?.[r]?.[c] === false) continue;
      open += 1;
      if (jelly[r]![c]) wet += 1;
    }
  }
  return open ? wet / open : 0;
}

/** The flood spills over when it covers half the board. */
export const SPILL_AT = 0.5;

/** Drains a spilled flood down to about a quarter of the board. Returns the cells it dried. */
export function drainFlood(jelly: boolean[][], rng: () => number): Pos[] {
  const wet: Pos[] = [];
  for (let r = 0; r < jelly.length; r++) for (let c = 0; c < jelly[r]!.length; c++) if (jelly[r]![c]) wet.push({ r, c });
  const keep = Math.floor(wet.length / 2);
  const dried: Pos[] = [];
  while (wet.length > keep) {
    const cell = wet.splice(Math.floor(rng() * wet.length), 1)[0]!;
    jelly[cell.r]![cell.c] = false;
    dried.push(cell);
  }
  return dried;
}

/** Audit: the power pieces the stamp is aimed at. */
export function auditTargets(board: Board, rng: () => number, reach = AUDIT_REACH): number[] {
  const powered: number[] = [];
  for (const row of board) for (const tile of row) if (tile?.special) powered.push(tile.id);
  const picked: number[] = [];
  while (picked.length < reach && powered.length) picked.push(powered.splice(Math.floor(rng() * powered.length), 1)[0]!);
  return picked;
}

/** Audit: flattens the marked pieces still on the board. Returns where they were. */
export function applyStamp(board: Board, targets: number[]): Pos[] {
  const hit: Pos[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r]!.length; c++) {
      const tile = board[r]![c];
      if (tile?.special && targets.includes(tile.id)) {
        tile.special = null;
        hit.push({ r, c });
      }
    }
  }
  return hit;
}
