import { JOINTS, makeRig } from "./puppet.js";
import { collidePoint } from "./body-physics.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const thin = s => s.oneWay || s.material === "cable";
const weights = [.9, .4, .35, 1, 0, 1, 0, 1, .8, 1, .8];

export function beginHang(p, support) {
  if (!p.rig) {
    p.rig = makeRig(p);
    for (const q of p.rig) { q.y -= 12; q.py -= 12; }
  }
  p.hangSupport = support.id;
  p.hangX = p.x;
  p.ground = false; p.support = null; p.prone = false; p.coyote = 0;
}

// The hands carry the weight. There is no hip anchor or leg pose motor:
// the same particles supply the visible pose, body position and release speed.
export function moveHanging(p, support, input, solids, dt) {
  const rig = p.rig, oldX = p.x, oldY = p.y;
  const inset = Math.min(15, support.w / 2);
  p.hangX = clamp(p.hangX + (support.dx || 0) +
    (Number(input.right) - Number(input.left)) * 110 * dt,
    support.x + inset, support.x + support.w - inset);
  const spread = Math.min(13, support.w / 2);
  const gripY = support.y + support.h;
  const targets = [[p.hangX - spread, gripY], [p.hangX + spread, gripY]];
  const origins = rig.map(q => ({x:q.x, y:q.y}));
  const contacts = rig.map(() => new Set());
  const collision = solids.filter(s => !thin(s));
  const drag = Math.exp(-.65 * dt);
  for (const q of rig) {
    const vx = (q.x - q.px) * drag, vy = (q.y - q.py) * drag;
    q.px = q.x; q.py = q.y;
    q.x += vx; q.y += vy + 1800 * dt * dt;
  }
  // Reach for the underside while gravity lowers the body; do not relocate
  // the fighter or snap the hands from their previous walking pose.
  const grips = [4, 6].map((index, i) => {
    const q = origins[index], [x, y] = targets[i];
    const reach = Math.min(1, 420 * dt / (Math.hypot(x-q.x,y-q.y) || 1));
    return {x:q.x+(x-q.x)*reach, y:q.y+(y-q.y)*reach};
  });
  // A relaxed neck keeps the head above the shoulders without fixing the
  // torso upright. Hips, knees and feet remain completely passive.
  const neck = rig[1], hip = rig[2], head = rig[0];
  const length = Math.hypot(neck.x-hip.x,neck.y-hip.y) || 1;
  const neckSpring = 1 - Math.exp(-12 * dt);
  head.x += (neck.x+(neck.x-hip.x)*18/length-head.x)*neckSpring;
  head.y += (neck.y+(neck.y-hip.y)*18/length-head.y)*neckSpring;
  for (let pass = 0; pass < 14; pass++) {
    for (const [ai, bi, length] of JOINTS) {
      const a = rig[ai], b = rig[bi], dx = b.x-a.x, dy = b.y-a.y;
      const d = Math.hypot(dx,dy) || 1, sum = weights[ai]+weights[bi];
      const correction = (d-length)/d;
      a.x += dx*correction*weights[ai]/sum;
      a.y += dy*correction*weights[ai]/sum;
      b.x -= dx*correction*weights[bi]/sum;
      b.y -= dy*correction*weights[bi]/sum;
    }
    // The two knees and boots have volume, so resting legs do not collapse
    // into one line. They still swing and bend independently under gravity.
    for (const [ai, bi, radius] of [[7, 9, 6], [8, 10, 5]]) {
      const a = rig[ai], b = rig[bi], dx = b.x-a.x, dy = b.y-a.y;
      const d = Math.hypot(dx,dy);
      if (d < radius) {
        const x = d > .001 ? dx/d : 1, y = d > .001 ? dy/d : 0;
        a.x -= x*(radius-d)*.5; a.y -= y*(radius-d)*.5;
        b.x += x*(radius-d)*.5; b.y += y*(radius-d)*.5;
      }
    }
    for (let i = 0; i < rig.length; i++) {
      if (i === 4 || i === 6) continue;
      collidePoint(rig[i], collision, i === 0 ? 10 : 3,
        pass === 0 ? origins[i] : rig[i], contacts[i]);
    }
    for (const [i, index] of [4, 6].entries()) {
      rig[index].x = grips[i].x; rig[index].y = grips[i].y;
    }
  }
  p.x = hip.x; p.y = hip.y + 4;
  p.vx = clamp((p.x-oldX)/dt, -1800, 1800);
  p.vy = clamp((p.y-oldY)/dt, -1500, 1500);
  const angle = Math.atan2(neck.x-hip.x, hip.y-neck.y);
  p.angularVelocity = Math.atan2(Math.sin(angle-(p.bodyAngle||0)),
    Math.cos(angle-(p.bodyAngle||0))) / dt;
  p.bodyAngle = angle;
}
