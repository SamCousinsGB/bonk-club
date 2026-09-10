import { carryImpulse } from "./impact.js";
import { COMBO } from "./arsenal.js";
import { segmentBox } from "./collision.js";
import { breakable } from "./maps.js";
import { impulseRig } from "./puppet.js";
const swings = new WeakMap();

export function meleeAttack(world, p, weapon) {
  const unarmed = !p.weapon;
  const index = unarmed && p.comboTime > 0 ? p.comboStep : 0;
  const w = unarmed
    ? COMBO[index]
    : { ...weapon, move: "weapon", duration: 0.22 };
  p.cooldown = w.cooldown;
  p.swing = w.duration;
  p.swingDuration = w.duration;
  p.meleeMove = w.move;
  p.comboStep = unarmed ? (index + 1) % COMBO.length : 0;
  p.comboTime = unarmed ? 0.95 : 0;
  p.pickupCooldown = Math.max(p.pickupCooldown, unarmed ? 0.35 : 0);
  const angle = p.aimAngle,
    ax = Math.cos(angle),
    ay = Math.sin(angle);
  // One air lunge per jump sequence: directional attacks cannot become flight.
  if (!p.prone && (p.ground || !p.airLunge)) {
    const boost = w.boost || 260;
    p.vx = Math.max(-620, Math.min(620, p.vx + ax * boost));
    if (Math.abs(ay) > 0.25) p.vy += ay * boost * 0.7;
    if (!p.ground || ay < -0.25) p.airLunge = true;
    p.rush = 0.22;
    carryImpulse(p, 0.23);
  }
  impulseRig(p, p.x + ax * 30, p.y - 10 + ay * 30, ax * 100, ay * 100);
  const strike = { w, unarmed, occupant: p.occupant, hits: new Set(), cover: new Set(), rewarded: false };
  swings.set(p, strike);
  if (!resolveMelee(world, p, strike)) world.event("swing", { x: p.x, y: p.y });
}

// Contact remains active during the forward part of the animation. A lunge can
// connect after its first frame; each fighter/surface is struck only once.
export function updateMelee(world, p) {
  const strike = swings.get(p);
  if (!strike || !p.alive || p.stun > 0.15 || p.block || p.occupant !== strike.occupant ||
      p.swing <= strike.w.duration * 0.3 || p.meleeMove !== strike.w.move) {
    swings.delete(p);
    return;
  }
  resolveMelee(world, p, strike);
}

function resolveMelee(world, p, strike) {
  const { w, unarmed } = strike;
  const angle = p.aimAngle, ax = Math.cos(angle), ay = Math.sin(angle);
  const solids = world.solids();
  let connected = false,
    rewarded = false;
  for (const q of world.players) {
    if (q.id === p.id || !q.alive || strike.hits.has(q.id)) continue;
    const dx = q.x - p.x,
      dy = q.y - (p.y - 10);
    const along = dx * ax + dy * ay,
      across = Math.abs(-dx * ay + dy * ax);
    const reaches =
      w.move === "spin"
        ? Math.hypot(dx, dy) < w.range
        : along > -9 && along < w.range && across < (q.prone ? 29 : 43);
    if (
      !reaches ||
      solids.some((s) => segmentBox(p.x, p.y - 10, q.x, q.y, s, 2))
    )
      continue;
    const hp = q.hp;
    strike.hits.add(q.id);
    world.hit(
      q,
      p,
      w.damage,
      w.force,
      w.move === "spin"
        ? Math.sign(dx) || p.facing
        : Math.abs(ax) > 0.05
          ? ax
          : p.facing * 0.1,
      unarmed && w.move !== "spin"
        ? Math.min(-0.13, ay * 0.35)
        : ay * 0.6 - 0.45,
      { stun: w.stun, finisher: w.move === "spin", melee: true, move: w.move, hitstop: w.move === "spin" ? 0.075 : 0.05 },
    );
    connected = true;
    rewarded ||= q.hp < hp;
  }
  // Strike the first solid surface in each direction, never through a wall.
  const angles =
    w.move === "spin" ? [angle, angle + Math.PI, angle - Math.PI / 2] : [angle];
  const damaged = strike.cover;
  for (const a of angles) {
    const obstacle = solids
      .map((s) => ({
        s,
        hit: segmentBox(
          p.x,
          p.y - 10,
          p.x + Math.cos(a) * w.range,
          p.y - 10 + Math.sin(a) * w.range,
          s,
          4,
        ),
      }))
      .filter((o) => o.hit)
      .sort((a, b) => a.hit.t - b.hit.t)[0]?.s;
    if (breakable(obstacle) && !damaged.has(obstacle)) {
      world.damageCover(obstacle, w.damage * 1.8, ax * w.force, ay * w.force);
      damaged.add(obstacle);
      connected = true;
    }
  }
  if (rewarded && unarmed && !strike.rewarded) {
    p.hp = Math.min(100, p.hp + 4);
    p.stamina = Math.min(100, p.stamina + 12);
    strike.rewarded = true;
  }
  return connected;
}
