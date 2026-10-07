import { useLayoutEffect, useRef } from "react";
import { ParticleWorld, type ParticleKind } from "@/game/particles";
import { KINDS, type Kind } from "@/game/engine";

export type ParticleHandle = {
  burst: (cells: { r: number; c: number; kind: Kind }[]) => void;
  summon: (cells: { r: number; c: number }[], count?: number) => void;
  rain: () => void;
  scoreFly: (feeds: { r: number; c: number; kind: Kind; points: number }[], onArrive: (points: number) => void) => void;
  bossFly: (cells: { r: number; c: number; kind: Kind }[], damage: number, onHit: (damage: number) => void) => void;
  spill: (cells: { r: number; c: number }[], tint?: "urine" | "lab" | "water" | "glass" | "red", shards?: boolean) => void;
  stars: () => void;
};

const GLOW: Record<Kind, string> = {
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
  rattle: "#7aa6ff",
  scan: "#5ec8ff",
  ruby: "#ff3344",
  gilt: "#ffc53a",
  glow: "#3dff78",
  plus: "#ffbf1a",
  gem: "#fff4ff",
  iv: "#3ec6ff",
  slate: "#8ec5ff",
  flask: "#3ec0ff",
  tubes: "#49b7ff",
  scope: "#d7dde8",
  biohaz: "#ff8a1e",
  eyewash: "#3d7dff",
  cyl: "#4db4ff",
  goggles: "#9fd7ff",
  extinguisher: "#ff3b3b",
  boot: "#3d7dff",
  xray: "#7dff9a",
  ribs: "#f4f7fb",
  calcium: "#ff5a6a",
  badge: "#ff3344",
  screw: "#d5dbe6",
  wrap: "#f0d24a",
  pelvis: "#f7f4ef",
};

const SPRITES: Kind[] = [...KINDS];

function loadSprites() {
  const images = new Map<Kind, HTMLImageElement>();
  for (const kind of SPRITES) {
    const image = new Image();
    image.src = `/sprites/${kind}.png`;
    images.set(kind, image);
  }
  return images;
}

