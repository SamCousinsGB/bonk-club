import { bodyPoints, bodyBounds, impulseProp, prepareProp } from "./props.js";
import { segmentBox } from "./collision.js";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const bodies = world => [...world.cover, ...world.chunks];
const able = p => p.alive && !p.knockdown && !p.freeze && !(p.stun > 0) && !p.capturedBy;
export const carriedObject = (world, p) => p.carryId
  ? bodies(world).find(b => b.id === p.carryId && b.hp > 0) || null : null;

function nearestPoint(b, x, y) {
  const points = bodyPoints(b);
  let best = null, distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], c = points[(i + 1) % points.length], dx = c.x - a.x, dy = c.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < distance) { best = q; distance = d; }
  }
  return { ...best, distance };
}

// Shared by the authority and contextual controls. Only the host claims an ID.
export function pickupObjectCandidate(world, p, angle = p?.aimAngle) {
  if (!p || !able(p) || p.carryId) return null;
  const facing = Math.abs(Math.cos(angle ?? 0)) > .1 && Number.isFinite(angle)
    ? Math.sign(Math.cos(angle)) : p.facing;
  const x = p.x, y = p.y - 18;
  let best = null, distance = 68;
  const solids = world.solids ? world.solids() : [
    ...world.platforms.filter(b => b.hp !== 0),
    ...bodies(world).filter(b => b.hp > 0).map(b => ({ ...bodyBounds(b), id: b.id })),
  ];
  for (const b of bodies(world)) {
    if (b.hp <= 0 || !Number.isFinite(b.mass) || b.mass <= 0 || b.mass > 250 ||
        world.players.some(q => q.carryId === b.id) || (b.x + b.w / 2 - x) * facing < 8) continue;
    const q = nearestPoint(b, x, y);
    if (q.distance >= distance || solids.some(s => s.id !== b.id && s.propId !== b.id &&
        segmentBox(x, y, q.x, q.y, s))) continue;
    best = b; distance = q.distance;
  }
  return best;
}

export function releaseObject(world, p, throwing = false) {
  const b = carriedObject(world, p);
  p.carryId = null; delete p.carryPoint;
  p.pickupCooldown = Math.max(p.pickupCooldown || 0, .35);
  if (!b || !throwing) return;
  const angle = p.aimAngle ?? (p.facing > 0 ? 0 : Math.PI);
  const speed = clamp(590 * Math.sqrt(36 / b.mass), 250, 850);
  const vx = Math.cos(angle) * speed + p.vx * .65;
  const vy = Math.sin(angle) * speed - 100 + p.vy * .35;
  impulseProp(b, (vx - b.vx) * b.mass, (vy - b.vy) * b.mass,
    b.x + b.w / 2, b.y + b.h / 2 - Math.min(8, b.h / 5));
  p.cooldown = Math.max(p.cooldown || 0, .25);
  world.event("throw", { x: p.x, y: p.y });
}

// Edge-triggered, so holding an action cannot pick up/drop repeatedly or fire
// the newly exposed weapon/empty hands after an object has been released.
export function objectInput(world, p, input) {
  const i = { ...input };
  const grab = i.block && !p.grabHeld;
  const fire = (i.attack && !p.objectAttackHeld) || (i.throw && !p.objectThrowHeld);
  p.grabHeld = i.block; p.objectAttackHeld = i.attack; p.objectThrowHeld = i.throw;
  if (!i.block) p.grabConsumed = false;
  if (!i.attack && !i.throw) p.objectThrowConsumed = false;
  if (Number.isFinite(i.aim)) p.aimAngle = i.aim;
  else if (i.left !== i.right) p.aimAngle = i.right ? 0 : Math.PI;
  if (p.carryId && !able(p)) releaseObject(world, p);
  if (able(p) && grab) {
    if (p.carryId) {
      releaseObject(world, p); p.grabConsumed = true;
    } else {
      const b = pickupObjectCandidate(world, p, p.aimAngle);
      if (b) {
        // Set down ammunition intact, including an unarmed nuclear pickup.
        if (p.weapon && p.ammo > 0) world.drops.push({ x: p.x, y: p.y - 5,
          vx: p.vx, vy: p.vy, type: p.weapon, ammo: p.ammo, life: 18,
          owner: p.id, ownerLock: .65, lock: .2 });
        p.weapon = null; p.ammo = 0; p.carryId = b.id;
        p.block = false; p.blockTime = 0; p.swing = 0; p.rush = 0;
        p.grabConsumed = true;
        prepareProp(b); impulseProp(b, 0, 0);
        world.event("pickup", { x: p.x, y: p.y, color: p.color });
      }
    }
  } else if (able(p) && p.carryId && fire) {
    releaseObject(world, p, true); p.objectThrowConsumed = true;
  }
  if (p.carryId || p.grabConsumed) i.block = false;
  if (p.carryId || p.objectThrowConsumed) { i.attack = false; i.throw = false; }
  return i;
}

export function carrySpeed(world, p) {
  const b = carriedObject(world, p);
  return b ? clamp(55 / (55 + b.mass * .5), .35, .9) : 1;
}

export function cleanCarriedObjects(world) {
  for (const p of world.players) if (p.carryId) {
    const b = carriedObject(world, p);
    if (!b || !able(p) || world.phase !== "fight") { releaseObject(world, p); continue; }
    const q = nearestPoint(b, p.x, p.y - 22);
    if (q.distance > 110) { releaseObject(world, p); continue; }
    p.carryPoint = { x: q.x, y: q.y };
  }
}

// A bounded spring lifts the original body through the normal collision solver.
// No teleporting, hidden replacement collider or suspended barrel simulation.
export function pullCarriedObject(world, b, dt) {
  const p = world.players.find(p => p.carryId === b.id && able(p));
  if (!p) return false;
  const box = bodyBounds(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const tx = p.x + p.facing * (29 + box.w / 2);
  const ty = Math.min(p.y - 18, p.y + 19 - box.h / 2);
  const strength = clamp(150 * Math.sqrt(36 / b.mass), 65, 190), damping = 2 * Math.sqrt(strength);
  const ax = clamp((tx - cx) * strength + (p.vx - b.vx) * damping, -4000, 4000);
  const ay = clamp((ty - cy) * strength + (p.vy - b.vy) * damping - 1400, -4500, 4500);
  impulseProp(b, ax * b.mass * dt, ay * b.mass * dt);
  // Hands resist spin without freezing it; hits can still rotate a held object.
  b.spin *= Math.exp(-9 * dt);
  return true;
}
