import { playerBox } from "./collision.js";
import { FURNACE_CYCLE, FURNACE_ON, FURNACE_WARNING, FURNACE_COOLING } from "./furnace-arena.js";

export function furnaceHeat(h) {
  if (!h || h.done) return 0;
  if (h.active) return 1;
  const phase = (h.age + 1e-9) % FURNACE_CYCLE;
  return h.age + 1e-9 >= FURNACE_CYCLE && phase < FURNACE_COOLING
    ? 1 - phase / FURNACE_COOLING : 0;
}

export function updateFurnace(world, h, dt) {
  // A destroyed mounting disables the machine until the next round, including
  // its heat. The same done identity is already transported to late joiners.
  if (!world.platforms.some(p => p.hp !== 0 && !p.wreckId &&
      Math.abs(p.y - h.y) < 2 && p.x <= h.x && p.x + p.w >= h.x)) {
    h.done = true; h.active = false; h.warning = 0; return;
  }
  h.age += dt;
  const oldActive = h.active, phase = (h.age + 1e-9) % FURNACE_CYCLE;
  h.active = h.type === "slag" || phase >= FURNACE_ON;
  h.warning = h.type === "furnace" && !h.active && phase >= FURNACE_WARNING ? FURNACE_ON - phase : 0;
  h.duration = h.active && h.type === "furnace" ? FURNACE_CYCLE - phase : 0;
  h.cooldown = h.active ? 0 : FURNACE_ON - phase;
  if (h.active !== oldActive) {
    h.hitIds = []; h.hitTimer = 0;
    if (h.active && h.type === "furnace") world.event("hazard", { x: h.x, y: h.y, kind: "tesla" });
  }
  if (world.prediction) return;
  const heat = furnaceHeat(h);
  if (!h.active && heat <= 0) return;
  h.hitTimer -= dt;
  if (h.hitTimer <= 0) { h.hitIds = []; h.hitTimer = .5; }
  for (const p of world.players) {
    if (!p.alive || h.hitIds.includes(p.id)) continue;
    const b = playerBox(p), top = h.active ? h.y - h.h : h.y - 15;
    if (b.x + b.w <= h.x - h.w / 2 || b.x >= h.x + h.w / 2 ||
        b.y + b.h <= top || b.y >= h.y + (h.type === "furnace" && h.active ? 420 : 0)) continue;
    h.hitIds.push(p.id);
    const arc = h.type === "furnace" && h.active;
    world.hit(p, { x: h.x, y: h.y, vx: 0, vy: 0 }, h.active ? 1000 : 6,
      h.active ? 900 : 0, Math.sign(p.x - h.x) || h.dir, -.65,
      { blast: true, effect: arc ? "tesla" : "burn", cause: arc ? "electrified" : "burn",
        hitstop: arc ? .012 : 0 });
  }
}
