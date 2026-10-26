/**
 * Board shapes for the 6 by 6 wards. Holes are "#". Wraps and jelly get layered on top by the
 * generator, so these only carve the outline. `extra` is how many moves the outline costs a
 * player on average, measured with the bot in simulate.ts.
 */
export interface Shape {
  id: string;
  label: string;
  /** 0 is a full board, 2 is the most carved. */
  tier: 0 | 1 | 2;
  extra: number;
  grid: string[];
}

export const SHAPES: Shape[] = [
  {
    id: "open",
    label: "Open floor",
    tier: 0,
    extra: 0,
    grid: [". . . . . .", ". . . . . .", ". . . . . .", ". . . . . .", ". . . . . .", ". . . . . ."],
  },
  {
    id: "corners",
    label: "Rounded",
    tier: 1,
    extra: 1,
    grid: ["# . . . . #", ". . . . . .", ". . . . . .", ". . . . . .", ". . . . . .", "# . . . . #"],
  },
  {
    id: "pillars",
    label: "Pillars",
    tier: 1,
    extra: 1,
    grid: [". . . . . .", ". # . . # .", ". . . . . .", ". . . . . .", ". # . . # .", ". . . . . ."],
  },
  {
    id: "beds",
    label: "Bed bays",
    tier: 1,
    extra: 2,
    grid: [". . . . . .", ". . . . . .", "# # . . # #", ". . . . . .", ". . . . . .", ". . . . . ."],
  },
  {
    id: "diamond",
    label: "Diamond",
    tier: 2,
    extra: 3,
    grid: ["# # . . # #", "# . . . . #", ". . . . . .", ". . . . . .", "# . . . . #", "# # . . # #"],
  },
  {
    id: "ring",
    label: "Nurse station",
    tier: 2,
    extra: 2,
    grid: ["# . . . . #", ". . . . . .", ". . # # . .", ". . # # . .", ". . . . . .", "# . . . . #"],
  },
  {
    id: "hourglass",
    label: "Hourglass",
    tier: 2,
    extra: 3,
    grid: [". . . . . .", "# . . . . #", "# # . . # #", "# # . . # #", "# . . . . #", ". . . . . ."],
  },
];

export function shapeById(id: string): Shape {
  return SHAPES.find((shape) => shape.id === id) ?? SHAPES[0]!;
}

/** Shapes a ward may use. Early wards stay open so the first few boards teach the basics. */
export function shapesFor(levelId: number): Shape[] {
  if (levelId < 6) return SHAPES.filter((shape) => shape.tier === 0);
  if (levelId < 11) return SHAPES.filter((shape) => shape.tier <= 1);
  return SHAPES.filter((shape) => shape.tier >= 1);
}
