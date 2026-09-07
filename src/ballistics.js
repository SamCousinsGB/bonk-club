import { segmentBox } from "./collision.js";
import { W, H } from "./scale.js";
import { clamp, distance } from "./navigation.js";

// Predict the real fuse and bounces, rather than treating a grenade as a bullet.
export function grenadeLanding(p, weapon, angle, solids) {
  let x = p.x + Math.cos(angle) * 12,
    y = p.y - 10 + Math.sin(angle) * 12,
    vx = Math.cos(angle) * weapon.speed,
    vy = Math.sin(angle) * weapon.speed - (weapon.lift ?? 330);
  const dt = 1 / 60,
    radius = weapon.r || 7;
  for (let age = 0; age < weapon.life; age += dt) {
    vy += 1100 * dt;
    const endX = x + vx * dt,
      endY = y + vy * dt;
    let hit = null;
    for (const s of solids) {
      const collision = segmentBox(x, y, endX, endY, s, radius);
      if (collision && (!hit || collision.t < hit.t)) hit = collision;
    }
    if (hit) {
      x += (endX - x) * hit.t + hit.nx * 0.2;
      y += (endY - y) * hit.t + hit.ny * 0.2;
      if (hit.nx) vx *= -0.6;
      if (hit.ny) {
        vy *= -0.6;
        vx *= 0.8;
      }
    } else {
      x = endX;
      y = endY;
    }
    if (x < -80 || x > W + 80 || y > H + 80) break;
  }
  return { x, y };
}

export function grenadePlan(p, enemy, weapon, solids) {
  const target = {
    x: clamp(enemy.x + enemy.vx * 0.3, 20, W - 20),
    y: enemy.y - 10,
  };
  const dir = Math.sign(target.x - p.x) || p.facing;
  const radius = weapon.radius || 145;
  let best = null;
  for (let n = 0; n <= 36; n++) {
    const elevation = -1.45 + (n * 2.9) / 36;
    const angle = Math.atan2(Math.sin(elevation), dir * Math.cos(elevation));
    const point = grenadeLanding(p, weapon, angle, solids);
    const miss = distance(point, target);
    if (
      miss > radius * 0.85 ||
      distance(point, p) < radius + 100 ||
      solids.some((s) => segmentBox(point.x, point.y, target.x, target.y, s))
    )
      continue;
    if (!best || miss < best.miss) best = { angle, miss };
  }
  return best;
}
