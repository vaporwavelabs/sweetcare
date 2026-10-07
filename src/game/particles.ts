import type { Kind } from "./engine.ts";

export type ParticleKind = Kind | "imp";

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  radius: number;
  life: number;
  age: number;
  kind: ParticleKind;
  restitution: number;
  drag: number;
  gravity: number;
  mass: number;
  flutter: number;
}

/** How each candy behaves once it leaves the board. */
const MATERIAL: Record<ParticleKind, Omit<Body, "x" | "y" | "vx" | "vy" | "angle" | "omega" | "age" | "kind">> = {
  heart: { radius: 13, life: 1.35, restitution: 0.72, drag: 0.85, gravity: 520, mass: 0.55, flutter: 0 },
  cross: { radius: 14, life: 1.2, restitution: 0.28, drag: 0.35, gravity: 1280, mass: 1.45, flutter: 0 },
  pill: { radius: 12, life: 1.35, restitution: 0.55, drag: 0.45, gravity: 860, mass: 0.85, flutter: 0 },
  bandage: { radius: 13, life: 1.5, restitution: 0.22, drag: 1.15, gravity: 460, mass: 0.4, flutter: 280 },
  nurse: { radius: 13, life: 1.55, restitution: 0.4, drag: 0.7, gravity: 220, mass: 0.35, flutter: 90 },
  kit: { radius: 15, life: 1.25, restitution: 0.18, drag: 0.25, gravity: 1500, mass: 1.8, flutter: 0 },
  teddy: { radius: 15, life: 1.45, restitution: 0.62, drag: 0.5, gravity: 740, mass: 1.1, flutter: 0 },
  diaper: { radius: 14, life: 1.4, restitution: 0.3, drag: 0.9, gravity: 520, mass: 0.5, flutter: 160 },
  bottle: { radius: 12, life: 1.3, restitution: 0.48, drag: 0.4, gravity: 980, mass: 0.95, flutter: 0 },
  pacifier: { radius: 12, life: 1.35, restitution: 0.7, drag: 0.55, gravity: 640, mass: 0.45, flutter: 40 },
  gift: { radius: 14, life: 1.3, restitution: 0.22, drag: 0.35, gravity: 1100, mass: 1.3, flutter: 0 },
  rattle: { radius: 13, life: 1.5, restitution: 0.78, drag: 0.42, gravity: 700, mass: 0.6, flutter: 0 },
  scan: { radius: 14, life: 1.3, restitution: 0.2, drag: 0.4, gravity: 1100, mass: 1.2, flutter: 0 },
  ruby: { radius: 13, life: 1.35, restitution: 0.55, drag: 0.5, gravity: 780, mass: 0.9, flutter: 0 },
  gilt: { radius: 14, life: 1.3, restitution: 0.32, drag: 0.35, gravity: 1200, mass: 1.4, flutter: 0 },
  glow: { radius: 13, life: 1.45, restitution: 0.6, drag: 0.7, gravity: 420, mass: 0.5, flutter: 40 },
  plus: { radius: 14, life: 1.2, restitution: 0.26, drag: 0.35, gravity: 1280, mass: 1.45, flutter: 0 },
  gem: { radius: 13, life: 1.35, restitution: 0.74, drag: 0.55, gravity: 640, mass: 0.7, flutter: 0 },
  iv: { radius: 13, life: 1.25, restitution: 0.18, drag: 0.4, gravity: 1000, mass: 1.1, flutter: 0 },
  slate: { radius: 14, life: 1.2, restitution: 0.16, drag: 0.3, gravity: 1400, mass: 1.6, flutter: 0 },
  flask: { radius: 13, life: 1.2, restitution: 0.22, drag: 0.4, gravity: 900, mass: 0.8, flutter: 0 },
  tubes: { radius: 13, life: 1.25, restitution: 0.35, drag: 0.45, gravity: 860, mass: 0.7, flutter: 0 },
  scope: { radius: 15, life: 1.2, restitution: 0.16, drag: 0.3, gravity: 1400, mass: 1.7, flutter: 0 },
  biohaz: { radius: 14, life: 1.35, restitution: 0.28, drag: 0.7, gravity: 700, mass: 0.6, flutter: 80 },
  eyewash: { radius: 14, life: 1.25, restitution: 0.2, drag: 0.4, gravity: 1100, mass: 1.2, flutter: 0 },
  cyl: { radius: 12, life: 1.2, restitution: 0.3, drag: 0.4, gravity: 980, mass: 0.85, flutter: 0 },
  goggles: { radius: 13, life: 1.3, restitution: 0.45, drag: 0.55, gravity: 640, mass: 0.45, flutter: 30 },
  extinguisher: { radius: 14, life: 1.15, restitution: 0.18, drag: 0.3, gravity: 1500, mass: 1.8, flutter: 0 },
  boot: { radius: 14, life: 1.25, restitution: 0.24, drag: 0.4, gravity: 1200, mass: 1.3, flutter: 0 },
  xray: { radius: 13, life: 1.35, restitution: 0.4, drag: 0.6, gravity: 520, mass: 0.4, flutter: 60 },
  ribs: { radius: 14, life: 1.3, restitution: 0.32, drag: 0.5, gravity: 780, mass: 0.7, flutter: 0 },
  calcium: { radius: 13, life: 1.2, restitution: 0.2, drag: 0.35, gravity: 1100, mass: 1.1, flutter: 0 },
  badge: { radius: 14, life: 1.2, restitution: 0.3, drag: 0.35, gravity: 1200, mass: 1.3, flutter: 0 },
  screw: { radius: 11, life: 1.15, restitution: 0.22, drag: 0.25, gravity: 1600, mass: 1.9, flutter: 0 },
  wrap: { radius: 13, life: 1.4, restitution: 0.2, drag: 0.9, gravity: 640, mass: 0.5, flutter: 120 },
  pelvis: { radius: 15, life: 1.2, restitution: 0.18, drag: 0.3, gravity: 1400, mass: 1.6, flutter: 0 },
  imp: { radius: 12, life: 1.7, restitution: 0.86, drag: 0.3, gravity: 980, mass: 0.7, flutter: 0 },
};

