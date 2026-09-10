import { segmentBox, playerBox } from "./collision.js";

export const BUBBLE_TIME = 2.4;
export const BURN_DAMAGE = 18;

export function steerBoomerang(world, b, dt) {
  if (b.kind !== "boomerang" || b.life > 1.95) return;
  if (!b.returning) { b.returning = true; b.hitIds = []; }
  const owner = world.players.find(p => p.id === b.owner && p.alive);
  if (!owner) return;
  const current = Math.atan2(b.vy, b.vx), goal = Math.atan2(owner.y - 10 - b.y, owner.x - b.x);
  const delta = Math.atan2(Math.sin(goal - current), Math.cos(goal - current));
  const angle = current + Math.max(-9 * dt, Math.min(9 * dt, delta));
  b.vx = Math.cos(angle) * 780; b.vy = Math.sin(angle) * 780;
  if (b.life < 1.7 && segmentBox(b.x, b.y, b.x + b.vx * dt, b.y + b.vy * dt, playerBox(owner), b.r)) {
    b.life = 0;
    world.event("pickup", { x: owner.x, y: owner.y - 10, color: owner.color });
  }
}
