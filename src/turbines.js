import { playerBox } from "./collision.js";
import { deathPose } from "./death-effects.js";
import { bloodBurst } from "./gore.js";
import { impulseProp } from "./props.js";

export const turbineZone = h => ({ x: h.bodyX - h.w / 2, y: h.bodyY - h.w / 2, w: h.w, h: h.w });
const inside = (h, p, margin = 0) => Math.hypot(p.x - h.bodyX, p.y - h.bodyY) < h.w / 2 + margin;
const contact = (h, box) => inside(h, {
  x: Math.max(box.x, Math.min(box.x + box.w, h.bodyX)),
  y: Math.max(box.y, Math.min(box.y + box.h, h.bodyY)),
});

export function updateTurbine(world, h, dt) {
  if (world.prediction) return;
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
    for (const p of rag.points) {
      if (!inside(h, p, 5)) continue;
      const dx = p.x - h.bodyX, dy = p.y - h.bodyY, d = Math.hypot(dx, dy) || 1;
      p.px -= (-dy / d * h.dir * 750 + dx / d * 220) * dt * dt;
      p.py -= dx / d * h.dir * 450 * dt * dt;
      // The lower half of the exposed rotor throws loose matter back upward.
      // This is blade force, not a hidden supporting surface.
      const lower = Math.max(0, Math.min(1, (p.y - (h.bodyY - 35)) / 150));
      p.py += lower * 5200 * dt * dt;
    }
    // A blade catches a whole severed piece, with off-centre torque. Driving
    // both ends together avoids the length constraint swallowing its impulse.
    const pieces = [[0], [1,2], [3,4], [5,6], [7,8], [9,10]];
    for (const [i, ids] of pieces.entries()) {
      const phase = world.time * 1.35 + i * .173 + h.id * .31;
      const points = ids.map(i => rag.points[i]);
      const cx = points.reduce((n,p)=>n+p.x,0)/points.length;
      const cy = points.reduce((n,p)=>n+p.y,0)/points.length;
      if (points.some(p=>inside(h,p,5)) && cy > h.bodyY + 105) {
        for (const p of points) {
          const vx=(p.x-p.px)/dt+h.dir*190,vy=Math.min((p.y-p.py)/dt,-620);
          p.px=p.x-Math.max(-800,Math.min(800,vx))*dt;
          p.py=p.y-Math.max(-800,Math.min(800,vy))*dt;
        }
      }
      if (Math.floor(phase) === Math.floor(phase - dt * 1.35) ||
          !points.some(p => inside(h, p, 5) && p.y > h.bodyY - 80)) continue;
      for (const p of points) {
        const spin = i % 2 ? 9 : -9;
        const vx = (p.x-p.px)/dt + h.dir*(160+i%3*35) - (p.y-cy)*spin;
        const vy = (p.y-p.py)/dt - 650 + (p.x-cx)*spin;
        p.px = p.x - Math.max(-800,Math.min(800,vx))*dt;
        p.py = p.y - Math.max(-800,Math.min(800,vy))*dt;
      }
    }
  }
}
