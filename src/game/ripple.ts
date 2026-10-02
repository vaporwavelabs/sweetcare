/** Height-field liquid. A connected match pours one dent in the shape of that group; the wave travels out from the group's edge, not from a ring around each icon. */
export class RippleSim {
  readonly size: number;
  cur: Float32Array;
  prev: Float32Array;
  energy = 0;

  constructor(size = 104) {
    this.size = size;
    this.cur = new Float32Array(size * size);
    this.prev = new Float32Array(size * size);
  }

  drop(nx: number, ny: number, radius: number, amp: number) {
    const { size, cur } = this;
    const cx = nx * (size - 1);
    const cy = ny * (size - 1);
    const r = Math.max(1.4, radius * size);
    const r2 = r * r;
    const x0 = Math.max(1, Math.floor(cx - r));
    const x1 = Math.min(size - 2, Math.ceil(cx + r));
    const y0 = Math.max(1, Math.floor(cy - r));
    const y1 = Math.min(size - 2, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const fall = 1 - d2 / r2;
        cur[y * size + x] = (cur[y * size + x] ?? 0) + amp * fall * fall;
      }
    }
    this.energy = 1;
  }

  /**
   * Same impulse as before: a drop on each connected cell plus a pour along each shared side.
   * Groups smaller than three do not move the gel. Wave speed is the height-field step, unchanged.
   */
  splash(
    cells: { r: number; c: number }[],
    cols: number,
    rows: number,
    power: number,
    frame: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 1, h: 1 },
  ) {
    if (cols < 1 || rows < 1 || frame.w <= 0 || frame.h <= 0) return;
    const nx = (c: number) => frame.x + ((c + 0.5) / cols) * frame.w;
    const ny = (r: number) => frame.y + ((r + 0.5) / rows) * frame.h;
    for (const group of connectedGroups(cells)) {
      if (group.length < 3) continue;
      const linked = new Set(group.map((cell) => `${cell.r},${cell.c}`));
      for (const cell of group) this.drop(nx(cell.c), ny(cell.r), 0.06, -1.05 * power);
      for (const cell of group) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ] as const) {
          if (!linked.has(`${cell.r + dr},${cell.c + dc}`)) continue;
          for (let t = 0.2; t <= 0.8; t += 0.2) {
            this.drop(nx(cell.c + dc * t), ny(cell.r + dr * t), 0.038, -0.62 * power);
          }
        }
      }
    }
  }

  step() {
    const { size } = this;
    const cur = this.cur;
    const prev = this.prev;
    let peak = 0;
    for (let y = 1; y < size - 1; y++) {
      const row = y * size;
      for (let x = 1; x < size - 1; x++) {
        const i = row + x;
        let next =
          ((cur[i - 1]! + cur[i + 1]! + cur[i - size]! + cur[i + size]!) * 0.5 - prev[i]!) * 0.988;
        if (next > 1.6) next = 1.6;
        else if (next < -1.6) next = -1.6;
        prev[i] = next;
        const mag = next < 0 ? -next : next;
        if (mag > peak) peak = mag;
      }
    }
    this.cur = prev;
    this.prev = cur;
    this.energy = peak;
  }

  sample(nx: number, ny: number) {
    const { size, cur } = this;
    const x = Math.max(0, Math.min(0.999, nx)) * (size - 1);
    const y = Math.max(0, Math.min(0.999, ny)) * (size - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const i = y0 * size + x0;
    const a = cur[i] ?? 0;
    const b = cur[i + 1] ?? 0;
    const c = cur[i + size] ?? 0;
    const d = cur[i + size + 1] ?? 0;
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  grad(nx: number, ny: number) {
    const e = 1.6 / this.size;
    return {
      x: this.sample(nx + e, ny) - this.sample(nx - e, ny),
      y: this.sample(nx, ny + e) - this.sample(nx, ny - e),
    };
  }
}

/** Orthogonal clusters only. A diagonal touch is not a connection. */
function connectedGroups(cells: { r: number; c: number }[]) {
  const key = (r: number, c: number) => `${r},${c}`;
  const present = new Set(cells.map((cell) => key(cell.r, cell.c)));
  const seen = new Set<string>();
  const groups: { r: number; c: number }[][] = [];
  for (const cell of cells) {
    const start = key(cell.r, cell.c);
    if (seen.has(start)) continue;
    const group: { r: number; c: number }[] = [];
    const stack = [cell];
    seen.add(start);
    while (stack.length) {
      const cur = stack.pop()!;
      group.push(cur);
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const r = cur.r + dr;
        const c = cur.c + dc;
        const next = key(r, c);
        if (!present.has(next) || seen.has(next)) continue;
        seen.add(next);
        stack.push({ r, c });
      }
    }
    groups.push(group);
  }
  return groups;
}
