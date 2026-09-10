import { segmentBox } from "./collision.js";

// Shared passive-body solver. Particles, rather than a hidden upright rectangle,
// carry a knocked-down fighter through walls, floors and moving wreckage.
export function collidePoint(
  p,
  solids,
  radius = 3,
  origin = p,
  carried = new Set(),
) {
  const ox = origin.x,
    oy = origin.y;
  for (const s of solids) {
    if (s.hp === 0) continue;
    const hit = segmentBox(ox, oy, p.x, p.y, s, radius);
    if (!hit) continue;
    const inside =
      ox > s.x - radius &&
      ox < s.x + s.w + radius &&
      oy > s.y - radius &&
      oy < s.y + s.h + radius;
    let nx = hit.nx,
      ny = hit.ny,
      x = ox + (p.x - ox) * hit.t,
      y = oy + (p.y - oy) * hit.t;
    if (inside) {
      const exits = [
        p.x - s.x + radius,
        s.x + s.w + radius - p.x,
        p.y - s.y + radius,
        s.y + s.h + radius - p.y,
      ];
      const side = exits.indexOf(Math.min(...exits));
      nx = side === 0 ? -1 : side === 1 ? 1 : 0;
      ny = side === 2 ? -1 : side === 3 ? 1 : 0;
      x = nx < 0 ? s.x - radius : nx > 0 ? s.x + s.w + radius : p.x;
      y = ny < 0 ? s.y - radius : ny > 0 ? s.y + s.h + radius : p.y;
    }
    const vx = p.x - p.px,
      vy = p.y - p.py,
      normal = vx * nx + vy * ny;
    p.x = x + nx * 0.05;
    p.y = y + ny * 0.05;
    p.px = p.x - (vx - normal * nx) * 0.78;
    p.py = p.y - (vy - normal * ny) * 0.78;
    if (ny === -1 && !carried.has(s.id)) {
      p.x += s.dx || 0;
      p.y += s.dy || 0;
      carried.add(s.id);
    }
  }
}

export function passiveBody(
  points,
  joints,
  solids,
  dt,
  { gravity = 1800, anchor = null } = {},
) {
  const origins = points.map((p) => ({ x: p.x, y: p.y }));
  const carried = points.map(() => new Set());
  for (const p of points) {
    const vx = (p.x - p.px) * 0.992,
      vy = (p.y - p.py) * 0.992;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + gravity * dt * dt;
  }
  for (let n = 0; n < 7; n++) {
    for (const [ai, bi, len] of joints) {
      const a = points[ai],
        b = points[bi],
        dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy) || 1,
        k = ((d - len) / d) * 0.5;
      a.x += dx * k;
      a.y += dy * k;
      b.x -= dx * k;
      b.y -= dy * k;
    }
    for (let i = 0; i < points.length; i++)
      collidePoint(points[i], solids, i === 0 ? 10 : 3, origins[i], carried[i]);
    if (anchor) {
      const p = points[anchor.point];
      p.x = p.px = anchor.x;
      p.y = p.py = anchor.y;
    }
  }
}
