import { useLayoutEffect, useRef } from "react";
import { ParticleWorld, type ParticleKind } from "@/game/particles";
import { KINDS, type Kind } from "@/game/engine";

export type ParticleHandle = {
  burst: (cells: { r: number; c: number; kind: Kind }[]) => void;
  summon: (cells: { r: number; c: number }[], count?: number) => void;
  rain: () => void;
  scoreFly: (feeds: { r: number; c: number; kind: Kind; points: number }[], onArrive: (points: number) => void) => void;
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
  rows,
  cols,
  apiRef,
}: {
  boardRef: { current: HTMLDivElement | null };
  scoreRef: { current: HTMLElement | null };
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
      star: boolean;
      flash: boolean;
      age: number;
    }[] = [];
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

    const drawGlow = (x: number, y: number, vx: number, vy: number, color: string, age: number) => {
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
      halo.addColorStop(0.22, "#fffef8");
      halo.addColorStop(0.48, color);
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
    let onScore = (_points: number) => {};

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
        } else drawGlow(spark.x, spark.y, spark.vx, spark.vy, spark.color, spark.age);
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
          const dx = goal.x - spark.x;
          const dy = goal.y - spark.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 26 || spark.age > 0.85) {
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
              age: 0,
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
              star: false,
              flash: false,
              age: 0,
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
            star: true,
            flash: false,
            age: 0,
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
  }, [apiRef, boardRef, cols, rows, scoreRef]);

  return (
    <div className="particle-host" ref={hostRef}>
      <canvas ref={canvasRef} className="particle-field" aria-hidden />
    </div>
  );
}
