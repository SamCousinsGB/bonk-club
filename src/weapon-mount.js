import { segmentBox } from "./collision.js";

// Weapon art is drawn at the physical right hand, rotated into the aim direction.
export function weaponMuzzle(player, length = 54, angle = player.aimAngle ?? (player.facing === 1 ? 0 : Math.PI)) {
  const hand = player.rig?.[6] || { x: player.x, y: player.y - 10 };
  return { x: hand.x + Math.cos(angle) * length, y: hand.y + Math.sin(angle) * length };
}

export function projectileMuzzle(world, player, type, ax, ay) {
  const length = { flame: 47, bubble: 42, duck: 46, boomerang: 20,
    crossbow: 51, harpoon: 59, shrapnel: 48, firework: 48 }[type];
  if (!length) return { x: player.x + ax * 12, y: player.y - 10 + ay * 12 };
  const muzzle = weaponMuzzle(player, length, Math.atan2(ay, ax));
  const x = player.x, y = player.y - 10;
  // An extended barrel must not spawn its projectile through intervening cover.
  const hit = world.solids().map(s => segmentBox(x, y, muzzle.x, muzzle.y, s))
    .filter(Boolean).sort((a, b) => a.t - b.t)[0];
  if (!hit) return muzzle;
  return { x: x + (muzzle.x - x) * hit.t + hit.nx * .2,
    y: y + (muzzle.y - y) * hit.t + hit.ny * .2 };
}
