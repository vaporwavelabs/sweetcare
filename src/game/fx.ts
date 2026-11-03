/**
 * Light effects that sit above the board: sparks, shock rings, power beams, rays and
 * damage numbers. Nothing here collides; it is cheap, additive glow that is drawn on the
 * particle canvas next to the candy bodies. The pool is capped so a long cascade can
 * never pile up more work than one frame can draw.
 */

export type FxKind = "spark" | "ring" | "beam" | "ray" | "text" | "ember" | "paper";

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  angle: number;
  spin: number;
  /** Beams: "h" sweeps a row, "v" a column. */
  dir?: "h" | "v";
  /** Beams: full length. Text: the words. */
  span?: number;
  text?: string;
  /** Text: the number shown, so a burst of small hits can add up into one. */
  value?: number;
  /** Pulls the effect down. Sparks fall, embers rise (negative). */
  gravity: number;
  drag: number;
  /** Seconds before it shows. Lets a burst ripple outward. */
  delay: number;
}

export const FX_CAP = 360;

export class FxWorld {
  list: Fx[] = [];

  add(fx: Partial<Fx> & Pick<Fx, "kind" | "x" | "y">) {
    if (this.list.length >= FX_CAP) this.list.splice(0, this.list.length - FX_CAP + 1);
    this.list.push({
      vx: 0,
      vy: 0,
      age: 0,
      life: 0.5,
      size: 4,
      color: "#ffffff",
      angle: 0,
      spin: 0,
      gravity: 0,
      drag: 0,
      delay: 0,
      ...fx,
    });
  }

  step(dt: number) {
    if (dt <= 0) return;
    for (const fx of this.list) {
      if (fx.delay > 0) {
        fx.delay -= dt;
        continue;
      }
      fx.age += dt;
      fx.vy += fx.gravity * dt;
      if (fx.drag) {
        const damp = Math.exp(-fx.drag * dt);
        fx.vx *= damp;
        fx.vy *= damp;
      }
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.angle += fx.spin * dt;
    }
    this.list = this.list.filter((fx) => fx.age < fx.life);
  }

  /** A ring of sparks thrown out from one point. */
  sparks(x: number, y: number, color: string, count: number, speed: number, seed = 0) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + ((seed * 7 + i * 13) % 10) * 0.05;
      const pace = speed * (0.55 + ((i * 37 + seed) % 10) / 20);
      this.add({
        kind: "spark",
        x,
        y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace - speed * 0.25,
        life: 0.38 + (i % 4) * 0.07,
        size: 2.2 + (i % 3),
        color: i % 3 === 0 ? "#fffef8" : color,
        gravity: 520,
        drag: 2.6,
      });
    }
  }

  ring(x: number, y: number, color: string, size: number, life = 0.42, delay = 0) {
    this.add({ kind: "ring", x, y, color, size, life, delay });
  }

  beam(x: number, y: number, dir: "h" | "v", span: number, thickness: number, color: string) {
    this.add({ kind: "beam", x, y, dir, span, size: thickness, color, life: 0.46 });
  }

  rays(x: number, y: number, color: string, count: number, length: number) {
    for (let i = 0; i < count; i++) {
      this.add({ kind: "ray", x, y, angle: (Math.PI * 2 * i) / count, spin: 1.4, size: length, color, life: 0.7 });
    }
  }

  text(x: number, y: number, text: string, color: string, size: number) {
    this.add({ kind: "text", x, y, vy: -70, text, color, size, life: 0.95, drag: 1.4 });
  }

  /**
   * A damage number. Hits that land within a moment of the last one fold into it,
   * so a volley reads as one growing number instead of a stack of fours.
   */
  tally(x: number, y: number, value: number, sign: "-" | "+", color: string, size: number) {
    let last: Fx | null = null;
    for (let i = this.list.length - 1; i >= 0 && !last; i--) {
      const fx = this.list[i]!;
      if (fx.kind === "text" && fx.value !== undefined && fx.color === color && fx.age < 0.3) last = fx;
    }
    if (last) {
      last.value = (last.value ?? 0) + value;
      last.text = `${sign}${last.value}`;
      last.age = Math.min(last.age, 0.12);
      last.size = Math.min(size * 1.6, last.size + 1.5);
      return;
    }
    this.add({ kind: "text", x, y, vy: -70, text: `${sign}${value}`, value, color, size, life: 0.95, drag: 1.4 });
  }

  embers(x: number, y: number, color: string, count: number, spread: number) {
    for (let i = 0; i < count; i++) {
      this.add({
        kind: "ember",
        x: x + (((i * 53) % 21) - 10) * (spread / 10),
        y: y + (((i * 31) % 11) - 5) * (spread / 20),
        vx: (((i * 17) % 9) - 4) * 9,
        vy: -40 - (i % 5) * 18,
        size: 1.6 + (i % 3) * 0.8,
        color,
        life: 0.8 + (i % 4) * 0.15,
        gravity: -60,
        drag: 0.8,
        delay: (i % 6) * 0.03,
      });
    }
  }

  paper(fromX: number, fromY: number, toX: number, toY: number, delay: number) {
    const time = 0.55;
    this.add({
      kind: "paper",
      x: fromX,
      y: fromY,
      vx: (toX - fromX) / time,
      vy: (toY - fromY) / time - 260 * time * 0.5,
      gravity: 260,
      size: 9,
      color: "#fffaf0",
      spin: 9,
      life: time,
      delay,
    });
  }
}

/** 0 at birth, 1 at death. */
export function lifeT(fx: Fx): number {
  return Math.max(0, Math.min(1, fx.age / fx.life));
}
