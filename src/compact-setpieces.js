import { playerBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { addWater } from "./reactions.js";
import { bodyBounds, impulseProp } from "./props.js";

export { updatePlane as updateAirflow } from "./plane.js";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const overlap = (a, b) => a.x + a.w > b.x && a.x < b.x + b.w && a.y + a.h > b.y && a.y < b.y + b.h;
const mounted = (world, h) => world.platforms.some(p => p.hp !== 0 && Math.abs(p.y - h.y) < 2 && p.x <= h.x && p.x + p.w >= h.x);

function disable(h) {
  h.done = true;
  h.active = false;
  h.warning = 0;
}

function pushLoose(world, acceleration, dt, filter = () => true) {
  for (const p of world.players) if (p.alive && filter(playerBox(p))) {
    p.vx += acceleration * dt;
    carryImpulse(p, Math.min(.18, Math.abs(acceleration) * dt / 5000));
  }
  for (const d of world.drops) if (filter({ x: d.x - 8, y: d.y - 8, w: 16, h: 16 }))
    d.vx = clamp(d.vx + acceleration * dt, -1500, 1500);
  for (const b of [...world.cover, ...world.chunks]) if (b.hp > 0 && !b.strapped && filter(bodyBounds(b)))
    impulseProp(b, acceleration * b.mass * dt, 0);
  for (const d of world.debris) if (filter({ x: d.x, y: d.y, w: d.w, h: d.h }))
    d.vx = clamp(d.vx + acceleration * dt, -1500, 1500);
  for (const rag of world.ragdolls) for (const p of rag.points || []) if (filter({ x: p.x - 2, y: p.y - 2, w: 4, h: 4 }))
    p.x += acceleration * dt * dt;
}

const brushes = [770, 1580];
const rinseZone = { x: 1010, y: 760, w: 430, h: 400 };
const dryerZone = { x: 1810, y: 720, w: 750, h: 440 };

export function carWashPhase(age) {
  const cycle = age % 16;
  return {
    cycle,
    rinseWarning: cycle >= 3.8 && cycle < 5,
    rinse: cycle >= 5 && cycle < 7.2,
    dryerWarning: cycle >= 9.5 && cycle < 10.8,
    dryer: cycle >= 10.8 && cycle < 14.3,
  };
}

export function updateCarWash(world, h, dt) {
  if (world.prediction) return;
  if (!mounted(world, h)) { disable(h); return; }
  h.age += dt;
  h.hitTimer -= dt;
  if (h.hitTimer <= 0) { h.hitIds = []; h.hitTimer = .38; }
  const phase = carWashPhase(h.age), wasActive = h.active;
  h.warning = phase.rinseWarning ? 5 - phase.cycle : phase.dryerWarning ? 10.8 - phase.cycle : 0;
  h.active = phase.rinse || phase.dryer;
  h.bodyX = phase.dryer ? 2240 : phase.rinse ? 1225 : h.x;
  h.bodyY = phase.rinse ? 820 : 1020;
  if (h.active && !wasActive)
    world.event("hazard", { x: h.bodyX, y: h.bodyY, kind: phase.rinse ? "carwash-rinse" : "carwash-dryer" });

  for (const x of brushes) {
    const zone = { x: x - 82, y: 830, w: 164, h: 330 };
    for (const p of world.players) {
      if (!p.alive || h.hitIds.includes(p.id) || !overlap(playerBox(p), zone)) continue;
      h.hitIds.push(p.id);
      const dir = Math.sign(p.x - x) || (x < 1280 ? -1 : 1);
      world.hit(p, { x, y: 980, vx: 0, vy: 0 }, 4, 560, dir, -.28,
        { blast: true, hitstop: .008, stun: .09, cause: "carwash" });
    }
  }

  if (phase.rinse) {
    h.jetTick = (h.jetTick || 0) - dt;
    if (h.jetTick <= 0) {
      addWater(world, 1210, 1148, 4);
      h.jetTick = .22;
    }
    for (const p of world.players) if (p.alive && overlap(playerBox(p), rinseZone)) {
      p.vx += 240 * dt;
      p.vy += 180 * dt;
    }
  }
  if (phase.dryer) pushLoose(world, -960, dt, box => overlap(box, dryerZone));
}

export function compactHazardZone(h) {
  if (h.type === "airflow") return { x: h.bodyX - 220, y: h.bodyY - 220, w: 440, h: 440 };
  if (h.type === "carwash") {
    const phase = carWashPhase(h.age);
    if (phase.dryer || phase.dryerWarning) return dryerZone;
    if (phase.rinse || phase.rinseWarning) return rinseZone;
    return { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
  }
  return null;
}
