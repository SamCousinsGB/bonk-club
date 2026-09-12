import { playerBox } from "./collision.js";
import { deathPose } from "./death-effects.js";
import { bloodBurst } from "./gore.js";

export const turbineZone = h => ({ x: h.bodyX - h.w / 2, y: h.bodyY - h.w / 2, w: h.w, h: h.w });
const inside = (h, p, margin = 0) => Math.hypot(p.x - h.bodyX, p.y - h.bodyY) < h.w / 2 + margin;
const contact = (h, box) => inside(h, {
  x: Math.max(box.x, Math.min(box.x + box.w, h.bodyX)),
  y: Math.max(box.y, Math.min(box.y + box.h, h.bodyY)),
});

export function updateTurbine(world, h, dt) {
  if (world.prediction) return;
  if (!world.platforms.some(p => p.hp !== 0 && Math.abs(p.y - h.y) < 2 && p.x <= h.x && p.x + p.w >= h.x)) {
    h.done = true; h.active = false; h.warning = 0; return;
  }
  h.age += dt; h.active = true; h.warning = 0; h.cooldown = 0; h.duration = 1;
  for (const p of world.players) {
    if (!p.alive || !contact(h, playerBox(p))) continue;
    // Contact executes even a prone, frozen or recovering fighter. A parry
    // cannot stop a machine. The host creates the same six physical pieces.
    world.kill(p, { effect: "blend", cause: "turbine", angle: h.dir });
  }
  for (const rag of world.ragdolls) {
    if (rag.effect === "singularity" || !rag.points.some(p => inside(h, p, 5))) continue;
    if (rag.effect !== "blend") {
      delete rag.ash; delete rag.anchor;
      deathPose(rag, "blend"); bloodBurst(world, rag.points[0].x, rag.points[0].y, 0, -300, 18);
    }
    for (const p of rag.points) if (inside(h, p, 5)) {
      const dx = p.x - h.bodyX, dy = p.y - h.bodyY, d = Math.hypot(dx, dy) || 1;
      // Bounded tangential impulses keep severed parts tumbling and eject them
      // upward. Existing gravity and solid contacts still run every tick.
      p.px -= (-dy / d * h.dir * 1800 + dx / d * 450) * dt * dt;
      p.py -= (dx / d * h.dir * 1800 - 1700) * dt * dt;
    }
  }
  // Physical objects reaching the blades fracture through the normal material
  // system; its bounded rubble keeps its identity, momentum and collision.
  for (const b of world.cover) if (b.hp > 0 && contact(h, b)) world.damageCover(b, 1000);
  for (const b of world.chunks) if (b.hp > 0 && inside(h, { x: b.x + b.w / 2, y: b.y + b.h / 2 })) {
    b.vx += h.dir * 400 * dt; b.vy -= 1000 * dt; b.spin += h.dir * dt;
  }
}
