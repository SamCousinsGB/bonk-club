import { W, H } from "./scale.js";

export const MAX_PROJECTILES = 512;
// Nearby shots remain available for edge interactions and returning weapons.
// The margin includes edge-of-map black holes and returning weapons.
export const projectileInArena = b => b.x > -700 && b.x < W + 700 && b.y > -3700 && b.y < H + 700;
// No lifetime timeout. Delete escaped shots without detonating or spawning fields
// outside the arena; upward throws and guided return flights retain their arc.
export function projectileEscaped(world,b) {
  const returning=(b.kind==='boomerang' && world.players.some(p=>p.alive&&p.id===b.owner)) ||
    (b.homing && world.players.some(p=>p.alive&&p.id!==b.owner));
  if(returning)return b.x < -5000 || b.x > W+5000 || b.y < -5000 || b.y > H+5000;
  return (b.y>H+700 && b.vy>=0) || (b.x<-700 && b.vx<=0) || (b.x>W+700 && b.vx>=0) ||
    (b.y<-3700 && b.vy<=0 && !['grenade','duck'].includes(b.kind));
}
export function canSpawnProjectiles(world, count = 1) {
  return (world.prediction ? world.projectileCount || 0 : world.projectiles.filter(b => b.life > 0 && projectileInArena(b)).length) + count <= MAX_PROJECTILES;
}
export function advanceFlight(b, dt) {
  b.age = (b.age || 0) + dt;
  // A fuse is an intentional detonation. Ordinary projectiles have no flight timeout.
  if (b.kind === "grenade") b.life -= dt;
}
