// Verlet particles retain momentum. Gravity bends their trajectories; it does
// not prescribe a position, orbital radius or target velocity every frame.
const GRAVITY = 210000000;
const SOFTENING = 75;
export function seedOrbit(p, center, drift = 1) {
  const dx = p.x - center.x,
    dy = p.y - center.y,
    d = Math.max(1, Math.hypot(dx, dy));
  const nx = d === 1 ? Math.cos((p.id || 1)*2.399963) : dx/d,
    ny = d === 1 ? Math.sin((p.id || 1)*2.399963) : dy/d;
  const speed = Math.sqrt(GRAVITY * d * d / (d * d + SOFTENING ** 2) ** 1.5) * .86;
  const vx = Number.isFinite(p.px) ? (p.x - p.px) * 120 : p.vx || 0,
    vy = Number.isFinite(p.py) ? (p.y - p.py) * 120 : p.vy || 0;
  p.px = p.x - (vx - ny * speed - nx * 65 * drift) / 120;
  p.py = p.y - (vy + nx * speed - ny * 65 * drift) / 120;
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
  const nx = d === 1 ? Math.cos((p.id || 1)*2.399963) : dx/d,
    ny = d === 1 ? Math.sin((p.id || 1)*2.399963) : dy/d,
    age = center.age || 0,
    gravity = GRAVITY * d / (d * d + SOFTENING ** 2) ** 1.5,
    // A soft pressure region lets close passes rebound. Nothing is pinned to
    // its edge, and the pressure disappears for the final compression.
    pressure = Math.max(0, minRadius - d) * 650,
    phase = age * 8 + Math.atan2(dy, dx) * 3 + d * .018,
    surge = Math.sin(phase) * 460 + Math.sin(age * 13 - d * .027) * 240,
    torque = 110 + Math.cos(phase * .73 + age * 3) * 330,
    drag = Math.exp(-dt * (.08 + drift * .18));
  let vx = (p.x - p.px) / dt * drag + (nx * (pressure - gravity + surge) - ny * torque) * dt,
    vy = (p.y - p.py) / dt * drag + (ny * (pressure - gravity + surge) + nx * torque) * dt;
  const speed = Math.hypot(vx, vy);
  if (speed > 2200) { vx *= 2200 / speed; vy *= 2200 / speed; }
  p.px = p.x;
  p.py = p.y;
  p.x += vx * dt;
  p.y += vy * dt;
}
// Soft tension stores and releases stretch while leaving every hinge free to
// fold. The separate maximum-length constraint only catches extreme extension.
export function springRope(points, rest, dt, stiffness = 550) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y,
      d = Math.hypot(dx, dy) || 1,
      tension = Math.max(0, d - rest * 1.4) * stiffness * dt * dt / d;
    a.px -= dx * tension; a.py -= dy * tension;
    b.px += dx * tension; b.py += dy * tension;
  }
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