export class ParticleWorld {
  bodies: Body[] = [];
  width = 300;
  height = 600;

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  spawn(kind: ParticleKind, x: number, y: number, vx: number, vy: number, omega = 0) {
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
      age: 0,
    });
  }

  step(dt: number) {
    const stepDt = Math.min(0.033, Math.max(0, dt));
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
      body.omega *= Math.exp(-body.drag * 0.5 * stepDt);
      body.x += body.vx * stepDt;
      body.y += body.vy * stepDt;
      body.angle += body.omega * stepDt;
      this.contain(body);
    }
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < n; j++) {
        const b = list[j]!;
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
        const bounce = Math.min(a.restitution, b.restitution);
        const impulse = (-(1 + bounce) * rel) / (1 / a.mass + 1 / b.mass);
        a.vx -= (impulse * nx) / a.mass;
        a.vy -= (impulse * ny) / a.mass;
        b.vx += (impulse * nx) / b.mass;
        b.vy += (impulse * ny) / b.mass;
        a.omega += impulse / (a.mass * 40);
        b.omega -= impulse / (b.mass * 40);
      }
    }
    this.bodies = list.filter((body) => body.age < body.life);
  }

  private contain(body: Body) {
    const r = body.radius;
    if (body.x < r) {
      body.x = r;
      body.vx = Math.abs(body.vx) * body.restitution;
      body.omega += body.vy * 0.01;
    } else if (body.x > this.width - r) {
      body.x = this.width - r;
      body.vx = -Math.abs(body.vx) * body.restitution;
      body.omega -= body.vy * 0.01;
    }
    if (body.y < r) {
      body.y = r;
      body.vy = Math.abs(body.vy) * body.restitution;
    } else if (body.y > this.height - r) {
      body.y = this.height - r;
      if (Math.abs(body.vy) < 40 && Math.abs(body.vx) < 30) {
        body.vy = 0;
        body.vx *= 0.8;
        body.omega *= 0.8;
      } else if (body.vy > 0) {
        body.vy = -body.vy * body.restitution;
        body.vx *= 0.84;
        body.omega = body.vx / Math.max(8, body.radius);
      }
    }
  }
}
