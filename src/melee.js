import { carryImpulse } from "./impact.js";
import { COMBO } from "./arsenal.js";
import { segmentBox, playerBox } from "./collision.js";
import { breakable } from "./maps.js";
import { impulseRig } from "./puppet.js";
import { MELEE_SWINGS, meleeBlade, SWING_START, SWING_END } from "./melee-pose.js";
const swings = new WeakMap();

export function meleeAttack(world, p, weapon) {
  const unarmed = !p.weapon;
  const punch = unarmed || p.weapon === "powerfist";
  const index = unarmed && p.comboTime > 0 ? p.comboStep : 0;
  const w = unarmed
    ? COMBO[index]
    : { ...weapon, move: punch ? "punch" : "weapon", duration: punch ? weapon.duration : MELEE_SWINGS[p.weapon].duration };
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
  if (world.prediction) return;
  const strike = { w, unarmed, punch, weapon: p.weapon, previous: meleeBlade(p),
    effect: p.weapon === "sword" ? "slice" : null, occupant: p.occupant,
    hits: new Set(), cover: new Set(), rewarded: false };
  swings.set(p, strike);
  if (!resolveMelee(world, p, strike)) world.event("swing", { x: p.x, y: p.y, weapon: p.weapon });
}

// Each fighter/surface is struck once. Armed strikes wait for the wind-up and
// sweep the actual blade between ticks; fists retain their lunging contact window.
export function updateMelee(world, p) {
  const strike = swings.get(p);
  if (!strike || !p.alive || p.stun > 0.15 || p.block || p.occupant !== strike.occupant ||
      (!strike.unarmed && p.weapon !== strike.weapon) ||
      (strike.punch ? p.swing <= strike.w.duration * 0.3 :
        p.weapon !== strike.weapon || strike.previous.progress >= SWING_END) ||
      p.meleeMove !== strike.w.move) {
    swings.delete(p);
    return;
  }
  resolveMelee(world, p, strike);
}

function resolveMelee(world, p, strike) {
  if (!strike.punch) return resolveWeaponSwing(world, p, strike);
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
      { effect:strike.effect, weapon:strike.weapon, angle, stun: w.stun, finisher: w.move === "spin", melee: true, move: w.move, hitstop: w.move === "spin" ? 0.075 : 0.05 },
    );
    connected = true;
    rewarded ||= q.hp < hp;
    if (p.stun > .15) return connected;
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
    const identity = obstacle?.propId || obstacle?.id || obstacle;
    if (breakable(obstacle) && !damaged.has(identity)) {
      world.damageCover(obstacle, w.damage * 1.8, ax * w.force, ay * w.force,
        { x: Math.max(obstacle.x, Math.min(obstacle.x+obstacle.w,p.x)), y: p.y-10 });
      damaged.add(identity);
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

function resolveWeaponSwing(world, p, strike) {
  const current = meleeBlade(p), previous = strike.previous;
  strike.previous = current;
  if (current.progress < SWING_START) return false;
  const from = Math.max(SWING_START, previous.progress);
  const to = Math.min(SWING_END, current.progress);
  if (to < from) return false;
  const first = meleeBlade(p, from), last = meleeBlade(p, to);
  const steps = Math.min(64, Math.max(1, Math.ceil(Math.max(
    Math.abs(last.angle - first.angle) / 0.07,
    Math.hypot(current.x - previous.x, current.y - previous.y) / 6,
  ))));
  const solids = world.solids();
  const { w } = strike;
  let connected = false;
  for (let n = 0; n <= steps; n++) {
    const t = n / steps, blade = meleeBlade(p, from + (to - from) * t);
    const fraction = current.progress > previous.progress
      ? (blade.progress - previous.progress) / (current.progress - previous.progress) : 1;
    const x = previous.x + (current.x - previous.x) * fraction;
    const y = previous.y + (current.y - previous.y) * fraction;
    const ax = Math.cos(blade.angle), ay = Math.sin(blade.angle);
    const endX = x + ax * blade.length, endY = y + ay * blade.length;
    const obstacle = solids.map(s => ({ s, hit: segmentBox(x, y, endX, endY, s, blade.radius) }))
      .filter(o => o.hit).sort((a, b) => a.hit.t - b.hit.t)[0];
    for (const q of world.players) {
      if (q.id === p.id || !q.alive || strike.hits.has(q.id)) continue;
      const hit = segmentBox(x, y, endX, endY, playerBox(q), blade.radius);
      if (!hit || (obstacle && obstacle.hit.t <= hit.t) ||
          solids.some(s => segmentBox(p.x, p.y - 10, q.x, q.y, s, 2))) continue;
      strike.hits.add(q.id);
      // Follow the cutting/bludgeoning direction while retaining forward launch.
      const aim = p.aimAngle, push = Math.cos(aim) * 0.8 - ay * blade.side * 0.2;
      world.hit(q, p, w.damage, w.force, push, Math.sin(aim) * 0.5 - 0.45,
        { effect: strike.effect, weapon: strike.weapon, angle: blade.angle, stun: w.stun, melee: true,
          move: "weapon", hitstop: 0.05 });
      connected = true;
      if (p.stun > 0.15) return connected; // A parry stops the rest of the arc.
    }
    const identity = obstacle?.s.propId || obstacle?.s.id || obstacle?.s;
    if (breakable(obstacle?.s) && !strike.cover.has(identity)) {
      world.damageCover(obstacle.s, w.damage * 1.8, ax * w.force, ay * w.force,
        {x: x+(endX-x)*obstacle.hit.t, y: y+(endY-y)*obstacle.hit.t});
      strike.cover.add(identity);
      connected = true;
    }
  }
  return connected;
}