export function ParticleLayer({
  boardRef,
  scoreRef,
  bossRef,
  rows,
  cols,
  apiRef,
}: {
  boardRef: { current: HTMLDivElement | null };
  scoreRef: { current: HTMLElement | null };
  bossRef: { current: HTMLElement | null };
  rows: number;
  cols: number;
  apiRef: { current: ParticleHandle | null };
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const world = new ParticleWorld();
    const seekers: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      points: number;
      homing: boolean;
      boss: boolean;
      star: boolean;
      flash: boolean;
      flame?: boolean;
      glitter?: boolean;
      scale?: number;
      age: number;
      trail: { x: number; y: number }[];
    }[] = [];
    const drops: { x: number; y: number; vx: number; vy: number; r: number; age: number; pooled: boolean; catch: boolean; tint: "urine" | "lab" | "water" | "glass" | "red" }[] = [];
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

    const pointFor = (r: number, c: number) => {
      const board = boardRef.current;
      const hostRect = host.getBoundingClientRect();
      if (!board) return { x: hostRect.width / 2, y: hostRect.height / 2 };
      const rect = board.getBoundingClientRect();
      return {
        x: rect.left - hostRect.left + ((c + 0.5) / cols) * rect.width,
        y: rect.top - hostRect.top + ((r + 0.5) / rows) * rect.height,
      };
    };

    const scorePoint = () => {
      const hostRect = host.getBoundingClientRect();
      const score = scoreRef.current;
      if (!score) return { x: hostRect.width * 0.72, y: 28 };
      const rect = score.getBoundingClientRect();
      return {
        x: rect.left - hostRect.left + rect.width / 2,
        y: rect.top - hostRect.top + rect.height / 2,
      };
    };

    const bossPoint = () => {
      const hostRect = host.getBoundingClientRect();
      const boss = bossRef.current;
      if (!boss) return { x: hostRect.width * 0.18, y: 86 };
      const rect = boss.getBoundingClientRect();
      return {
        x: rect.left - hostRect.left + rect.width / 2,
        y: rect.top - hostRect.top + rect.height * 0.42,
      };
    };

    const drawStar = (x: number, y: number, spin: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.fillStyle = "#ffe56a";
      ctx.shadowColor = "#fff1a8";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? 11 : 4.4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawGlow = (x: number, y: number, color: string, age: number, trail: { x: number; y: number }[]) => {
      if (trail.length > 1) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(trail[0]!.x, trail[0]!.y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i]!.x, trail[i]!.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.strokeStyle = "#fffef8";
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.restore();
      }
      const pulse = 22 + Math.sin(age * 22) * 3;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, pulse);
      halo.addColorStop(0, "#ffffff");
      halo.addColorStop(0.18, "#fffef8");
      halo.addColorStop(0.42, color);
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 5.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawFlame = (x: number, y: number, color: string, age: number, trail: { x: number; y: number }[], scale: number, homing: boolean) => {
      const fade = homing ? 1 : Math.max(0, 1 - age / 0.55);
      const radius = (homing ? 18 : 7) * scale;
      ctx.save();
      ctx.globalAlpha = fade;
      if (trail.length > 1) {
        ctx.lineCap = "round";
        ctx.strokeStyle = color;
        ctx.shadowColor = "#ff5a1f";
        ctx.shadowBlur = 12;
        ctx.lineWidth = (homing ? 6 : 2.4) * scale * fade;
        ctx.beginPath();
        ctx.moveTo(trail[0]!.x, trail[0]!.y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i]!.x, trail[i]!.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
      halo.addColorStop(0, "#fffef2");
      halo.addColorStop(0.28, "#ffe14a");
      halo.addColorStop(0.55, color);
      halo.addColorStop(1, "rgba(180, 20, 0, 0)");
      ctx.shadowColor = "#ff3b00";
      ctx.shadowBlur = homing ? 18 : 8;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawGlitter = (x: number, y: number, color: string, age: number, trail: { x: number; y: number }[], scale: number, homing: boolean) => {
      const fade = homing ? 1 : Math.max(0, 1 - age / 0.48);
      for (let i = 0; i < trail.length; i++) {
        const point = trail[i]!;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(age * 30 + i * 1.7));
        const size = (homing ? 3.4 : 2.1) * scale * (0.55 + twinkle);
        ctx.save();
        ctx.globalAlpha = fade * twinkle;
        ctx.translate(point.x + Math.sin(i * 2.2) * 4, point.y + Math.cos(i * 1.6) * 3);
        ctx.rotate(age * 9 + i);
        ctx.fillStyle = i % 2 === 0 ? "#fffef8" : color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.28, -size * 0.28);
        ctx.lineTo(size, 0);
        ctx.lineTo(size * 0.28, size * 0.28);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.28, size * 0.28);
        ctx.lineTo(-size, 0);
        ctx.lineTo(-size * 0.28, -size * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      const pulse = (homing ? 16 : 11) * scale;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, pulse);
      halo.addColorStop(0, "#ffffff");
      halo.addColorStop(0.32, color);
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffef8";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, pulse * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let onScore = (_points: number) => {};
    let onBoss = (_damage: number) => {};

    const kick = () => {
      if (!raf && alive) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const drawImp = (x: number, y: number, angle: number, alpha: number) => {
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
        const fade = body.age > body.life * 0.72 ? 1 - (body.age - body.life * 0.72) / (body.life * 0.28) : 1;
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
        const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 0.72);
        glow.addColorStop(0, GLOW[body.kind]);
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
        ctx.fill();
        if (image && image.complete && image.naturalWidth > 0) {
          ctx.drawImage(image, -size / 2, -size / 2, size, size);
        }
        ctx.restore();
      }
      for (const spark of seekers) {
        if (spark.star) drawStar(spark.x, spark.y, spark.age * 8);
        else if (spark.glitter) drawGlitter(spark.x, spark.y, spark.color, spark.age, spark.trail, spark.scale ?? 1, spark.homing);
        else if (spark.flame) drawFlame(spark.x, spark.y, spark.color, spark.age, spark.trail, spark.scale ?? 1, spark.homing);
        else if (spark.flash) {
          const t = Math.min(1, spark.age / 0.32);
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = spark.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, 8 + t * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else drawGlow(spark.x, spark.y, spark.color, spark.age, spark.trail);
      }
      for (const drop of drops) {
        const hold = drop.tint === "red" ? 1.35 : 0.85;
        const fade = drop.pooled ? Math.max(0, 1 - Math.max(0, drop.age - hold) / 0.7) : drop.tint === "glass" ? Math.max(0, 1 - drop.age / 1.15) : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, fade)) * (drop.tint === "glass" ? 0.85 : 0.92);
        if (drop.tint === "glass") {
          ctx.translate(drop.x, drop.y);
          ctx.rotate(drop.age * (drop.catch ? 2 : 8) + drop.r);
          ctx.fillStyle = drop.catch ? "rgba(255, 236, 240, 0.75)" : "rgba(236, 248, 255, 0.9)";
          ctx.strokeStyle = drop.catch ? "rgba(255, 80, 110, 0.9)" : "rgba(120, 190, 230, 0.95)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-drop.r, -drop.r * 0.3);
          ctx.lineTo(drop.r * 0.8, -drop.r * 0.1);
          ctx.lineTo(drop.r * 0.2, drop.r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          continue;
        }
        const pool = drop.pooled ? drop.r * (drop.tint === "red" ? 2.4 : 1.8) : drop.r;
        const ink =
          drop.tint === "red"
            ? ["#ffd5de", "#e1063a", "rgba(110, 0, 24, 0)"]
            : drop.tint === "lab"
            ? ["#e7f6ff", "#3aa0ff", "rgba(20, 90, 210, 0)"]
            : drop.tint === "water"
              ? ["#ffffff", "#c5ecff", "rgba(160, 210, 255, 0)"]
              : ["#fff3a8", "#f0c43a", "rgba(196, 132, 20, 0)"];
        const blob = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, pool);
        blob.addColorStop(0, ink[0]);
        blob.addColorStop(0.45, ink[1]);
        blob.addColorStop(1, ink[2]);
        ctx.fillStyle = blob;
        ctx.beginPath();
        if (drop.pooled) ctx.ellipse(drop.x, drop.y, pool, pool * 0.42, 0, 0, Math.PI * 2);
        else ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      world.step(dt);
      const goal = scorePoint();
      for (let i = seekers.length - 1; i >= 0; i--) {
        const spark = seekers[i]!;
        spark.age += dt;
        if (spark.homing) {
          spark.trail.push({ x: spark.x, y: spark.y });
          if (spark.trail.length > 16) spark.trail.shift();
          const dest = spark.boss ? bossPoint() : goal;
          const dx = dest.x - spark.x;
          const dy = dest.y - spark.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 26 || spark.age > 0.85) {
            if (spark.boss) {
              if (spark.points > 0) onBoss(spark.points);
              const bits = ["#fffef8", "#ffe56a", spark.color, "#ffffff"];
              for (let n = 0; n < 14; n++) {
                const angle = (Math.PI * 2 * n) / 14;
                const speed = 80 + (n % 5) * 42;
                seekers.push({
                  x: dest.x,
                  y: dest.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed - 40,
                  color: bits[n % bits.length]!,
                  points: 0,
                  homing: false,
                  boss: false,
                  star: false,
                  flash: false,
                  glitter: true,
                  scale: 0.45 + (n % 3) * 0.12,
                  age: 0,
                  trail: [],
                });
              }
            } else if (spark.points > 0) onScore(spark.points);
            seekers.push({
              x: dest.x,
              y: dest.y,
              vx: 0,
              vy: 0,
              color: spark.color,
              points: 0,
              homing: false,
              boss: false,
              star: false,
              flash: true,
              age: 0,
              trail: [],
            });
            seekers.splice(i, 1);
            continue;
          }
          spark.vx += (dx / dist) * 5200 * dt;
          spark.vy += (dy / dist) * 5200 * dt;
          const speed = Math.hypot(spark.vx, spark.vy) || 1;
          const max = 1680;
          if (speed > max) {
            spark.vx = (spark.vx / speed) * max;
            spark.vy = (spark.vy / speed) * max;
          }
        } else if (spark.flash) {
          if (spark.age > 0.32) {
            seekers.splice(i, 1);
            continue;
          }
        } else if (spark.glitter) {
          spark.vy += 220 * dt;
          spark.vx *= 0.98;
          if (spark.age > 0.48) {
            seekers.splice(i, 1);
            continue;
          }
        } else if (spark.flame) {
          spark.trail.push({ x: spark.x, y: spark.y });
          if (spark.trail.length > 8) spark.trail.shift();
          spark.vy -= 40 * dt;
          spark.vx *= 0.99;
          if (spark.age > 0.55) {
            seekers.splice(i, 1);
            continue;
          }
        } else {
          spark.vy += 420 * dt;
          spark.vx *= 0.985;
          if (spark.age > 0.85) {
            seekers.splice(i, 1);
            continue;
          }
        }
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
      }
      const board = boardRef.current;
      const hostRect = host.getBoundingClientRect();
      const boardRect = board?.getBoundingClientRect();
      const floor = boardRect ? boardRect.bottom - hostRect.top - 8 : hostRect.height * 0.72;
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i]!;
        drop.age += dt;
        if (!drop.pooled) {
          drop.vy += (drop.tint === "glass" ? 1500 : 1680) * dt;
          drop.x += drop.vx * dt;
          drop.y += drop.vy * dt;
          if (drop.y >= floor) {
            drop.y = floor;
            if (drop.tint === "glass") {
              if (drop.catch) {
                drop.pooled = true;
                drop.vy = 0;
                drop.vx *= 0.15;
                drop.age = Math.max(drop.age, 0.35);
              } else {
                drop.vy *= -0.46;
                drop.vx *= 0.72;
                if (Math.abs(drop.vy) < 36 || drop.age > 1.15) {
                  drops.splice(i, 1);
                  continue;
                }
              }
            } else {
              drop.vy *= -0.18;
              drop.vx += (Math.random() - 0.5) * 80;
              drop.vx *= 0.45;
              if (Math.abs(drop.vy) < 40) {
                drop.pooled = true;
                drop.vy = 0;
                drop.age = 0.2;
              }
            }
          }
        } else {
          drop.vx *= 0.9;
          drop.x += drop.vx * dt;
          if (drop.tint === "glass") drop.y = floor;
          else drop.r += dt * 6;
          const gone = drop.tint === "red" ? 2.15 : drop.tint === "glass" ? 1.05 : 1.5;
          if (drop.age > gone) {
            drops.splice(i, 1);
            continue;
          }
        }
      }
      draw();
      if (world.bodies.length === 0 && seekers.length === 0 && drops.length === 0) {
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
            const angle = (Math.PI * 2 * i) / 6 + i * 0.18;
            const speed = 240 + (i % 3) * 110;
            world.spawn(
              kind,
              origin.x,
              origin.y,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed - 160,
              (i % 2 === 0 ? 11 : -11) + (kind === "pill" ? 8 : 0),
            );
          }
        }
        kick();
      },
      summon(cells, count = 6) {
        if (reduced || cells.length === 0) return;
        fit();
        for (let i = 0; i < count; i++) {
          const cell = cells[i % cells.length]!;
          const origin = pointFor(cell.r, cell.c);
          world.spawn("imp", origin.x + (i - count / 2) * 10, origin.y, (i - (count - 1) / 2) * 70, -460 - (i % 3) * 80, i % 2 === 0 ? 4 : -4);
        }
        kick();
      },
      rain() {
        if (reduced) return;
        const rect = fit();
        const kinds: Kind[] = [...KINDS];
        for (let i = 0; i < 40; i++) {
          const kind = kinds[i % kinds.length]!;
          world.spawn(kind, (rect.width * (i + 0.5)) / 40, -24 - (i % 6) * 18, (i % 2 === 0 ? 70 : -70), 40 + (i % 4) * 50, i % 2 === 0 ? 8 : -8);
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
              y: origin.y + (i % 2) * 7,
              vx: (dx / dist) * kick + (i - (count - 1) / 2) * 36,
              vy: (dy / dist) * kick - 30,
              color: GLOW[feed.kind],
              points,
              homing: true,
              boss: false,
              star: false,
              flash: false,
              age: 0,
              trail: [],
            });
          }
        }
        kick();
      },
      bossFly(cells, damage, onHit) {
        if (cells.length === 0 || damage <= 0) return;
        onBoss = onHit;
        if (reduced) {
          onHit(damage * cells.length);
          return;
        }
        fit();
        const goal = bossPoint();
        const shown = cells.slice(0, 24);
        for (let i = 0; i < shown.length; i++) {
          const cell = shown[i]!;
          const origin = pointFor(cell.r, cell.c);
          const dx = goal.x - origin.x;
          const dy = goal.y - origin.y;
          const dist = Math.hypot(dx, dy) || 1;
          seekers.push({
            x: origin.x,
            y: origin.y,
            vx: (dx / dist) * 720,
            vy: (dy / dist) * 720 - 40,
            color: GLOW[cell.kind],
            points: damage,
            homing: true,
            boss: true,
            star: false,
            flash: false,
            glitter: true,
            scale: 1,
            age: 0,
            trail: [],
          });
        }
        const extra = cells.length - shown.length;
        if (extra > 0) onHit(damage * extra);
        kick();
      },
      spill(cells, tint = "urine", shards = false) {
        if (reduced || cells.length < 3) return;
        fit();
        for (const cell of cells) {
          const origin = pointFor(cell.r, cell.c);
          if (tint !== "glass") {
            const spray = tint === "water" ? 42 : tint === "red" ? 26 : 18;
            for (let i = 0; i < 16; i++) {
              drops.push({
                x: origin.x + (i - 8) * 1.6,
                y: origin.y + (i % 3) * 2,
                vx: (i - 8) * spray,
                vy: tint === "water" ? -40 + (i % 4) * 22 : tint === "red" ? -120 + (i % 4) * 18 : 30 + (i % 5) * 28,
                r: tint === "red" ? 4.4 + (i % 4) : 3.2 + (i % 4),
                age: 0,
                pooled: false,
                catch: false,
                tint,
              });
            }
          }
          if (shards || tint === "glass") {
            for (let i = 0; i < 9; i++) {
              drops.push({
                x: origin.x + (i - 4) * 2,
                y: origin.y,
                vx: (i - 4) * 110,
                vy: -160 - (i % 3) * 50,
                r: 5 + (i % 3) * 1.4,
                age: 0,
                pooled: false,
                catch: tint === "red",
                tint: "glass",
              });
            }
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
          const angle = (Math.PI * 2 * i) / 22;
          const speed = 260 + (i % 5) * 70;
          seekers.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 80,
            color: "#ffe56a",
            points: 0,
            homing: false,
            boss: false,
            star: true,
            flash: false,
            age: 0,
            trail: [],
          });
        }
        kick();
      },
    };

    return () => {
      alive = false;
      apiRef.current = null;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [apiRef, boardRef, bossRef, cols, rows, scoreRef]);

  return (
    <div className="particle-host" ref={hostRef}>
      <canvas ref={canvasRef} className="particle-field" aria-hidden />
    </div>
  );
}
