import { prepareProp, bodyBounds } from "./props.js";

export const CARGO_LIMIT = 14;
export function releaseCargo(world, h) {
  // Retire spent source bodies, never their persistent physical fragments.
  world.cover = world.cover.filter(b => !b.id.startsWith("cargo") || b.hp > 0);
  if (world.cover.length >= 64 || world.cover.filter(b => b.id.startsWith("cargo")).length >= CARGO_LIMIT) return false;
  const foundry=world.arena?.theme==='foundry';
  const w = (foundry?52:78) + Math.floor(world.random() * 35), height = (foundry?48:90) + Math.floor(world.random() * (foundry?35:62));
  const x = h.x - w / 2, y = h.y - height - 5;
  // Backed-up cargo blocks the outlet until real physics clears it.
  if (world.cover.some(b => { const box = bodyBounds(b); return b.hp > 0 &&
    box.x < x + w + 10 && box.x + box.w > x - 10 && box.y < y + height && box.y + box.h > y; })) return false;
  world.cover.push(prepareProp({ id: `cargo${++world.cargoSerial}`, kind: foundry?"cabinet":"crate",
    x, y, w, h: height, hp: 85, maxHp: 85, vx: foundry?h.dir*180:-430, vy: 0, angle: 0, spin: foundry?h.dir*.7:0 }));
  world.terrainVersion++;
  return true;
}
