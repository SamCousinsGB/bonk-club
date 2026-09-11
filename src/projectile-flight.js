import { W, H } from "./scale.js";

export const MAX_PROJECTILES = 512;
// Distant shots keep flying on the host. Only nearby shots need drawing or transport.
// The margin includes edge-of-map black holes and returning weapons.
export const projectileInArena = b => b.x > -700 && b.x < W + 700 && b.y > -3700 && b.y < H + 700;
export function canSpawnProjectiles(world, count = 1) {
  return world.projectiles.filter(b => b.life > 0 && projectileInArena(b)).length + count <= MAX_PROJECTILES;
}
export function advanceFlight(b, dt) {
  b.age = (b.age || 0) + dt;
  // A fuse is an intentional detonation. Ordinary projectiles have no flight timeout.
  if (b.kind === "grenade") b.life -= dt;
}
