export type ShiftId =
  | "fully-staffed"
  | "short-staffed"
  | "float-pool"
  | "supply-shortage"
  | "in-service"
  | "night-shift"
  | "spill-risk"
  | "visitor-hour";

export interface ShiftDef {
  id: ShiftId;
  label: string;
  blurb: string;
}

export const SHIFTS: ShiftDef[] = [
  { id: "fully-staffed", label: "Fully staffed", blurb: "A normal ward. Five supplies, usual clock." },
  { id: "short-staffed", label: "Short staffed", blurb: "Fewer supplies and a shorter clock." },
  { id: "float-pool", label: "Float pool", blurb: "Another wing's supplies landed on this ward." },
  { id: "supply-shortage", label: "Supply shortage", blurb: "The goal supply is scarce on the board." },
  { id: "in-service", label: "In-service", blurb: "The ward starts with a power already placed." },
  { id: "night-shift", label: "Night shift", blurb: "Score is the only order. Stars sit higher." },
  { id: "spill-risk", label: "Spill risk", blurb: "Jelly is on the floor. Clear it to finish." },
  { id: "visitor-hour", label: "Visitor hour", blurb: "A toy supply joins the board and crowds the match." },
];

const ORDER: ShiftId[] = SHIFTS.map((shift) => shift.id);

export function dayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hashText(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shiftForDate(now = new Date()): ShiftDef {
  const key = dayKey(now);
  const index = hashText(key) % ORDER.length;
  return SHIFTS[index]!;
}

export function shiftById(id: string | undefined): ShiftDef {
  return SHIFTS.find((shift) => shift.id === id) ?? SHIFTS[0]!;
}
