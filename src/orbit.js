// Planar flow with differential angular speed. Nearby particles overtake distant
// ones; connected ropes curl under that shear instead of scaling a whole sprite.
export function seedOrbit(p, center, drift = 1) {
  const dx = p.x - center.x,
    dy = p.y - center.y,
    d = Math.max(1, Math.hypot(dx, dy));
  const speed = d * (0.65 + 110 / (d + 50));
  p.px = p.x - ((-dy / d) * speed - (dx / d) * 24 * drift) / 120;
  p.py = p.y - ((dx / d) * speed - (dy / d) * 24 * drift) / 120;
}
export function orbitPoint(p, center, dt, drift = 1, minRadius = 0) {
  const dx = p.x - center.x,
    dy = p.y - center.y,
    d = Math.max(1, Math.hypot(dx, dy));
  if (d < 12 && !minRadius) {
    p.x = p.px = center.x;
    p.y = p.py = center.y;
    return;
  }
  const omega = 0.65 + 110 / (d + 50),
    sink = minRadius && d < minRadius ? (d - minRadius) * 3 : (22 + d * 0.085) * drift;
  const wantX = -dy * omega - (dx / d) * sink,
    wantY = dx * omega - (dy / d) * sink;
  const vx = (p.x - p.px) / dt,
    vy = (p.y - p.py) / dt,
    response = Math.min(1, dt * 4);
  p.px = p.x;
  p.py = p.y;
  p.x += (vx + (wantX - vx) * response - dx * omega * omega * dt) * dt;
  p.y += (vy + (wantY - vy) * response - dy * omega * omega * dt) * dt;
}
export function limitRope(points, rest, maxStretch = 5) {
  for (let n = 0; n < 2; n++)
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy) || 1;
      if (d <= rest * maxStretch) continue;
      const k = ((d - rest * maxStretch) / d) * 0.5;
      a.x += dx * k;
      a.y += dy * k;
      b.x -= dx * k;
      b.y -= dy * k;
    }
}
export function ribbonOutline(spine, width, center = null) {
  const sides = [[], []];
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i],
      a = spine[Math.max(0, i - 1)],
      b = spine[Math.min(spine.length - 1, i + 1)],
      dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.hypot(dx, dy) || 1;
    const half =
      width *
      0.5 *
      (center
        ? Math.min(1, Math.hypot(p.x - center.x, p.y - center.y) / 100)
        : 1);
    sides[0].push({ x: p.x - (dy / d) * half, y: p.y + (dx / d) * half });
    sides[1].push({ x: p.x + (dy / d) * half, y: p.y - (dx / d) * half });
  }
  return [...sides[0], ...sides[1].reverse()];
}
