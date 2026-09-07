import { COMBO } from "./arsenal.js";
import { segmentBox } from "./collision.js";
import { breakable } from "./maps.js";
import { impulseRig } from "./puppet.js";

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
    const boost = unarmed ? w.boost : 150;
    p.vx = Math.max(-490, Math.min(490, p.vx + ax * boost));
    if (Math.abs(ay) > 0.25) p.vy += ay * boost * 0.7;
    if (!p.ground) p.airLunge = true;
    p.rush = 0.17;
  }
  impulseRig(p, p.x + ax * 30, p.y - 10 + ay * 30, ax * 100, ay * 100);
  const solids = world.solids();
  let connected = false,
    rewarded = false;
  for (const q of world.players) {
    if (q.id === p.id || !q.alive) continue;
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
      { stun: w.stun, finisher: w.move === "spin" },
    );
    connected = true;
    rewarded ||= q.hp < hp;
  }
  // Strike the first solid surface in each direction, never through a wall.
  const angles =
    w.move === "spin" ? [angle, angle + Math.PI, angle - Math.PI / 2] : [angle];
  const damaged = new Set();
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
  if (rewarded && unarmed) {
    p.hp = Math.min(100, p.hp + 4);
    p.stamina = Math.min(100, p.stamina + 12);
  }
  if (!connected) world.event("swing", { x: p.x, y: p.y });
}
