import { JOINTS, makeRig } from "./puppet.js";
import { passiveBody } from "./body-physics.js";

export const THROW_MASS = {
  hammer: 3, crossbow: 1.2, harpoon: 2.1, shrapnel: 2.8, firework: 1.7, cryo: .9,
  blaster: 0.7,
  smg: 0.85,
  grenade: 0.8,
  sword: 1,
  bat: 1.1,
  burst: 1.25,
  ricochet: 1.3,
  frost: 1.5,
  tesla: 1.6,
  shotgun: 1.8,
  flame: 2,
  plasma: 2.2,
  rocket: 2.4,
  homing: 2.4,
  cluster: 2.5,
  repulsor: 2.6,
  railgun: 2.7,
  saw: 2.7,
  barrage: 3,
  minigun: 3.2,
  blackhole: 3.4,
  phaser: 3.4,
  bubble: 1.1,
  boomerang: .8,
  duck: 2.1,
  machinegun: 3.6,
};
export function knockDown(p, type) {
  if (!p.alive) return;
  const mass = THROW_MASS[type] || 1;
  p.knockdown = Math.min(1.7, 0.45 + mass * 0.3);
  p.block = false;
  p.swing = 0;
  p.comboTime = 0;
  p.freeze = 0;
  p.prone = false;
  p.ground = false;
  p.support = null;
  p.jumpBuffer = 0;
  p.rig ||= makeRig(p);
  // Each limb receives a different tangential impulse: the body folds and tumbles.
  const cx = p.rig[2].x,
    cy = p.rig[2].y,
    spin = (Math.sign(p.vx) || 1) * (3 + mass * 2);
  for (const q of p.rig) {
    q.px = q.x - (p.vx - (q.y - cy) * spin) / 120;
    q.py = q.y - (p.vy + (q.x - cx) * spin) / 120;
  }
  p.ragVx = p.vx;
  p.ragVy = p.vy;
}
export function moveKnocked(p, solids, dt) {
  const oldX = p.x,
    oldY = p.y;
  // Follow new external impulses while passive; no pose motor counteracts them.
  const dx = (p.vx - (p.ragVx || 0)) * dt,
    dy = (p.vy - (p.ragVy || 0)) * dt;
  for (const q of p.rig) {
    q.px -= dx;
    q.py -= dy;
  }
  passiveBody(p.rig, JOINTS, solids, dt);
  p.x = p.rig[2].x;
  p.y = p.rig[2].y + 3;
  p.vx = p.ragVx = Math.max(-1800, Math.min(1800, (p.x - oldX) / dt));
  p.vy = p.ragVy = Math.max(-1500, Math.min(1500, (p.y - oldY) / dt));
  p.ground = false;
  p.stun = Math.max(p.stun, dt * 2);
  p.knockdown = Math.max(0, p.knockdown - dt);
  if (p.knockdown > 0) return;
  const feet = Math.max(...p.rig.map((q) => q.y)) + 3;
  // Recover into the actual free space at the body, including low ceilings.
  for (const dy of [0, -12, -28, -48])
    for (const dx of [0, -22, 22, -44, 44]) {
      const x = p.x + dx,
        y = feet - 10 + dy;
      if (
        solids.some(
          (s) =>
            s.hp !== 0 &&
            x + 33 > s.x &&
            x - 33 < s.x + s.w &&
            y + 9 > s.y &&
            y - 9 < s.y + s.h,
        )
      )
        continue;
      p.x = x;
      p.y = y;
      p.prone = true;
      p.stun = 0;
      p.bodyAngle = p.facing * 1.5;
      p.angularVelocity = 0;
      p.vx *= 0.45;
      p.vy = Math.min(0, p.vy);
      p.jumps = 1;
      const floor = solids.find(
        (s) => x > s.x - 10 && x < s.x + s.w + 10 && Math.abs(y + 10 - s.y) < 6,
      );
      if (floor) {
        p.y = floor.y - 10;
        p.ground = true;
        p.support = floor.id;
        p.vy = 0;
        p.jumps = 0;
      }
      return;
    }
  p.knockdown = 0.08;
}
