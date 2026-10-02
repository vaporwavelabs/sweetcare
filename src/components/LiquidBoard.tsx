import { useLayoutEffect, useRef } from "react";
import { RippleSim } from "@/game/ripple";

export type LiquidHandle = {
  splash: (cells: { r: number; c: number }[], power?: number) => void;
};

const PALETTE = ["#7a4de8", "#5b7cff", "#3ecf8e", "#ff7ad9", "#ffb03a", "#49b6ff", "#c06bff", "#ff6b8a", "#6d5cff", "#45d6c2"];

function colorFor(r: number, c: number) {
  return PALETTE[(r * 3 + c * 5 + ((r + c) % 3)) % PALETTE.length]!;
}

function mix(hex: string, toward: number, amt: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (toward - v) * amt);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function LiquidBoard({
  rows,
  cols,
  jelly,
  revision,
  scene,
  frame,
  apiRef,
}: {
  rows: number;
  cols: number;
  jelly: boolean[][];
  revision: number;
  scene: string;
  frame: { x: number; y: number; w: number; h: number };
  apiRef: { current: LiquidHandle | null };
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const jellyRef = useRef(jelly);
  jellyRef.current = jelly;
  const simRef = useRef<RippleSim | null>(null);
  if (!simRef.current) simRef.current = new RippleSim(104);
  const drawRef = useRef<() => void>(() => {});
  const photoRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
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
      const cssW = resize();
      if (cssW < 2) return;
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
      const amp = Math.min(cw, ch) * 0.28;

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
        bg.addColorStop(0.48, "#7d4fe2");
        bg.addColorStop(1, "#4f86f2");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.globalAlpha = 0.36;
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, "rgba(255,255,255,0.34)");
      wash.addColorStop(0.42, "rgba(186,236,255,0.1)");
      wash.addColorStop(1, "rgba(90,0,60,0.16)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const nx = 0.12 + i * 0.18;
        const ny = 0.2 + (i % 2) * 0.4;
        const wave = sim.grad(nx, ny);
        const px = nx * w + wave.x * 22;
        const py = ny * h + wave.y * 22;
        const gloss = ctx.createRadialGradient(px, py, 6, px, py, Math.min(w, h) * 0.3);
        gloss.addColorStop(0, "rgba(255,255,255,0.62)");
        gloss.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gloss;
        ctx.beginPath();
        ctx.ellipse(px, py, w * 0.24, h * 0.07, -0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = photo && photo.naturalWidth > 0 ? 0.42 : 1;
      ctx.filter = `blur(${Math.max(4, cw * 0.05)}px)`;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = gx + (c + 0.5) * cw;
          const cy = gy + (r + 0.5) * ch;
          const grow = 1.04 + ((r * 3 + c) % 3) * 0.02;
          const rx = cw * 0.56 * grow;
          const ry = ch * 0.56 * grow;
          ctx.beginPath();
          const steps = 28;
          for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            const ct = Math.cos(a);
            const st = Math.sin(a);
            const sx = Math.sign(ct) * Math.abs(ct) ** 0.55;
            const sy = Math.sign(st) * Math.abs(st) ** 0.55;
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
          const g = ctx.createRadialGradient(cx - rx * 0.22, cy - ry * 0.36, rx * 0.04, cx, cy + ry * 0.2, rx * 1.05);
          g.addColorStop(0, mix(base, 255, 0.78));
          g.addColorStop(0.28, mix(base, 255, 0.28));
          g.addColorStop(0.62, base);
          g.addColorStop(1, mix(base, 18, 0.42));
          ctx.fillStyle = g;
          ctx.fill();
        }
      }
      ctx.restore();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = gx + (c + 0.5) * cw;
          const cy = gy + (r + 0.5) * ch;
          const rx = cw * 0.48;
          const ry = ch * 0.48;
          const shine = sim.grad(cx / w, cy / h);
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
          ctx.clip();
          const gloss = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry * 0.2);
          gloss.addColorStop(0, "rgba(255,255,255,0.78)");
          gloss.addColorStop(0.34, "rgba(255,255,255,0.16)");
          gloss.addColorStop(0.52, "rgba(255,255,255,0)");
          gloss.addColorStop(1, "rgba(20, 0, 40, 0.18)");
          ctx.fillStyle = gloss;
          ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.ellipse(
            cx - rx * 0.28 + shine.x * amp * 1.4,
            cy - ry * 0.34 + shine.y * amp * 1.4,
            rx * 0.22,
            ry * 0.08,
            -0.45,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
          if (gel[r]?.[c]) {
            ctx.strokeStyle = "rgba(170, 255, 214, 0.7)";
            ctx.lineWidth = Math.max(2.5, cw * 0.04);
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx * 0.78, ry * 0.78, 0, 0.15, Math.PI * 1.2);
            ctx.stroke();
          }
        }
      }

      if (sim.energy > 0.04) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const stride = 7;
        for (let y = stride; y < sim.size - stride; y += stride) {
          for (let x = stride; x < sim.size - stride; x += stride) {
            const height = sim.cur[y * sim.size + x] ?? 0;
            const mag = Math.abs(height);
            if (mag < 0.1) continue;
            const px = (x / (sim.size - 1)) * w;
            const py = (y / (sim.size - 1)) * h;
            const rad = (0.28 + mag * 0.55) * Math.min(cw, ch);
            const ring = ctx.createRadialGradient(px, py, rad * 0.15, px, py, rad);
            const alpha = Math.min(0.55, mag * 0.48);
            ring.addColorStop(0, `rgba(255,255,255,${alpha})`);
            ring.addColorStop(0.5, `rgba(186, 236, 255, ${alpha * 0.28})`);
            ring.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = ring;
            ctx.beginPath();
            ctx.arc(px, py, rad, 0, Math.PI * 2);
            ctx.fill();
          }
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
      if (reduced || sim.energy < 0.02) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (!raf && alive) raf = requestAnimationFrame(loop);
    };

    apiRef.current = {
      splash(cells, power = 1) {
        if (reduced || cells.length === 0) return;
        sim.splash(cells, cols, rows, power, frameRef.current);
        kick();
      },
    };

    draw();
    return () => {
      alive = false;
      apiRef.current = null;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [apiRef, cols, rows, scene]);

  useLayoutEffect(() => {
    drawRef.current();
  }, [revision]);

  return <canvas ref={canvasRef} className="liquid" aria-hidden />;
}
