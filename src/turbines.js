import { playerBox } from "./collision.js";
import { deathPose } from "./death-effects.js";
import { bloodBurst } from "./gore.js";
import { turbineBedY } from "./turbine-arena.js";
import { impulseProp } from "./props.js";

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
  // Physical objects reaching the blades fracture through the normal material
  // system; its bounded rubble keeps its identity, momentum and collision.
  for (const b of world.cover) if (b.hp > 0 && contact(h, b)) world.damageCover(b, 1000);
  for (const b of world.chunks) if (b.hp > 0 && inside(h, { x: b.x + b.w / 2, y: b.y + b.h / 2 })) {
    impulseProp(b, h.dir * b.mass * 400 * dt, -b.mass * 1000 * dt, b.x, b.y);
  }
}

// Keep the machine acting on individual physical pieces during the result too.
// This never awards a second death and never resurrects consumed/ash remains.
export function tumbleTurbineBody(world, rag, dt) {
  if (dt <= 0 || world.prediction || !world.arena.turbine || !["fight", "result"].includes(world.phase) ||
      rag.capturedBy || rag.ash || rag.effect === "singularity") return;
  for (const h of world.hazards) {
    if (h.type !== "turbine" || h.done || !rag.points.some(p => inside(h, p, 5))) continue;
    if (rag.effect !== "blend") {
      delete rag.anchor;
      rag.points = rag.points.slice(0, 11);
      deathPose(rag, "blend");
      bloodBurst(world, rag.points[0].x, rag.points[0].y, 0, -300, 18);
    }
    rag.life = Math.max(rag.life, 1.5);
    for (const [i, p] of rag.points.entries()) {
      if (!inside(h, p, 5)) continue;
      const dx = p.x - h.bodyX, dy = p.y - h.bodyY, d = Math.hypot(dx, dy) || 1;
      p.px -= (-dy / d * h.dir * 750 + dx / d * 220) * dt * dt;
      p.py -= dx / d * h.dir * 450 * dt * dt;
      // Each blade catches settled pieces at a different time. Impulses feed
      // the existing Verlet gravity, joint rotation and concrete contacts.
      const phase = world.time * 1.8 + i * .173 + h.id * .31;
      if (p.y > turbineBedY(p.x) - 85 && Math.floor(phase) !== Math.floor(phase - dt * 1.8)) {
        const vx = (p.x - p.px) / dt + h.dir * (160 + i % 3 * 35);
        const vy = (p.y - p.py) / dt - 380 - i % 4 * 30;
        p.px = p.x - Math.max(-550, Math.min(550, vx)) * dt;
        p.py = p.y - Math.max(-550, Math.min(550, vy)) * dt;
      }
    }
  }
}
