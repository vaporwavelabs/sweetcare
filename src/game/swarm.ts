/**
 * Microbe movement. Each germ has a temperament so a wave reads as a crowd, not a column:
 * drifters sway as they sink, darters shiver and then lunge, and the last germ of a big
 * outbreak is a mother cell that buds two drifters when she pops.
 */

export type GermKind = "drifter" | "darter" | "mother";

export interface Germ {
  id: number;
  sprite: number;
  kind: GermKind;
  /** Where the sway is centered, in percent of the stage width. */
  home: number;
  x: number;
  y: number;
  hp: number;
  max: number;
  /** Seconds alive. Drives the sway and the darter rhythm. */
  age: number;
  /** Seconds left of the shiver before a darter lunges. */
  tell: number;
  /** Seconds left of a lunge. */
  dash: number;
  /** Seconds left of the red flash after a hit. */
  hurt: number;
}

export interface SwarmSpec {
  count: number;
  hp: number;
  speed: number;
  bite: number;
}

/** Outbreaks of eight or more end with a mother cell. */
export function hasMother(swarm: SwarmSpec): boolean {
  return swarm.count >= 8;
}

export function makeGerm(id: number, n: number, swarm: SwarmSpec, last: boolean): Germ {
  const mother = last && hasMother(swarm);
  const kind: GermKind = mother ? "mother" : n % 3 === 2 ? "darter" : "drifter";
  const home = mother ? 50 : 12 + ((n * 37) % 76);
  const hp = mother ? swarm.hp * 3 : kind === "darter" ? Math.round(swarm.hp * 0.75) : swarm.hp;
  return {
    id,
    sprite: mother ? 0 : (n % 5) + 1,
    kind,
    home,
    x: home,
    y: mother ? -6 : 4 + (n % 3) * 6,
    hp,
    max: hp,
    age: (n * 0.73) % 3,
    tell: 0,
    dash: 0,
    hurt: 0,
  };
}

/** Moves one germ. Returns true when it reached the ward line. */
export function stepGerm(germ: Germ, swarm: SwarmSpec, dt: number): boolean {
  germ.age += dt;
  germ.hurt = Math.max(0, germ.hurt - dt);
  let speed = swarm.speed;
  if (germ.kind === "mother") {
    speed *= 0.45;
    germ.x = germ.home + Math.sin(germ.age * 0.9) * 10;
  } else if (germ.kind === "darter") {
    if (germ.dash > 0) {
      germ.dash -= dt;
      speed *= 3.4;
    } else if (germ.tell > 0) {
      germ.tell -= dt;
      speed = 0;
      if (germ.tell <= 0) germ.dash = 0.45;
    } else {
      speed *= 0.55;
      // Every few seconds a darter stops and shivers, then lunges.
      if (germ.age % 3.2 < dt) germ.tell = 0.7;
    }
    germ.x = germ.home + Math.sin(germ.age * 1.6) * 4;
  } else {
    germ.x = germ.home + Math.sin(germ.age * 2.1 + germ.id) * 9;
  }
  germ.x = Math.max(6, Math.min(94, germ.x));
  germ.y += speed * dt;
  return germ.y >= 84;
}

/** A hit pushes the germ up the stage. A mother splits into two drifters when she pops. */
export function woundGerm(germ: Germ, amount: number, nextId: () => number, swarm: SwarmSpec): { dead: boolean; buds: Germ[] } {
  germ.hp -= amount;
  germ.hurt = 0.3;
  germ.tell = 0;
  germ.dash = 0;
  germ.y = Math.max(-18, germ.y - (germ.kind === "mother" ? 1.5 : 4));
  if (germ.hp > 0) return { dead: false, buds: [] };
  if (germ.kind !== "mother") return { dead: true, buds: [] };
  const buds = [-1, 1].map((side, index) => {
    const bud = makeGerm(nextId(), index, swarm, false);
    bud.kind = "drifter";
    bud.sprite = index === 0 ? 2 : 4;
    bud.home = Math.max(10, Math.min(90, germ.x + side * 18));
    bud.x = germ.x;
    bud.y = germ.y;
    bud.hp = Math.round(swarm.hp * 0.6);
    bud.max = bud.hp;
    return bud;
  });
  return { dead: true, buds };
}
